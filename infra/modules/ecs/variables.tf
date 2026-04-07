variable "environment" {
  type = string
}

variable "project_name" {
  type    = string
  default = "cardboardforge"
}

variable "aws_region" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "api_security_group_id" {
  type = string
}

variable "ecs_tasks_security_group_id" {
  type = string
}

variable "execution_role_arn" {
  type = string
}

variable "api_task_role_arn" {
  type = string
}

variable "worker_task_role_arn" {
  type = string
}

variable "api_repository_url" {
  type = string
}

variable "worker_repository_url" {
  type = string
}

variable "db_endpoint" {
  type = string
}

variable "db_port" {
  type = number
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "pdf_queue_url" {
  type = string
}

variable "assets_bucket_name" {
  type = string
}

variable "exports_bucket_name" {
  type = string
}

variable "api_log_group_name" {
  type = string
}

variable "worker_log_group_name" {
  type = string
}

variable "desired_count" {
  description = "Fargate task count (0 for minimum cost until images exist)."
  type        = number
  default     = 0
}

variable "worker_render_url" {
  description = "HTTP origin for the PDF worker to load /render (ALB URL, no trailing slash)."
  type        = string
}

variable "cors_origin" {
  description = "Browser origin for CORS (ALB URL when SPA is served from the API container)."
  type        = string
}

variable "target_group_arn" {
  description = "ALB target group for the API service."
  type        = string
}
