output "module_name" {
  value = "s3"
}

output "assets_bucket_name" {
  value = aws_s3_bucket.assets.bucket
}

output "assets_bucket_arn" {
  value = aws_s3_bucket.assets.arn
}

output "exports_bucket_name" {
  value = aws_s3_bucket.exports.bucket
}

output "exports_bucket_arn" {
  value = aws_s3_bucket.exports.arn
}
