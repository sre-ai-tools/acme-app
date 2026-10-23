variable "aws_region" {
  description = "Region for every resource."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name, used in resource names."
  type        = string
  default     = "prod"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,15}$", var.environment))
    error_message = "environment must be 2-16 lowercase letters, digits or hyphens."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC. Split into two private /24 subnets."
  type        = string
  default     = "10.40.0.0/16"
}

variable "lambda_package_path" {
  description = "Path to the API deployment zip (api/ with its dependencies)."
  type        = string
  default     = "../build/api.zip"
}

variable "lambda_reserved_concurrency" {
  description = "Upper bound on concurrent API executions, which also bounds database connections."
  type        = number
  default     = 20
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "cognito_domain_prefix" {
  description = "Prefix for the Cognito hosted UI domain. Must be globally unique in the region."
  type        = string
  default     = "acme-incident-log"
}

variable "extra_callback_urls" {
  description = "Extra OAuth callback URLs, e.g. http://localhost:5173/ for local UI development."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for url in var.extra_callback_urls : can(regex("^(https://[^/]+/|http://localhost(:[0-9]+)?/)", url))
    ])
    error_message = "Callback URLs must use https, or http only for localhost, and end the host with /."
  }
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for the API and Lambda."
  type        = number
  default     = 30
}
