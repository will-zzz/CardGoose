variable "environment" {
  type = string
}

variable "project_name" {
  type = string
}

variable "api_origin_domain" {
  description = "ALB DNS name (HTTP) — CloudFront forwards /api/* and /health here."
  type        = string
}
