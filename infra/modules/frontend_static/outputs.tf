output "bucket_name" {
  value = aws_s3_bucket.site.id
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "HTTPS origin for the SPA (set worker RENDER_URL and CORS to https://<this>)."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "site_url" {
  description = "Full URL with https://"
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}
