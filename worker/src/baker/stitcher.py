"""PDF assembly: pack card PNGs on Letter pages (no gaps between cards), center grid."""

from __future__ import annotations

import logging
import math
from io import BytesIO
from typing import Any

import img2pdf
from PIL import Image

logger = logging.getLogger(__name__)


def _pad_to_cell(im: Image.Image, cell_w: int, cell_h: int) -> Image.Image:
    """Center `im` on a white RGBA canvas of size cell_w x cell_h."""
    w, h = im.size
    out = Image.new("RGBA", (cell_w, cell_h), (255, 255, 255, 255))
    ox = (cell_w - w) // 2
    oy = (cell_h - h) // 2
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    out.paste(im, (ox, oy), im)
    return out


def stitch_pdf(card_pngs: list[bytes], payload: dict[str, Any]) -> bytes:
    """
    Pack card images in a tight grid (no spacing). Card dimensions may vary; each cell is
    max(width) x max(height) with each image centered in its cell.
    """
    if not card_pngs:
        raise ValueError("no card images")

    dpi = int(payload.get("dpi") or 300)
    paper = payload.get("paperSize") or {"width": 8.5, "height": 11}
    pw_in = float(paper.get("width") or 8.5)
    ph_in = float(paper.get("height") or 11)
    margin_in = float(payload.get("pageMarginIn") or 0.25)

    images = [Image.open(BytesIO(b)).convert("RGBA") for b in card_pngs]
    max_w = max(im.width for im in images)
    max_h = max(im.height for im in images)

    padded = [_pad_to_cell(im, max_w, max_h) for im in images]
    cell_w_in = max_w / dpi
    cell_h_in = max_h / dpi

    usable_w_in = pw_in - 2 * margin_in
    usable_h_in = ph_in - 2 * margin_in
    cols = max(1, math.floor(usable_w_in / cell_w_in)) if cell_w_in > 0 else 1
    rows_fit = max(1, math.floor(usable_h_in / cell_h_in)) if cell_h_in > 0 else 1
    per_page = cols * rows_fit

    page_px_w = int(round(pw_in * dpi))
    page_px_h = int(round(ph_in * dpi))

    page_images: list[Image.Image] = []
    idx = 0
    n = len(padded)
    while idx < n:
        page = Image.new("RGB", (page_px_w, page_px_h), (255, 255, 255))
        remaining = n - idx
        this_page = min(per_page, remaining)
        rows_this = math.ceil(this_page / cols)
        if rows_this <= 1:
            grid_w_in = this_page * cell_w_in
        else:
            grid_w_in = cols * cell_w_in
        grid_h_in = rows_this * cell_h_in
        ox_in = margin_in + (usable_w_in - grid_w_in) / 2.0
        oy_in = margin_in + (usable_h_in - grid_h_in) / 2.0

        for slot in range(this_page):
            im = padded[idx + slot]
            r = slot // cols
            c = slot % cols
            x_px = int(round((ox_in + c * cell_w_in) * dpi))
            y_px = int(round((oy_in + r * cell_h_in) * dpi))
            rgb = Image.new("RGB", im.size, (255, 255, 255))
            rgb.paste(im, mask=im.split()[3] if im.mode == "RGBA" else None)
            page.paste(rgb, (x_px, y_px))

        page_images.append(page)
        idx += this_page
        logger.info(
            "stitch page cards=%s cols=%s rows_this=%s",
            this_page,
            cols,
            rows_this,
        )

    png_streams: list[bytes] = []
    for pg in page_images:
        bio = BytesIO()
        pg.save(bio, format="PNG", dpi=(dpi, dpi))
        png_streams.append(bio.getvalue())

    pdf_bytes = img2pdf.convert([BytesIO(b) for b in png_streams])
    logger.info("stitch pdf total_bytes=%s pages=%s", len(pdf_bytes), len(page_images))
    return pdf_bytes
