"""One-shot PDF export for API subprocess: python -m baker.run_pdf_sync <payload.json>"""

from __future__ import annotations

import json
import sys

from baker.env import load_repo_env_local
from baker.logging_config import configure_worker_logging

load_repo_env_local()
configure_worker_logging()


def main() -> None:
    from baker.handler import _handle_pdf_export

    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "usage: run_pdf_sync <payload.json>"}), flush=True)
        sys.exit(2)
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    if not isinstance(payload, dict):
        print(json.dumps({"ok": False, "error": "payload must be a JSON object"}), flush=True)
        sys.exit(2)
    out_key = _handle_pdf_export(payload)
    print(json.dumps({"ok": True, "s3Key": out_key}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}), flush=True)
        sys.exit(1)
