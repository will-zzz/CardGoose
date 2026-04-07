# CI/CD: push `main` → AWS

The workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs tests and, on **push to `main`** or **workflow_dispatch** on `main`, deploys:

1. **Docker** images → **ECR** (`:latest` + `:$GITHUB_SHA`) for `api` and `worker`
2. **ECS** — `UpdateService` with `--force-new-deployment` for API and worker services

The **API image** is built from [`api/Dockerfile`](../api/Dockerfile): it runs `pnpm` builds for **api** and **frontend**, copies `frontend/dist` into `api/dist/public`, and the Express server serves the SPA + `/api/*` on port **3001**. The **ALB** is the only public URL — **no CloudFront or separate static bucket**.

Browsers open **`terraform output -raw public_api_url`** (HTTP `http://<alb-dns>/`). Do **not** set `VITE_API_URL` in production builds so the SPA calls `/api` same-origin.

## One-time: Terraform

From `infra/envs/prod`:

```bash
terraform apply
```

This creates the ALB, ECS, RDS, S3 (assets/exports), SQS, etc. Applying after removing the old CloudFront module will **destroy** the previous web distribution and web bucket.

## GitHub repository secrets

Create these in **Settings → Secrets and variables → Actions** (repository secrets):

| Secret | Example source |
|--------|----------------|
| `AWS_ACCESS_KEY_ID` | IAM user or role access key for deploy |
| `AWS_SECRET_ACCESS_KEY` | Same |
| `ECR_API_REPOSITORY_URL` | `terraform output -raw ecr_api_repository_url` |
| `ECR_WORKER_REPOSITORY_URL` | `terraform output -raw ecr_worker_repository_url` |
| `ECS_CLUSTER_NAME` | `terraform output -raw ecs_cluster_name` |
| `ECS_API_SERVICE_NAME` | `terraform output -raw ecs_api_service_name` |
| `ECS_WORKER_SERVICE_NAME` | `terraform output -raw ecs_worker_service_name` |

Use a dedicated IAM user with least privilege: ECR push to both repos, `ecs:UpdateService` / `DescribeServices` on the cluster services.

`FRONTEND_S3_BUCKET` and `CLOUDFRONT_DISTRIBUTION_ID` are **no longer used**.

## First successful deploy

- ECR repositories must exist (Terraform `module.ecr`).
- Push images at least once (workflow or manual `docker push`) so `:latest` exists before ECS can pull.
- Run database migrations: ECS API container runs `prisma migrate deploy` on start (see `api/Dockerfile`).
