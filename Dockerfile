# Hugging Face Spaces (Docker SDK) — zero-dependency Python app
FROM python:3.12-slim

WORKDIR /app
COPY . /app

# HF Spaces serve on port 7860; bind all interfaces; keep the SQLite DB in a
# guaranteed-writable location and seed it at build time so first load is instant.
ENV HOST=0.0.0.0 \
    PORT=7860 \
    DASHBOARD_DB=/tmp/dashboard.db \
    PYTHONUNBUFFERED=1

# server.py auto-seeds the SQLite dataset into $DASHBOARD_DB on first run.
EXPOSE 7860
CMD ["python", "server.py"]
