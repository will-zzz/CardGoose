# CardboardForge (Cardboard Forge)

Board game prototyping engine: data-driven design, Print & Play PDFs, and Tabletop Simulator exports.

## Monorepo layout

| Path       | Description                          |
| ---------- | ------------------------------------ |
| `frontend` | Vite + React + Tailwind (dashboard)  |
| `api`      | Node.js API (Express, Prisma, AWS)   |
| `worker`   | Python "Baker" (Playwright rendering) |
| `infra`    | Terraform (AWS)                      |

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- Python 3.x + `boto3` (worker; `pip install boto3` if needed)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured (`~/.aws/credentials`) for real AWS
- Docker — only if you use the **Docker + LocalStack** path below
- Terraform 1.9+ — for infra and for opening RDS to your laptop (hybrid path)

## Quick start

```bash
pnpm install
pnpm dev:frontend
```

See [infra/BOOTSTRAP.md](infra/BOOTSTRAP.md) for AWS account and Terraform state setup.

## Local development (hybrid — real AWS)

Use this for day-to-day work: **Vite, the API, and the worker all run on your machine**, but they use **real RDS, S3, and SQS** in `us-east-1`. You get hot reload and fast restarts without deploying containers.

**1. One-time / occasional Terraform** ([`infra/envs/prod`](infra/envs/prod)):

- Set `rds_dev_access_cidrs` in `terraform.tfvars` to one or more public IPs as `/32` (e.g. from `curl -s https://checkip.amazonaws.com`)—for example home and school Wi‑Fi. Update entries when your IP changes.
- Set `ecs_desired_count = 0` so Fargate tasks are not running (avoids paying for idle services and avoids a second consumer on the same SQS queue while you run the worker locally).
- Run `terraform apply`.

**2. Root `.env.local`**

Copy [`.env.local.example`](.env.local.example) to **`.env.local`** and fill it with real values:

- `DATABASE_URL` — RDS host, user `forge`, password from `cd infra/envs/prod && terraform output -raw rds_master_password`, database `cardboardforge`.
- `S3_BUCKET_ASSETS`, `S3_BUCKET_EXPORTS`, `SQS_QUEUE_URL` — from `terraform output` (`assets_bucket_name`, `exports_bucket_name`, `pdf_queue_url`).

Do **not** set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_ENDPOINT_URL` here: the Node API and boto3 use the **default credential chain** (`~/.aws/credentials`).

**3. Do not set `VITE_API_URL` in `frontend/.env.local`** (or remove that file). The Vite dev server proxies `/api` and `/health` to `http://localhost:3001` ([`frontend/vite.config.ts`](frontend/vite.config.ts)).

**4. Apply migrations once** (or whenever the schema changes):

```bash
pnpm migrate:deploy
```

**5. Run three processes** (three terminals from the repo root):

```bash
# Terminal 1 — API
pnpm dev:api

# Terminal 2 — frontend
pnpm dev:frontend
```

Open the URL Vite prints (often `http://localhost:5173`).

```bash
# Terminal 3 — worker (reads S3_BUCKET_EXPORTS, SQS_QUEUE_URL, AWS_REGION, etc. from repo `.env.local`)
cd worker
PYTHONPATH=src python3 -m baker.main
```

Variables already set in your shell override `.env.local`. Set `LOG_LEVEL=DEBUG` (or another level) in `.env.local` or prefix the command if you want more verbose worker logs.

**What is local vs cloud:** the browser, Vite, Node API, and Python worker are **local**. RDS, S3, and SQS are **AWS**. The API talks to RDS, S3, and SQS; the worker polls SQS and writes export artifacts to S3.

**PDF export:** add **`RENDER_URL`** to `.env.local` (no trailing slash). It must be the **exact origin Vite prints** (e.g. `Local: http://localhost:5174/` when port 5173 is already in use—if Playwright points at the wrong port, the job can hang until timeout and nothing new appears in S3). Use `http://host.docker.internal:5174` if the worker runs in Docker and Vite on the host. Restart the worker after changing it.

**Same SQS queue as production:** your `.env.local` often uses the **prod** `SQS_QUEUE_URL`. If the **ECS worker** service in AWS is running (`desired_count` ≥ 1), it **shares the queue** with your laptop—messages may be processed in the cloud (or fail there) while your local worker sits idle with no logs. For local PDF debugging, set the ECS **worker** service desired count to **0** (console or Terraform), then run `PYTHONPATH=src python3 -m baker.main` locally. Scale ECS back up when done.

If exports stay empty: check **SQS** approximate messages visible / in flight in the AWS console, **CloudWatch** logs for the ECS worker task, and local worker logs for `SQS message:` / `PDF render start`.

**Smoke test (legacy JSON):** the old `POST /export` path still enqueues a tiny JSON status file for queue testing.

**If Prisma cannot reach RDS** (`Can't reach database server at …rds.amazonaws.com`): add your current public IP as a `/32` entry in `rds_dev_access_cidrs` in `infra/envs/prod/terraform.tfvars`, run `terraform apply`, and confirm `DATABASE_URL` in `.env.local` matches `terraform output -raw rds_endpoint`.

## Local development (Docker + LocalStack)

Use this if you want **everything** emulated locally (no AWS calls from the API/worker):

```bash
pnpm docker:up
# optional: build API + worker images
docker compose build
```

Then follow [`.env.local.example`](.env.local.example) for `DATABASE_URL` pointing at Docker Postgres, `AWS_ENDPOINT_URL=http://localhost:4566`, and LocalStack bucket/queue names. Run `pnpm migrate:deploy`, then `pnpm dev:api`, the worker, and `pnpm dev:frontend` as in the hybrid section.

## Environment files

| File | Purpose |
| ---- | ------- |
| [`.env.local.example`](.env.local.example) | Template for **local** dev — copy to **`.env.local`** at the repo root. |
| [`.env.production.example`](.env.production.example) | Template for **AWS** — copy to **`.env.production`** for Prisma against RDS or tooling (never commit). |

The API loads **`.env.local`** in development (`NODE_ENV !== production`). Prisma CLI uses `dotenv -e ../.env.local` (or `../.env.production` via `pnpm migrate:deploy:prod`). The Baker worker loads the same **`.env.local`** at the repo root when you run it locally (via `python-dotenv`; variables already in the environment still win).

If you still have a single **`.env`** from an older setup, rename it to **`.env.local`** (or merge into `.env.local` and delete `.env`).

**Docker Compose API:** `docker compose up api` runs `prisma migrate deploy` before `node` (see [`docker-compose.yml`](docker-compose.yml)).

**Frontend-only against a cloud API:** set `VITE_API_URL=http://<ecs-task-public-ip>:3001` in `frontend/.env.local` and run `pnpm dev:frontend` only (no local API). Until you add an ALB, the task public IP can change on redeploy.

## Checks

```bash
pnpm run format:check
pnpm -r run lint
pnpm test:all
cd infra && terraform fmt -check -recursive
cd infra/envs/prod && terraform init -input=false && terraform validate
```
