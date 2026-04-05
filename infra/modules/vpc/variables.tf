variable "environment" {
  description = "Deployment environment name (e.g. dev, prod)."
  type        = string
}

variable "project_name" {
  description = "Short project prefix for resource names."
  type        = string
  default     = "cardboardforge"
}

variable "rds_dev_access_cidr" {
  description = "If non-empty (e.g. 203.0.113.10/32), allow PostgreSQL from this CIDR for local dev against prod RDS."
  type        = string
  default     = ""
}
