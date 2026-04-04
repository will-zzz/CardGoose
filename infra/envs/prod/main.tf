module "vpc" {
  source = "../../modules/vpc"

  environment  = var.environment
  project_name = var.project_name
}

module "ecr" {
  source = "../../modules/ecr"

  environment  = var.environment
  project_name = var.project_name
}

module "rds" {
  source = "../../modules/rds"

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

  environment  = var.environment
  project_name = var.project_name
}

module "ecs" {
  source = "../../modules/ecs"

  environment  = var.environment
  project_name = var.project_name
}

module "cloudwatch" {
  source = "../../modules/cloudwatch"

  environment  = var.environment
  project_name = var.project_name
}
