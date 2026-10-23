provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "acme-app"
      Application = "incident-log"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "incident-log-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
}
