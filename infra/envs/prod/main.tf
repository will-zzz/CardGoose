module "vpc" {
  source = "../../modules/vpc"

  environment          = var.environment
  project_name         = var.project_name
  rds_dev_access_cidrs = var.rds_dev_access_cidrs
}

module "ecr" {
  source = "../../modules/ecr"

  environment  = var.environment
  project_name = var.project_name
}

module "s3" {
  source = "../../modules/s3"

  environment  = var.environment
  project_name = var.project_name
}

module "sqs" {
  source = "../../modules/sqs"

  environment  = var.environment
  project_name = var.project_name
}

module "iam" {
  source = "../../modules/iam"

  environment        = var.environment
  project_name       = var.project_name
  assets_bucket_arn  = module.s3.assets_bucket_arn
  exports_bucket_arn = module.s3.exports_bucket_arn
  pdf_queue_arn      = module.sqs.queue_arn
}

module "rds" {
  source = "../../modules/rds"

  environment           = var.environment
  project_name          = var.project_name
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.public_subnet_ids
  rds_security_group_id = module.vpc.rds_security_group_id
  db_username           = var.db_username
  db_name               = var.db_name
  publicly_accessible   = length(var.rds_dev_access_cidrs) > 0
}

module "cloudwatch" {
  source = "../../modules/cloudwatch"

  environment     = var.environment
  project_name    = var.project_name
  sqs_queue_name  = module.sqs.queue_name
  dlq_queue_name  = module.sqs.dlq_name
  rds_instance_id = module.rds.db_instance_id
}

module "ecs" {
  source = "../../modules/ecs"

  environment                 = var.environment
  project_name                = var.project_name
  aws_region                  = var.aws_region
  public_subnet_ids           = module.vpc.public_subnet_ids
  api_security_group_id       = module.vpc.api_security_group_id
  ecs_tasks_security_group_id = module.vpc.ecs_tasks_security_group_id
  execution_role_arn          = module.iam.ecs_execution_role_arn
  api_task_role_arn           = module.iam.api_task_role_arn
  worker_task_role_arn        = module.iam.worker_task_role_arn
  api_repository_url          = module.ecr.api_repository_url
  worker_repository_url       = module.ecr.worker_repository_url
  db_endpoint                 = module.rds.db_endpoint
  db_port                     = module.rds.db_port
  db_name                     = module.rds.db_name
  db_username                 = module.rds.db_username
  db_password                 = module.rds.db_password
  pdf_queue_url               = module.sqs.queue_url
  assets_bucket_name          = module.s3.assets_bucket_name
  exports_bucket_name         = module.s3.exports_bucket_name
  api_log_group_name          = module.cloudwatch.api_log_group_name
  worker_log_group_name       = module.cloudwatch.worker_log_group_name
  desired_count               = var.ecs_desired_count
  worker_render_url           = var.worker_render_url

  depends_on = [module.cloudwatch, module.rds, module.iam]
}
