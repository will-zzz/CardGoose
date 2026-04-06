"""Entry point for the Baker worker (SQS consumer)."""

from __future__ import annotations

import logging
import os
import signal
import sys
import threading

from baker.env import load_repo_env_local
from baker.logging_config import configure_worker_logging
from baker.queue import poll_forever

load_repo_env_local()
configure_worker_logging()

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
