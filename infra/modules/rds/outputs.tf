output "module_name" {
  value = "rds"
}

output "db_endpoint" {
  value = aws_db_instance.main.address
}

output "db_port" {
  value = aws_db_instance.main.port
}

output "db_name" {
  value = aws_db_instance.main.db_name
}

output "db_username" {
  description = "Master DB username (not secret)."
  value       = aws_db_instance.main.username
}

output "db_password" {
  value     = random_password.master.result
  sensitive = true
}

output "db_instance_id" {
  value = aws_db_instance.main.id
}

output "connection_string" {
  description = "Postgres URL (sensitive)."
  value       = "postgresql://${var.db_username}:${random_password.master.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}"
  sensitive   = true
}
