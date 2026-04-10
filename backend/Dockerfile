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

# Single worker required: rate limiter and InMemoryStore are
# process-local. Scale vertically or add Redis before adding workers.
# Shell form so $PORT is expanded at runtime (Railway sets it dynamically).
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
