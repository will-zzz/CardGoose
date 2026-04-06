# CI/CD: push `main` → AWS

The workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs tests and, on **push to `main` only**, deploys:

1. **Docker** images → **ECR** (`:latest` + `:$GITHUB_SHA`) for `api` and `worker`
2. **ECS** — `UpdateService` with `--force-new-deployment` for API and worker services
3. **Frontend** — `pnpm --filter frontend build`, then `aws s3 sync` to the static bucket, then **CloudFront** invalidation `/*`

Browsers load the app from **HTTPS CloudFront**; `/api/*` and `/health` are proxied to the **ALB** (see `modules/frontend_static`). Do **not** set `VITE_API_URL` in production builds so requests stay same-origin.

## One-time: Terraform

From `infra/envs/prod`:

```bash
terraform apply
```

This creates the ALB, CloudFront + S3 web bucket, and wires ECS (including `CORS_ORIGIN` and worker `RENDER_URL` to the CloudFront URL).

## GitHub repository secrets

Create these in **Settings → Secrets and variables → Actions** (repository secrets):

| Secret | Example source |
|--------|----------------|
| `AWS_ACCESS_KEY_ID` | IAM user or role access key for deploy |
| `AWS_SECRET_ACCESS_KEY` | Same |
| `ECR_API_REPOSITORY_URL` | `terraform output -raw ecr_api_repository_url` |
| `ECR_WORKER_REPOSITORY_URL` | `terraform output -raw ecr_worker_repository_url` |
| `ECS_CLUSTER_NAME` | `terraform output -raw ecs_cluster_name` |
| `ECS_API_SERVICE_NAME` | `terraform output -raw ecs_api_service_name` (add output if missing — see below) |
| `ECS_WORKER_SERVICE_NAME` | `terraform output -raw ecs_worker_service_name` |
| `FRONTEND_S3_BUCKET` | `terraform output -raw frontend_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `terraform output -raw cloudfront_distribution_id` |

Use a dedicated IAM user with least privilege: ECR push to both repos, `ecs:UpdateService`/`DescribeServices` on the cluster services, `s3:PutObject`/`DeleteObject`/`ListBucket` on the web bucket, `cloudfront:CreateInvalidation` for the distribution.

## ECS service name outputs

If `ecs_api_service_name` is not in Terraform outputs, add to `infra/envs/prod/outputs.tf`:

```hcl
output "ecs_api_service_name" {
  value = module.ecs.api_service_name
}
```

(The ECS module already exposes `api_service_name`.)

## First successful deploy

- ECR repositories must exist (Terraform `module.ecr`).
- Push images at least once (workflow or manual `docker push`) so `:latest` exists before ECS can pull.
- Run database migrations: ECS API container runs `prisma migrate deploy` on start (see `api/Dockerfile`).
