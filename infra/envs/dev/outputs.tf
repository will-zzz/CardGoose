output "stack" {
  description = "Wired module identifiers (skeleton)."
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
