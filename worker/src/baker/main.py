"""Entry point for the Baker worker (SQS consumer)."""

from __future__ import annotations

import logging
import os
import signal
import sys

from baker.queue import poll_forever

_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
_root_level = getattr(logging, _level_name, logging.INFO)
logging.basicConfig(
    level=_root_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("baker.main")


def main() -> None:
    stop = False

    def _handle_sig(_signum, _frame) -> None:
        nonlocal stop
        log.info("Shutdown requested")
        stop = True

    signal.signal(signal.SIGINT, _handle_sig)
    signal.signal(signal.SIGTERM, _handle_sig)

    log.info("cardboardforge-baker starting")
    # poll_forever blocks; for graceful shutdown we'd need threading or async — MVP: simple loop
    poll_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
