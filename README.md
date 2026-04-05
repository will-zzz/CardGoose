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
- Python 3.12+ (worker)
- Docker (local Postgres, LocalStack)
- Terraform 1.9+ (infrastructure)

## Quick start

```bash
pnpm install
pnpm dev:frontend
```

Local infrastructure (requires [Docker](https://docs.docker.com/get-docker/) running):

```bash
pnpm docker:up
# optional: build API + worker images
docker compose build
```

See [infra/BOOTSTRAP.md](infra/BOOTSTRAP.md) for AWS account and Terraform state setup.

## Environment files

| File | Purpose |
| ---- | ------- |
| [`.env.local.example`](.env.local.example) | Template for **local** dev — copy to **`.env.local`** at the repo root. |
| [`.env.production.example`](.env.production.example) | Template for **AWS** — copy to **`.env.production`** for Prisma against RDS or tooling (never commit). |

The API loads **`.env.local`** in development (`NODE_ENV !== production`). Prisma CLI uses `dotenv -e ../.env.local` (or `../.env.production` via `pnpm migrate:deploy:prod`).

If you still have a single **`.env`** from an older setup, rename it to **`.env.local`** (or merge into `.env.local` and delete `.env`).

## MVP test harness (local)

1. Copy [`.env.local.example`](.env.local.example) to **`.env.local`** and adjust if needed (defaults match Docker Compose + LocalStack).
2. Start Postgres + LocalStack (init script creates S3 buckets + SQS queue):

   ```bash
   pnpm docker:up
   ```

3. Apply DB migrations and run processes in separate terminals. From the repo root:

   ```bash
   pnpm migrate:deploy
   pnpm dev:api
   cd worker && PYTHONPATH=src python3 -m baker.main
   pnpm dev:frontend
   ```

   Or from `api/`: `pnpm prisma:deploy` (loads `../.env.local`).

4. Open `http://localhost:5173` — register, create a project, upload a file, **Trigger export**. With the worker running, the export list should show a JSON download link after a few seconds.

**Docker Compose API:** `docker compose up api` runs `prisma migrate deploy` before `node` (see [`docker-compose.yml`](docker-compose.yml)).

**Deploy API + worker to AWS:** rebuild/push ECR images, then `aws ecs update-service --force-new-deployment` on both services. Point the frontend at the API with `VITE_API_URL=http://<ecs-task-public-ip>:3001 pnpm dev:frontend` until you add an ALB.

## Checks

```bash
pnpm run format:check
pnpm -r run lint
pnpm test:all
cd infra && terraform fmt -check -recursive
cd infra/envs/prod && terraform init -input=false && terraform validate
```
