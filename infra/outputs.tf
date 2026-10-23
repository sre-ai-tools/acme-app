output "api_url" {
  description = "API Gateway URL. The UI uses the same API through CloudFront at /api."
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "ui_url" {
  description = "CloudFront URL of the UI."
  value       = "https://${aws_cloudfront_distribution.ui.domain_name}"
}

output "ui_bucket" {
  description = "Bucket the UI build is uploaded to."
  value       = aws_s3_bucket.ui.bucket
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.ui.id
}

output "cognito_domain" {
  description = "Hosted UI domain for sign-in redirects."
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "db_proxy_endpoint" {
  value = aws_db_proxy.main.endpoint
}

output "sev1_topic_arn" {
  description = "SNS topic for SEV1 pages; subscribe a pager integration here."
  value       = aws_sns_topic.sev1.arn
}

output "alarms_topic_arn" {
  value = aws_sns_topic.alarms.arn
}
