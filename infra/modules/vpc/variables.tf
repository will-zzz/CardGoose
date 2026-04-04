variable "environment" {
  description = "Deployment environment name (e.g. dev, prod)."
  type        = string
}

variable "project_name" {
  description = "Short project prefix for resource names."
  type        = string
  default     = "forgecard"
}
