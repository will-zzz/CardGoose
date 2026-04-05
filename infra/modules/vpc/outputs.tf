output "module_name" {
  description = "Module identifier for wiring checks."
  value       = "vpc"
}

output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs for ECS and RDS."
  value       = aws_subnet.public[*].id
}

output "ecs_tasks_security_group_id" {
  description = "Security group for ECS tasks (outbound + RDS access)."
  value       = aws_security_group.ecs_tasks.id
}

output "api_security_group_id" {
  description = "Security group for API (inbound 3001)."
  value       = aws_security_group.api.id
}

output "rds_security_group_id" {
  description = "Security group for RDS."
  value       = aws_security_group.rds.id
}
