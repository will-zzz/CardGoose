"""SQS long-poll consumer."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Callable

import boto3

from baker.handler import handle_export_job

logger = logging.getLogger(__name__)


def _client_kwargs() -> dict[str, Any]:
    endpoint = os.environ.get("AWS_ENDPOINT_URL")
    region = os.environ.get("AWS_REGION", "us-east-1")
    kw: dict[str, Any] = {"region_name": region}
    if endpoint:
        kw["endpoint_url"] = endpoint
    key = os.environ.get("AWS_ACCESS_KEY_ID")
    secret = os.environ.get("AWS_SECRET_ACCESS_KEY")
    if key and secret:
        kw["aws_access_key_id"] = key
        kw["aws_secret_access_key"] = secret
    return kw


def _queue_url() -> str:
    import os

    u = os.environ.get("SQS_QUEUE_URL")
    if not u:
        raise RuntimeError("SQS_QUEUE_URL is not set")
    return u


def poll_forever(
    handler: Callable[[dict[str, Any]], None] = handle_export_job,
    *,
    wait_seconds: int = 20,
    sleep_on_error_seconds: float = 5.0,
) -> None:
    sqs = boto3.client("sqs", **_client_kwargs())
    url = _queue_url()
    logger.info("Polling queue %s", url)

    while True:
        try:
            resp = sqs.receive_message(
                QueueUrl=url,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=wait_seconds,
                VisibilityTimeout=60,
            )
            messages = resp.get("Messages") or []
            if not messages:
                continue
            for msg in messages:
                receipt = msg["ReceiptHandle"]
                raw = msg.get("Body") or "{}"
                try:
                    payload = json.loads(raw)
                    if isinstance(payload, dict):
                        logger.info(
                            "Received export job message keys=%s projectId=%s userId=%s",
                            list(payload.keys()),
                            payload.get("projectId"),
                            payload.get("userId"),
                        )
                        handler(payload)
                    else:
                        raise ValueError("Message body must be a JSON object")
                    sqs.delete_message(QueueUrl=url, ReceiptHandle=receipt)
                    logger.info("Processed and deleted message from queue")
                except Exception:
                    logger.exception("Handler failed; message will become visible again")
        except Exception:
            logger.exception("receive_message failed; backing off")
            time.sleep(sleep_on_error_seconds)
