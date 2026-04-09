FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create a non-root user for production
RUN adduser --disabled-password --gecos '' appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data
USER appuser

# Default DB_PATH uses /data for Railway persistent volumes.
# Mount a Railway volume at /data to survive redeploys.
ENV DB_PATH=/data/aegisrange.db

EXPOSE 8000

# Railway sets $PORT dynamically; fall back to 8000 for local use.
# Shell form is required so $PORT is expanded at runtime.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
