variable "aws_region" {
  description = "Region for Bedrock calls. Must match aws-region in .github/workflows/review-personas.yml."
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "GitHub repo allowed to assume the role, as owner/name."
  type        = string
  default     = "sre-ai-tools/acme-app"
}

variable "role_name" {
  description = "Name of the reviewer IAM role."
  type        = string
  default     = "github-review-personas"
}

variable "model_id" {
  description = "Bedrock foundation model the reviewer may call."
  type        = string
  default     = "qwen.qwen3-32b-v1:0"
}
