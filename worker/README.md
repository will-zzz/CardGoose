# CardboardForge Baker (worker)

Python worker that consumes SQS jobs and renders PDFs / TTS assets via Playwright.

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
