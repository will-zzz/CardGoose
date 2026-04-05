# =============================================================================
# PROD ENVIRONMENT — NOT IN USE (see main.tf for details)
# =============================================================================

/*
output "stack" {
  description = "Wired module identifiers."
  value = {
    vpc        = module.vpc.module_name
    ecr        = module.ecr.module_name
    rds        = module.rds.module_name
    s3         = module.s3.module_name
    sqs        = module.sqs.module_name
    iam        = module.iam.module_name
    ecs        = module.ecs.module_name
    cloudwatch = module.cloudwatch.module_name
  }
}

output "ecr_api_repository_url" {
  value = module.ecr.api_repository_url
}

output "ecr_worker_repository_url" {
  value = module.ecr.worker_repository_url
}

output "pdf_queue_url" {
  value = module.sqs.queue_url
}

output "assets_bucket_name" {
  value = module.s3.assets_bucket_name
}

output "exports_bucket_name" {
  value = module.s3.exports_bucket_name
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "rds_endpoint" {
  value = module.rds.db_endpoint
}

output "sns_alerts_topic_arn" {
  value = module.cloudwatch.alerts_topic_arn
}
*/
