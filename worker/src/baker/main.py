"""Entry point for the Baker worker (SQS consumer)."""

from __future__ import annotations

import logging
import os
import signal
import sys
import threading
from pathlib import Path

from baker.queue import poll_forever


def _find_env_local_file() -> Path | None:
    """Walk up from this file until `.env.local` exists (repo root in a normal clone)."""
    p = Path(__file__).resolve().parent
    for _ in range(12):
        candidate = p / ".env.local"
        if candidate.is_file():
            return candidate
        if p.parent == p:
            return None
        p = p.parent
    return None


def _load_repo_env_local() -> None:
    """Load `.env.local` so local runs match the API without extra exports."""
    path = _find_env_local_file()
    if path is None:
        return
    try:
        from dotenv import load_dotenv
    except ImportError as e:
        raise RuntimeError(
            "Found .env.local but python-dotenv is not installed. "
            "From the worker directory run: pip install -r requirements.txt"
        ) from e
    load_dotenv(path, override=False)


_load_repo_env_local()

_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
_root_level = getattr(logging, _level_name, logging.INFO)
logging.basicConfig(
    level=_root_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("baker.main")


def main() -> None:
    shutdown = threading.Event()

    def _handle_sig(_signum, _frame) -> None:
        log.info("Shutdown requested")
        shutdown.set()

    signal.signal(signal.SIGINT, _handle_sig)
    signal.signal(signal.SIGTERM, _handle_sig)

    log.info("cardboardforge-baker starting")
    poll_forever(shutdown_event=shutdown)
    log.info("cardboardforge-baker stopped")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
