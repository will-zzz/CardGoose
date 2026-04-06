variable "environment" {
  type = string
}

variable "project_name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "api_security_group_id" {
  type        = string
  description = "ECS API tasks security group (receives traffic only from ALB)."
}
