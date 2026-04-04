terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state: uncomment after completing infra/BOOTSTRAP.md (S3 bucket + DynamoDB lock table).
  # backend "s3" {
  #   bucket         = "forgecard-tf-state"
  #   key            = "envs/dev/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "forgecard-tf-locks"
  #   encrypt        = true
  # }
}
