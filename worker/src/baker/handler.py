"""Process export jobs: write a small JSON artifact to the exports bucket."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import boto3

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


def _exports_bucket() -> str:
    b = os.environ.get("S3_BUCKET_EXPORTS")
    if not b:
        raise RuntimeError("S3_BUCKET_EXPORTS is not set")
    return b


def handle_export_job(payload: dict[str, Any]) -> None:
    """Upload a JSON result for the given project export message."""
    project_id = payload.get("projectId")
    user_id = payload.get("userId")
    ts = payload.get("timestamp") or datetime.now(timezone.utc).isoformat()

    if not project_id or not user_id:
        raise ValueError("projectId and userId are required in message body")

    processed_at = datetime.now(timezone.utc).isoformat()
    body = {
        "status": "complete",
        "projectId": project_id,
        "userId": user_id,
        "requestedAt": ts,
        "processedAt": processed_at,
    }

    key = f"{project_id}/{processed_at.replace(':', '-')}.json"
    data = json.dumps(body, indent=2).encode("utf-8")

    s3 = boto3.client("s3", **_client_kwargs())
    bucket = _exports_bucket()
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType="application/json",
    )
    logger.info("Uploaded export to s3://%s/%s", bucket, key)
