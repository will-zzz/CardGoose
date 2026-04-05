variable "environment" {
  type = string
}

variable "project_name" {
  type    = string
  default = "cardboardforge"
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  description = "Subnet IDs for DB subnet group (public subnets for dev)."
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "Security group attached to RDS (ingress from ECS tasks SG)."
  type        = string
}

variable "db_username" {
  description = "Master username for PostgreSQL."
  type        = string
  default     = "forge"
}

variable "db_name" {
  type    = string
  default = "cardboardforge"
}

variable "publicly_accessible" {
  description = "If true, RDS gets a public address (needed for local dev from your laptop when combined with RDS SG dev rule)."
  type        = bool
  default     = false
}
