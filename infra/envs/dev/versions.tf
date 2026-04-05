terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state: uncomment after completing infra/BOOTSTRAP.md (S3 bucket + DynamoDB lock table).
  backend "s3" {
    bucket         = "cardboardforge-tf-state-946547149954"
    key            = "envs/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "cardboardforge-tf-locks"
    encrypt        = true
  }
}
