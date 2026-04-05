# =============================================================================
# PROD ENVIRONMENT — NOT IN USE (see main.tf for details)
# =============================================================================

/*
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

  backend "s3" {
    bucket         = "cardboardforge-tf-state-946547149954"
    key            = "envs/prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "cardboardforge-tf-locks"
    encrypt        = true
  }
}
*/
