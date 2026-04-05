variable "environment" {
  type = string
}

variable "project_name" {
  type    = string
  default = "cardboardforge"
}

variable "sqs_queue_name" {
  type = string
}

variable "dlq_queue_name" {
  type = string
}

variable "rds_instance_id" {
  type = string
}
