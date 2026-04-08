# CardGoose Baker (worker)

Python worker that consumes SQS jobs and renders **Print & Play PDFs** (via Playwright + `/render`) or legacy JSON test artifacts.

### PDF export (`export-pdf`)

Set **`RENDER_URL`** to the origin of your Vite app (no trailing slash), e.g. `http://host.docker.internal:5173` when the worker runs in Docker and the dev server on the host. The worker loads `{RENDER_URL}/render` and drives `window.__CF_RENDER_CARD__` to rasterize each card, then stitches pages with no gaps between cards.

Install (local):

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Run (from `worker/`; walks up to the first **`.env.local`** and loads it with `python-dotenv` — same keys as the API, e.g. `S3_BUCKET_EXPORTS`, `SQS_QUEUE_URL`, `AWS_REGION`). You must have run **`pip install -r requirements.txt`** for that interpreter (system Python counts).

```bash
PYTHONPATH=src python3 -m baker.main
```

Run tests:

```bash
pytest
```
