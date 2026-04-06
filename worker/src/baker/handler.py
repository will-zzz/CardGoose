"""Process export jobs: PDF pipeline or legacy JSON stub."""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import boto3

from baker.renderer import render_card_pngs
from baker.stitcher import stitch_pdf

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


def _load_full_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Inline export-pdf body, or fetch JSON from S3 when only payloadS3Key was queued."""
    key = payload.get("payloadS3Key")
    if not key:
        return payload
    s3 = boto3.client("s3", **_client_kwargs())
    bucket = _exports_bucket()
    obj = s3.get_object(Bucket=bucket, Key=str(key))
    raw = obj["Body"].read()
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("payload S3 object must be a JSON object")
    try:
        s3.delete_object(Bucket=bucket, Key=str(key))
        logger.info("Deleted payload object s3://%s/%s", bucket, key)
    except Exception:
        logger.exception("Failed to delete payload key %s (non-fatal)", key)
    return data


def _handle_pdf_export(payload: dict[str, Any]) -> str:
    project_id = payload.get("projectId")
    user_id = payload.get("userId")
    ts = payload.get("timestamp") or datetime.now(timezone.utc).isoformat()
    if not project_id or not user_id:
        raise ValueError("projectId and userId are required")

    logger.info("PDF export start projectId=%s userId=%s", project_id, user_id)
    t_png = time.perf_counter()
    pngs = render_card_pngs(payload)
    logger.info(
        "PDF rasterize done cards=%s elapsed_ms=%.1f",
        len(pngs),
        (time.perf_counter() - t_png) * 1000.0,
    )
    t_pdf = time.perf_counter()
    pdf_bytes = stitch_pdf(pngs, payload)
    logger.info(
        "PDF stitch done elapsed_ms=%.1f out_bytes=%s",
        (time.perf_counter() - t_pdf) * 1000.0,
        len(pdf_bytes),
    )

    processed_at = datetime.now(timezone.utc).isoformat()
    out_key = f"{project_id}/{processed_at.replace(':', '-')}.pdf"
    s3 = boto3.client("s3", **_client_kwargs())
    bucket = _exports_bucket()
    s3.put_object(
        Bucket=bucket,
        Key=out_key,
        Body=pdf_bytes,
        ContentType="application/pdf",
    )
    logger.info("Uploaded PDF export to s3://%s/%s bytes=%s", bucket, out_key, len(pdf_bytes))
    return out_key


def _handle_legacy_json_stub(payload: dict[str, Any]) -> None:
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


def _is_pdf_job(payload: dict[str, Any]) -> bool:
    """PDF jobs set type=export-pdf and include groups; tolerate missing type if body came from S3."""
    if payload.get("type") == "export-pdf":
        return True
    groups = payload.get("groups")
    if isinstance(groups, list) and len(groups) > 0:
        return True
    return False


def handle_export_job(payload: dict[str, Any]) -> None:
    """Dispatch by message type."""
    if payload.get("payloadS3Key"):
        payload = _load_full_payload(payload)

    logger.info(
        "dispatch keys=%s type=%s is_pdf=%s",
        list(payload.keys())[:20],
        payload.get("type"),
        _is_pdf_job(payload),
    )

    if _is_pdf_job(payload):
        _handle_pdf_export(payload)
        return

    _handle_legacy_json_stub(payload)
