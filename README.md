<h1 align="center">
   CardGoose 🃏🪿
</h1>

<h4 align="center">A tool to make board games for Print & Play and <a href="https://www.tabletopsimulator.com/" target="_blank">Tabletop Simulator.</a></h4>

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- Python 3.x + `boto3` for the worker (`pip install boto3` if needed)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) when using **hybrid** or **production** against real AWS
- Docker — required for **fully local** (Postgres + LocalStack) and useful for optional compose services
- Terraform 1.9+ — for **hybrid** (RDS access from your IP) and **production** (full AWS stack)

---

## Development modes

Pick one path. They differ by **where Postgres and object/queue services run**, not by repo layout.

| Mode            | Frontend | API & worker | Database | Buckets & queue       |
| --------------- | -------- | ------------ | -------- | --------------------- |
| **Fully local** | Your Mac | Your Mac     | Docker   | LocalStack (emulated) |
| **Hybrid**      | Your Mac | Your Mac     | AWS RDS  | AWS S3 & SQS          |
| **Production**  | ECS\*    | ECS          | AWS RDS  | AWS S3 & SQS          |

\*The API container can serve the built SPA in production (`NODE_ENV=production`). Until you add a stable URL (ALB, CloudFront, etc.), you may use the task public IP for smoke tests.

### Fully local (Docker Postgres + LocalStack)

Use this when you want **no AWS calls**: everything emulated or on your machine.

1. **Start backing services** (Postgres on host port **5433**, LocalStack on **4566**):

   ```bash
   pnpm docker:up
   ```

   Optional: `docker compose build` if you use the `api` / `worker` compose services.

2. **Configure** [`.env.local.example`](.env.local.example) → **`.env.local`** at the repo root using the **“full local stack”** block: `DATABASE_URL` pointing at `localhost:5433`, `AWS_ENDPOINT_URL=http://localhost:4566`, and bucket/queue names **`cardgoose-*`** (they must match [`docker-compose.yml`](docker-compose.yml) and [`docker/localstack-ready.d/init-aws.sh`](docker/localstack-ready.d/init-aws.sh)).

3. **Migrations:**

   ```bash
   pnpm migrate:deploy
   ```

4. **Run three processes** (three terminals from the repo root):

   ```bash
   pnpm dev:api
   pnpm dev:frontend
   ```

   ```bash
   cd worker
   PYTHONPATH=src python3 -m baker.main
   ```

5. Open the URL Vite prints (often `http://localhost:5173`).

Do **not** set `VITE_API_URL` in `frontend/.env.local` if the Vite dev server should proxy `/api` and `/health` to `http://localhost:3001` (see [`frontend/vite.config.ts`](frontend/vite.config.ts)).

**PDF exports:** set **`RENDER_URL`** in `.env.local` to the exact origin Vite prints (including port). If the worker runs in Docker and Vite on the host, use something like `http://host.docker.internal:5173`. Restart the worker after changes.

---

### Hybrid (local apps, real AWS)

Use this for day-to-day work: **Vite, the API, and the worker on your laptop** with **real RDS, S3, and SQS** in `us-east-1`. You get hot reload without deploying containers.

**1. Terraform (occasional)** — in [`infra/envs/prod`](infra/envs/prod):

- Allow your laptop to reach RDS: set `rds_dev_access_cidrs` without committing real IPs — e.g. `export TF_VAR_rds_dev_access_cidrs='["YOUR.PUBLIC.IP/32"]'` before `terraform apply`, or copy [`infra/envs/prod/rds.auto.tfvars.example`](infra/envs/prod/rds.auto.tfvars.example) to **`rds.auto.tfvars`** (gitignored). Update when your IP changes.
- Set `ecs_desired_count = 0` for the **worker** service if you run the Python worker locally (avoids two consumers on the same SQS queue and idle Fargate cost).
- Run `terraform apply`.

**2. Root `.env.local`** — copy [`.env.local.example`](.env.local.example) and fill **real** values:

