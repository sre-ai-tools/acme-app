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

variable "github_oidc_sub_prefix" {
  description = "Subject prefix in this repo's GitHub OIDC tokens. The repo uses immutable subjects (owner@id/name@id); see GET /repos/{owner}/{repo}/actions/oidc/customization/sub."
  type        = string
  default     = "repo:sre-ai-tools@342830963/acme-app@1430531521"
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
