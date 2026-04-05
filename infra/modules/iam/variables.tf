variable "environment" {
  type = string
}

variable "project_name" {
  type    = string
  default = "cardboardforge"
}

variable "assets_bucket_arn" {
  description = "S3 assets bucket ARN."
  type        = string
}

variable "exports_bucket_arn" {
  description = "S3 exports bucket ARN."
  type        = string
}

variable "pdf_queue_arn" {
  description = "Main PDF job queue ARN."
  type        = string
}
