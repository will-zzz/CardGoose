# Official image includes Chromium and OS deps for Playwright.
# Pin tag to a known Playwright release when upgrading.
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
COPY pyproject.toml ./
ENV PYTHONPATH=/app/src
CMD ["python", "-m", "baker.main"]
