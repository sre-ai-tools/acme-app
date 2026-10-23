terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Placeholder values: this stack is never applied (docs/specs/0001-incident-log, REAL-3).
  backend "s3" {
    bucket       = "acme-incident-log-tfstate-CHANGEME"
    key          = "incident-log/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
