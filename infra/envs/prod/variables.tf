variable "aws_region" {
  description = "AWS region (e.g. us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Name suffix for AWS resources (e.g. cardboardforge-prod-*)."
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Resource name prefix."
  type        = string
  default     = "cardboardforge"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "forge"
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "cardboardforge"
}

variable "ecs_desired_count" {
  description = "Fargate tasks per service."
  type        = number
  default     = 1
}

variable "rds_dev_access_cidr" {
  description = "Your public IP as /32 (e.g. output of curl -s https://checkip.amazonaws.com plus /32) so local Node can reach prod RDS. Empty = RDS stays private (ECS only)."
  type        = string
  default     = ""
  sensitive   = false
}
