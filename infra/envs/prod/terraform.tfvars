aws_region = "us-east-1"
# Suffix for resource names, e.g. cardboardforge-prod-cluster, cardboardforge-prod-assets-xxx buckets.
# If you previously applied with environment = "dev", the next plan will replace those resources with new prod-named ones (new VPC/RDS/S3/…); snapshot data and plan carefully.
environment  = "prod"
project_name = "cardboardforge"

# Must be >= 1 for the public ALB to serve traffic (0 tasks = HTTP 503 from the load balancer).
# Use 0 only when you intentionally want no Fargate tasks (e.g. local-only dev against RDS).
ecs_desired_count = 1

# Public IPs as /32 so local Prisma can reach RDS (add home, school, etc.). curl -s https://checkip.amazonaws.com
rds_dev_access_cidrs = [
  "98.26.44.239/32", # home
  "152.3.43.55/32",  # school / other — change if your IP changes
]
