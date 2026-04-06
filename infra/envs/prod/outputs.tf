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
  description = "docker push target for API image."
  value       = module.ecr.api_repository_url
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

output "ecs_api_service_name" {
  value = module.ecs.api_service_name
}

output "ecs_worker_service_name" {
  value = module.ecs.worker_service_name
}

output "rds_endpoint" {
  value = module.rds.db_endpoint
}

output "rds_master_password" {
  description = "Retrieve with: terraform output -raw rds_master_password"
  value       = module.rds.db_password
  sensitive   = true
}

output "sns_alerts_topic_arn" {
  value = module.cloudwatch.alerts_topic_arn
}

output "public_api_url" {
  description = "Direct ALB URL (HTTP). Prefer the CloudFront URL for browsers; use this for debugging."
  value       = "http://${module.alb.alb_dns_name}"
}

output "frontend_url" {
  description = "Production app URL: SPA + /api/* and /health proxied to the API (set VITE_API_URL empty for same-origin)."
  value       = module.frontend_static.site_url
}

output "frontend_bucket_name" {
  value = module.frontend_static.bucket_name
}

output "cloudfront_distribution_id" {
  value = module.frontend_static.cloudfront_distribution_id
}

output "alb_dns_name" {
  value = module.alb.alb_dns_name
}
