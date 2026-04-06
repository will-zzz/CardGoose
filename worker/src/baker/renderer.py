"""Headless browser rendering (Playwright) for card faces — mirrors /render route."""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

logger = logging.getLogger(__name__)

# Per-step ceiling (goto, wait __CF_RENDER_READY__, wait __CF_HEADLESS_DONE__). Default 10s; override with PDF_RENDER_STEP_TIMEOUT_MS.
_DEFAULT_STEP_TIMEOUT_MS = 10_000


def _step_timeout_ms() -> int:
    raw = os.environ.get("PDF_RENDER_STEP_TIMEOUT_MS", "").strip()
    if not raw:
        return _DEFAULT_STEP_TIMEOUT_MS
    try:
        v = int(raw)
    except ValueError:
        return _DEFAULT_STEP_TIMEOUT_MS
    return max(1_000, min(v, 120_000))


def _elapsed_ms(start_perf: float) -> float:
    return (time.perf_counter() - start_perf) * 1000.0


def _attach_diag_listeners(page: Any) -> None:
    """Forward browser console lines tagged [CF]; log page errors and failed requests (PDF debug)."""

    def _on_console(msg: Any) -> None:
        try:
            text = msg.text
        except Exception:
            text = str(msg)
        if "[CF]" in text:
            logger.info("browser %s", text)

    def _on_page_error(exc: Any) -> None:
        logger.error("browser_page_error %s", exc)

    def _on_request_failed(req: Any) -> None:
        try:
            u = req.url
            f = req.failure
            logger.debug("browser_request_failed url=%s failure=%s", u, f)
        except Exception:
            logger.debug("browser_request_failed (could not read request)")

    page.on("console", _on_console)
    page.on("pageerror", _on_page_error)
    page.on("requestfailed", _on_request_failed)


def _render_url() -> str:
    base = os.environ.get("RENDER_URL", "").strip().rstrip("/")
    if not base:
        raise RuntimeError(
            "RENDER_URL is not set (e.g. https://app.example.com or http://host.docker.internal:5173)",
        )
    return base


def _wait_render_ready(page: Any, base: str, *, label: str, timeout_ms: int) -> None:
    t0 = time.perf_counter()
    logger.info("render_phase %s step=goto url=%s/render timeout_ms=%s", label, base, timeout_ms)
    page.goto(f"{base}/render", wait_until="domcontentloaded", timeout=timeout_ms)
    logger.info(
        "render_phase %s step=goto_done elapsed_ms=%.1f",
        label,
        _elapsed_ms(t0),
    )
    t1 = time.perf_counter()
    logger.info("render_phase %s step=wait_ready (__CF_RENDER_READY__)", label)
    page.wait_for_function(
        "() => window.__CF_RENDER_READY__ === true",
        timeout=timeout_ms,
    )
    logger.info(
        "render_phase %s step=wait_ready_done elapsed_ms=%.1f total_since_goto_ms=%.1f",
        label,
        _elapsed_ms(t1),
        _elapsed_ms(t0),
    )


