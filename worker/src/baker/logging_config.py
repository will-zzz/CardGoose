"""Shared logging setup for `baker.main` and `baker.run_pdf_sync`."""

from __future__ import annotations

import logging
import os


def configure_worker_logging() -> None:
    """
    Configure root logging for baker. Keeps AWS SDK loggers quiet so INFO lines from
    `baker.*` stay visible when LOG_LEVEL=DEBUG.
    """
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    if not logging.root.handlers:
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )
    else:
        logging.root.setLevel(level)

    # Boto/urllib3 at DEBUG drowns out everything on every SQS poll / S3 call.
    for name in ("boto3", "botocore", "urllib3", "s3transfer"):
        logging.getLogger(name).setLevel(logging.WARNING)
