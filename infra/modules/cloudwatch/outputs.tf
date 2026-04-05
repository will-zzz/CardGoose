output "module_name" {
  value = "cloudwatch"
}

output "api_log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}

output "worker_log_group_name" {
  value = aws_cloudwatch_log_group.worker.name
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}
