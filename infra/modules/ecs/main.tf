locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = {
    Name = "${local.name_prefix}-cluster"
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.api_task_role_arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = "${var.api_repository_url}:latest"
    essential = true
    portMappings = [{
      containerPort = 3001
      protocol      = "tcp"
    }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3001" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "DATABASE_URL", value = "postgresql://${var.db_username}:${var.db_password}@${var.db_endpoint}:${var.db_port}/${var.db_name}" },
      { name = "SQS_QUEUE_URL", value = var.pdf_queue_url },
      { name = "S3_BUCKET_ASSETS", value = var.assets_bucket_name },
      { name = "S3_BUCKET_EXPORTS", value = var.exports_bucket_name },
      { name = "JWT_SECRET", value = random_password.jwt.result },
      { name = "CORS_ORIGIN", value = var.cors_origin },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = var.api_log_group_name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.worker_task_role_arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = "${var.worker_repository_url}:latest"
    essential = true
    environment = concat(
      [
        { name = "AWS_REGION", value = var.aws_region },
        { name = "SQS_QUEUE_URL", value = var.pdf_queue_url },
        { name = "S3_BUCKET_ASSETS", value = var.assets_bucket_name },
        { name = "S3_BUCKET_EXPORTS", value = var.exports_bucket_name },
        { name = "PYTHONPATH", value = "/app/src" },
        { name = "RENDER_URL", value = var.worker_render_url },
      ],
    )
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = var.worker_log_group_name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "api" {
  name             = "${local.name_prefix}-api"
  cluster          = aws_ecs_cluster.main.id
  task_definition  = aws_ecs_task_definition.api.arn
  desired_count    = var.desired_count
  launch_type      = "FARGATE"
  platform_version = "1.4.0"

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = 3001
  }

  # Let prisma migrate + Node boot complete before ALB health checks fail the target.
  health_check_grace_period_seconds = 120

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.api_security_group_id, var.ecs_tasks_security_group_id]
    assign_public_ip = true
  }

  # With desired_count=1, 0% allows the only task to stop before the new one is healthy → 502/503 during deploy.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
}

resource "aws_ecs_service" "worker" {
  name             = "${local.name_prefix}-worker"
  cluster          = aws_ecs_cluster.main.id
  task_definition  = aws_ecs_task_definition.worker.arn
  desired_count    = var.desired_count
  launch_type      = "FARGATE"
  platform_version = "1.4.0"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.ecs_tasks_security_group_id]
    assign_public_ip = true
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 200
}
