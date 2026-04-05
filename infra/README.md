# Infrastructure (Terraform)

- **Modules**: [`modules/`](modules/) — VPC, ECS, ECR, RDS, S3, SQS, IAM, CloudWatch.
- **AWS stack**: [`envs/prod`](envs/prod) — single Terraform workspace (local dev is not Terraform).

## Usage

```bash
cd envs/prod
terraform init
terraform validate
terraform plan
```

Configure remote state and AWS credentials per [BOOTSTRAP.md](BOOTSTRAP.md).

The root-level `providers.tf` / `backend.tf` mentioned in early docs live in each `envs/*` directory (`providers.tf`, `versions.tf` with optional S3 backend).
