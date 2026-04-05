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

- Set `rds_dev_access_cidr` in `terraform.tfvars` to your public IP as `/32` (e.g. from `curl -s https://checkip.amazonaws.com`). Update it if your ISP changes your IP.
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
# Terminal 3 — worker (values must match .env.local)
cd worker
AWS_REGION=us-east-1 \
S3_BUCKET_EXPORTS=<same as S3_BUCKET_EXPORTS in .env.local> \
SQS_QUEUE_URL=<same as SQS_QUEUE_URL in .env.local> \
LOG_LEVEL=INFO \
PYTHONPATH=src \
python3 -m baker.main
```

**What is local vs cloud:** the browser, Vite, Node API, and Python worker are **local**. RDS, S3, and SQS are **AWS**. The API talks to RDS, S3, and SQS; the worker polls SQS and writes export artifacts to S3.

**Smoke test:** register, create a project, upload a file, **Trigger export**. With the worker running, the export list should show a JSON result after a few seconds.

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

The API loads **`.env.local`** in development (`NODE_ENV !== production`). Prisma CLI uses `dotenv -e ../.env.local` (or `../.env.production` via `pnpm migrate:deploy:prod`).

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
