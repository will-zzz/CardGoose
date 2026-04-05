variable "aws_region" {
  description = "AWS region (e.g. us-east-1)."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "dev"
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
