aws_region = "us-east-1"
# Suffix for resource names, e.g. cardboardforge-prod-cluster, cardboardforge-prod-assets-xxx buckets.
# If you previously applied with environment = "dev", the next plan will replace those resources with new prod-named ones (new VPC/RDS/S3/…); snapshot data and plan carefully.
environment  = "prod"
project_name = "cardboardforge"

# Hybrid dev: local API + Prisma reach RDS; scale ECS to 0 so local worker owns SQS.
ecs_desired_count = 0

# Your public IP (/32). Update if your ISP changes IP. curl -s https://checkip.amazonaws.com
rds_dev_access_cidr = "98.26.44.239/32"
