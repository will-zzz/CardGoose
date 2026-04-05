variable "environment" {
  description = "Deployment environment name (e.g. dev, prod)."
  type        = string
}

variable "project_name" {
  description = "Short project prefix for resource names."
  type        = string
  default     = "cardboardforge"
}

variable "rds_dev_access_cidrs" {
  description = "If non-empty, allow PostgreSQL from each /32 for local dev against prod RDS."
  type        = list(string)
  default     = []
}
