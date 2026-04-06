output "alb_dns_name" {
  description = "Public DNS for the API (use as VITE_API_URL base with http:// or https:// after ACM)."
  value       = aws_lb.api.dns_name
}

output "alb_zone_id" {
  value = aws_lb.api.zone_id
}

output "target_group_arn" {
  value = aws_lb_target_group.api.arn
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}