def _context_destroyed(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "execution context was destroyed" in msg or "target closed" in msg or "navigation" in msg


def render_card_pngs(payload: dict[str, Any]) -> list[bytes]:
    """
    For each row in each group, render one card via a `cf-render` CustomEvent and screenshot the canvas.

    Uses a short synchronous `page.evaluate` (dispatch only) plus `wait_for_function` for completion,
    so Playwright does not hold a long-lived async evaluate across React/Konva work (avoids
    "Execution context was destroyed" on Vite HMR / navigation).
    """
    base = _render_url()
    dpi = int(payload.get("dpi") or 300)
    groups: list[dict[str, Any]] = payload.get("groups") or []
    asset_urls: dict[str, str] = payload.get("assetUrls") or {}

    pngs: list[bytes] = []
    total_rows = sum(len(g.get("rows") or []) for g in groups)
    t_job = time.perf_counter()
    step_ms = _step_timeout_ms()
    logger.info(
        "pdf_render_start RENDER_URL=%s groups=%s total_rows=%s dpi=%s step_timeout_ms=%s",
        base,
        len(groups),
        total_rows,
        dpi,
        step_ms,
    )

    with sync_playwright() as p:
        t_launch = time.perf_counter()
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-dev-shm-usage",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        )
        logger.info("browser_launch elapsed_ms=%.1f", _elapsed_ms(t_launch))
        page = browser.new_page(device_scale_factor=1)
        _attach_diag_listeners(page)
        try:
            _wait_render_ready(page, base, label="initial", timeout_ms=step_ms)

            card_index = 0
            for gi, g in enumerate(groups):
                layout = g.get("layout") or {}
                rows = g.get("rows") or []
                group_name = str(g.get("name") or f"group_{gi}")
                lw = float(layout.get("width") or 250)
                lh = float(layout.get("height") or 350)
                pixel_w = max(32, int(round(lw * dpi / 96.0)))
                n_assets = len(asset_urls)

                for ri, row in enumerate(rows):
                    eval_payload = {
                        "layout": layout,
                        "row": row,
                        "assetUrls": asset_urls,
                        "pixelWidth": pixel_w,
                    }
                    max_attempts = 3
                    for attempt in range(max_attempts):
                        try:
                            t_card = time.perf_counter()
                            logger.info(
                                "card_begin card_index=%s group=%s row_in_group=%s pixel_w=%s "
                                "n_asset_urls=%s attempt=%s",
                                card_index,
                                group_name,
                                ri,
                                pixel_w,
                                n_assets,
                                attempt + 1,
                            )

                            t_dispatch = time.perf_counter()
                            page.evaluate(
                                """
                                (p) => {
                                  window.__CF_HEADLESS_DONE = false;
                                  window.__CF_HEADLESS_ERROR = null;
                                  window.dispatchEvent(new CustomEvent('cf-render', { detail: p }));
                                }
                                """,
                                eval_payload,
                            )
                            logger.info(
                                "card_phase card_index=%s step=dispatch_event elapsed_ms=%.1f",
                                card_index,
                                _elapsed_ms(t_dispatch),
                            )

                            t_wait = time.perf_counter()
                            logger.info(
                                "card_phase card_index=%s step=wait_headless_done timeout_ms=%s",
                                card_index,
                                step_ms,
                            )
                            page.wait_for_function(
                                "() => window.__CF_HEADLESS_DONE === true",
                                timeout=step_ms,
                            )
                            logger.info(
                                "card_phase card_index=%s step=wait_headless_done elapsed_ms=%.1f",
                                card_index,
                                _elapsed_ms(t_wait),
                            )

                            t_err = time.perf_counter()
                            err = page.evaluate(
                                "() => window.__CF_HEADLESS_ERROR || null",
                            )
                            logger.info(
                                "card_phase card_index=%s step=read_error elapsed_ms=%.1f",
                                card_index,
                                _elapsed_ms(t_err),
                            )
                            if err:
                                raise RuntimeError(str(err))

                            t_shot = time.perf_counter()
                            canvas = page.locator("canvas").first
                            png = canvas.screenshot(type="png")
                            logger.info(
                                "card_phase card_index=%s step=screenshot elapsed_ms=%.1f png_bytes=%s",
                                card_index,
                                _elapsed_ms(t_shot),
                                len(png),
                            )

                            pngs.append(png)
                            logger.info(
                                "card_done card_index=%s group=%s total_elapsed_ms=%.1f job_elapsed_ms=%.1f",
                                card_index,
                                group_name,
                                _elapsed_ms(t_card),
                                _elapsed_ms(t_job),
                            )
                            card_index += 1
                            break
                        except RuntimeError:
                            raise
                        except PlaywrightError as ex:
                            if attempt + 1 < max_attempts and _context_destroyed(ex):
                                logger.warning(
                                    "render retry after context loss card_index=%s attempt=%s err=%s",
                                    card_index,
                                    attempt + 1,
                                    ex,
                                )
                                _wait_render_ready(
                                    page,
                                    base,
                                    label=f"retry card_index={card_index}",
                                    timeout_ms=step_ms,
                                )
                                continue
                            logger.error(
                                "card_fail card_index=%s group=%s row_in_group=%s after_ms=%.1f err=%s",
                                card_index,
                                group_name,
                                ri,
                                _elapsed_ms(t_card),
                                ex,
                            )
                            raise
        finally:
            browser.close()

    n = len(pngs)
    total_ms = _elapsed_ms(t_job)
    logger.info(
        "pdf_render_done cards_rendered=%s total_elapsed_ms=%.1f avg_ms_per_card=%.1f "
        "(sequential Playwright screenshots; total ~= N × per-card cost; use lower dpi or EXPORT_PDF_DPI)",
        n,
        total_ms,
        total_ms / n if n else 0.0,
    )
    return pngs
