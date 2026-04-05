output "module_name" {
  value = "sqs"
}

output "queue_url" {
  value = aws_sqs_queue.pdf.id
}

output "queue_arn" {
  value = aws_sqs_queue.pdf.arn
}

output "dlq_url" {
  value = aws_sqs_queue.pdf_dlq.id
}

output "dlq_arn" {
  value = aws_sqs_queue.pdf_dlq.arn
}

output "queue_name" {
  value = aws_sqs_queue.pdf.name
}

output "dlq_name" {
  value = aws_sqs_queue.pdf_dlq.name
}
