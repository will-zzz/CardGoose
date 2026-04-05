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

  # Remote state (see infra/BOOTSTRAP.md).
  # S3 object key kept as envs/dev/... for existing deployments; only the folder name is envs/prod.
  backend "s3" {
    bucket         = "cardboardforge-tf-state-946547149954"
    key            = "envs/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "cardboardforge-tf-locks"
    encrypt        = true
  }
}
