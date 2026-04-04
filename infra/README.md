# Infrastructure (Terraform)

- **Modules**: [`modules/`](modules/) — VPC, ECS, ECR, RDS, S3, SQS, IAM, CloudWatch (placeholders).
- **Environments**: [`envs/dev`](envs/dev), [`envs/prod`](envs/prod).

## Usage

From an environment directory:

```bash
cd envs/dev
terraform init
terraform validate
terraform plan
```

Configure remote state and AWS credentials per [BOOTSTRAP.md](BOOTSTRAP.md).

The root-level `providers.tf` / `backend.tf` mentioned in early docs live in each `envs/*` directory (`providers.tf`, `versions.tf` with optional S3 backend).
