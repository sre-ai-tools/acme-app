output "role_arn" {
  description = "Set as aws-role-arn in .github/workflows/review-personas.yml."
  value       = aws_iam_role.review_personas.arn
}
