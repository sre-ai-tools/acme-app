terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Local state: this stack holds one role and is applied once by hand.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "acme-app"
      Stack     = "bootstrap"
      ManagedBy = "terraform"
    }
  }
}
