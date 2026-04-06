"""Load repo `.env.local` for local worker / one-shot CLI (same as `baker.main`)."""

from __future__ import annotations

from pathlib import Path


def load_repo_env_local() -> None:
    p = Path(__file__).resolve().parent
    for _ in range(12):
        candidate = p / ".env.local"
        if candidate.is_file():
            try:
                from dotenv import load_dotenv
            except ImportError as e:
                raise RuntimeError(
                    "Found .env.local but python-dotenv is not installed. "
                    "From the worker directory run: pip install -r requirements.txt"
                ) from e
            load_dotenv(candidate, override=False)
            return
        if p.parent == p:
            return
        p = p.parent
