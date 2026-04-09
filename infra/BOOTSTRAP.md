# AWS & Terraform bootstrap

This guide covers creating a new AWS account for CardGoose, configuring the CLI, and bootstrapping Terraform **remote state** (S3 + DynamoDB). After that, apply from [`envs/prod`](../envs/prod) (single AWS environment).

## 1. Create an AWS account

1. Go to [https://aws.amazon.com](https://aws.amazon.com) and choose **Create an AWS Account**.
2. Complete email verification, contact information, and payment method (required even for Free Tier).
3. Sign in as **root user** once to enable MFA (recommended immediately).

## 2. Secure the root account

1. In the AWS Console: **IAM** → **Dashboard** → enable **MFA** for the root user (hardware or authenticator app).
2. Do **not** use the root user for day-to-day work.

## 3. Create an IAM admin user (recommended)

1. IAM → **Users** → **Create user**.
2. Attach **AdministratorAccess** (or a tighter policy for production later).
3. Enable **Console access** if you want the web UI; create **access keys** for the CLI.
4. Sign out of root and sign in as this IAM user for normal use.

## 4. Install tools (macOS)

```bash
brew install awscli terraform
```

Optional: [AWS CLI v2 install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) if not using Homebrew.

## 5. Configure AWS CLI

```bash
aws configure
```

Set:

- **AWS Access Key ID** / **Secret Access Key** — from the IAM user (not root).
- **Default region** — `us-east-1` (matches this repo’s defaults).
- **Default output format** — `json`.

Verify:

```bash
aws sts get-caller-identity
```

## 6. Bootstrap Terraform remote state

Terraform state should live in **S3** with **DynamoDB** locking. Create these **once** per account/region (names can be adjusted; update `envs/*/versions.tf` accordingly).

### 6.1 S3 bucket for state

Replace `YOUR_ACCOUNT_ID` if you use a globally unique suffix, or use a unique bucket name:

```bash
export AWS_REGION=us-east-1
export TF_STATE_BUCKET="cardboardforge-tf-state-${YOUR_ACCOUNT_ID}"

aws s3api create-bucket \
  --bucket "${TF_STATE_BUCKET}" \
  --region "${AWS_REGION}"

aws s3api put-bucket-versioning \
  --bucket "${TF_STATE_BUCKET}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${TF_STATE_BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" }
    }]
  }'

aws s3api put-public-access-block \
  --bucket "${TF_STATE_BUCKET}" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### 6.2 DynamoDB table for state locking

```bash
aws dynamodb create-table \
  --table-name cardboardforge-tf-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "${AWS_REGION}"
```

### 6.3 Enable remote backend in Terraform

1. Open `infra/envs/prod/versions.tf`.
2. Confirm the `backend "s3" { ... }` block matches your bucket, region, `key`, and `dynamodb_table`.

Initialize:

```bash
cd infra/envs/prod
terraform init -migrate-state   # if migrating from local state; first time: terraform init
```

## 7. ECR repositories (optional early step)

You can create ECR repos manually or let Terraform create them once the `ecr` module defines `aws_ecr_repository` resources.

Manual example:

```bash
aws ecr create-repository --repository-name cardboardforge-api --region us-east-1
aws ecr create-repository --repository-name cardboardforge-worker --region us-east-1
```

## 8. GitHub Actions (optional)

For `terraform plan` in CI with a real AWS account, add repository secrets (e.g. `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) and use OIDC or a dedicated CI IAM user with least privilege. The included workflow runs `terraform validate` with dummy credentials suitable for an empty skeleton only.

## 9. Local development without AWS

Use Docker Compose for **PostgreSQL** and **LocalStack** (S3/SQS emulation):

```bash
pnpm docker:up
```

Copy `.env.local.example` to `.env.local` when testing the API/worker against Docker Postgres and LocalStack (no real AWS).

## Reference

- [Terraform AWS backend](https://developer.hashicorp.com/terraform/language/settings/backends/s3)
- [LocalStack](https://docs.localstack.cloud/)