- **`DATABASE_URL`** — RDS host, user `forge`, password from `terraform output -raw rds_master_password`, database name from your RDS instance (by default Terraform uses the `project_name` value, e.g. `cardboardforge`).
- **`S3_BUCKET_ASSETS`**, **`S3_BUCKET_EXPORTS`**, **`SQS_QUEUE_URL`** — from `terraform output` (`assets_bucket_name`, `exports_bucket_name`, `pdf_queue_url`).

Do **not** set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_ENDPOINT_URL` for real AWS: use the default credential chain (`~/.aws/credentials` or SSO).

**3. Frontend:** do **not** set `VITE_API_URL` in `frontend/.env.local` (or remove it) so the dev server proxies to the local API.

**4. Migrations:**

```bash
pnpm migrate:deploy
```

**5. Run** `pnpm dev:api`, `pnpm dev:frontend`, and the worker as in the fully local section.

**Queue contention:** if the **ECS worker** is scaled up, it shares the same SQS URL as your laptop. For predictable local PDF debugging, keep ECS worker desired count at **0** while testing locally.

**Frontend-only against a cloud API:** set `VITE_API_URL=http://<ecs-task-public-ip>:3001` in `frontend/.env.local` and run `pnpm dev:frontend` only. Find the task IP in the ECS console (see [`frontend/.env.local.example`](frontend/.env.local.example)). This is still “hybrid” from the browser’s perspective (local UI, remote API).

**Troubleshooting RDS:** if Prisma cannot connect, confirm your IP is in `rds_dev_access_cidrs`, re-apply Terraform, and that `DATABASE_URL` matches `terraform output -raw rds_endpoint`.

---

### Production (deployed on AWS)

**Production** means the **API and worker run on ECS Fargate**, with **RDS, S3, and SQS** provisioned by Terraform. CI can build and push images and force new deployments (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

1. **Bootstrap and apply** — follow [infra/BOOTSTRAP.md](infra/BOOTSTRAP.md) for remote state, then apply [`infra/envs/prod`](infra/envs/prod). Resource names, buckets, queues, and the RDS database name follow your Terraform variables (defaults in this repo still use the historical `cardboardforge` prefix for AWS resources).

2. **Runtime config** — ECS tasks receive env vars from Terraform (not from `.env.local`). For **one-off Prisma operations** against production RDS (migrations, introspection), copy [`.env.production.example`](.env.production.example) to **`.env.production`** (never commit) with values that match your live stack:

   ```bash
   pnpm migrate:deploy:prod
   ```

3. **Deploys** — pushes to `main` run lint, tests, Terraform validate, Docker builds, and (with secrets configured) ECR push + ECS `update-service --force-new-deployment`. Adjust branch rules in the workflow if your default branch differs.

4. **Smoke checks** — hit `/health` on a running API task; confirm `service` identifies as `cardgoose-api`. Scale worker and API services in ECS per load and cost.

---

## Environment files

| File                                                 | Purpose                                                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`.env.local.example`](.env.local.example)           | Template for **local** dev — copy to **`.env.local`** at the repo root.                                     |
| [`.env.production.example`](.env.production.example) | Template for **production DB / ops** — copy to **`.env.production`** for Prisma and tooling (never commit). |

The API loads **`.env.local`** when `NODE_ENV` is not `production`. Prisma CLI uses `dotenv -e ../.env.local` or `../.env.production` via the `prisma:deploy` scripts. The Baker worker loads the same **`.env.local`** when run locally (`python-dotenv`; existing environment variables win).

If you still have a single **`.env`** from an older setup, merge into `.env.local` and remove `.env`.

**Docker Compose API:** `docker compose up api` runs `prisma migrate deploy` before `node` (see [`docker-compose.yml`](docker-compose.yml)).

---

## Checks

```bash
pnpm run format:check
pnpm -r run lint
pnpm test:all
cd infra && terraform fmt -check -recursive
cd infra/envs/prod && terraform init -input=false && terraform validate
```
