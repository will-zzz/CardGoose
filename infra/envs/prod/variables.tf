variable "aws_region" {
  description = "AWS region (e.g. us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "skip_aws_credential_validation" {
  description = "Skip STS credential check. Set true only for CI `terraform validate` without AWS keys; always false for real plans and applies."
  type        = bool
  default     = false
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

variable "rds_dev_access_cidrs" {
  description = "One or more public IPs as /32 (curl -s https://checkip.amazonaws.com) so local Prisma can reach prod RDS—e.g. home and school Wi‑Fi. Empty = RDS stays private (ECS only)."
  type        = list(string)
  default     = []
  sensitive   = false
}
