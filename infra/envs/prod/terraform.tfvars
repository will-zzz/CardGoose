aws_region = "us-east-1"
# Suffix for resource names, e.g. cardboardforge-prod-cluster, cardboardforge-prod-assets-xxx buckets.
# If you previously applied with environment = "dev", the next plan will replace those resources with new prod-named ones (new VPC/RDS/S3/…); snapshot data and plan carefully.
environment  = "prod"
project_name = "cardboardforge"

# Must be >= 1 for the public ALB to serve traffic (0 tasks = HTTP 503 from the load balancer).
# Use 0 only when you intentionally want no Fargate tasks (e.g. local-only dev against RDS).
ecs_desired_count = 1

# Public IPs as /32 so local Prisma can reach RDS. Do not commit real addresses here.
# Option A — shell (same apply session):
#   export TF_VAR_rds_dev_access_cidrs='["203.0.113.10/32","198.51.100.2/32"]'
# Option B — copy rds.auto.tfvars.example → rds.auto.tfvars (gitignored) and edit there.
# Default stays empty in committed config; omit TF_VAR / file to keep RDS ECS-only.
