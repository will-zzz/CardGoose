# ForgeCard Baker (worker)

Python worker that consumes SQS jobs and renders PDFs / TTS assets via Playwright.

Install (local):

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Run tests:

```bash
pytest
```
