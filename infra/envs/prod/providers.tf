provider "aws" {
  region = var.aws_region

  # CI runs `terraform validate` without real credentials; real applies use default false.
  skip_credentials_validation = var.skip_aws_credential_validation

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
