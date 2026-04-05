locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_sqs_queue" "pdf_dlq" {
  name                      = "${local.name_prefix}-pdf-generation-dlq"
  message_retention_seconds = 1209600

  tags = {
    Name = "${local.name_prefix}-pdf-dlq"
  }
}

resource "aws_sqs_queue" "pdf" {
  name                       = "${local.name_prefix}-pdf-generation"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 0

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.pdf_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${local.name_prefix}-pdf-queue"
  }
}
