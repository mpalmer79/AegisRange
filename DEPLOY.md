# AegisRange Deployment Guide

AegisRange consists of two services:

| Service   | Stack               | Port | Health check |
|-----------|----------------------|------|--------------|
| Backend   | Python 3.11 / FastAPI | 8000 | `GET /health` |
| Frontend  | Node 20 / Next.js 14 | 3000 | `GET /`       |

---

> **Scaling Warning**: The backend must run with a **single Uvicorn worker**. Both the in-memory data store and the auth rate limiter are process-local. Running multiple workers causes silent data divergence and ineffective rate limiting. The Dockerfile enforces `--workers 1`. See [ARCHITECTURE.md — Scaling Constraints](ARCHITECTURE.md) for details on what must change before adding workers.

---

## Environment Variables

### Backend

| Variable             | Required | Default                | Description |
|----------------------|----------|------------------------|-------------|
| `APP_ENV`            | No       | `development`          | `development` or `production` |
| `JWT_SECRET`         | **Prod** | dev fallback           | HMAC-SHA256 signing key. **Must be set in production.** Generate: `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `TOKEN_EXPIRY_HOURS` | No       | `24`                   | JWT lifetime in hours |
| `DB_PATH`            | No       | `aegisrange.db`        | SQLite file path. Use `/data/aegisrange.db` when a volume is mounted at `/data` |
| `CORS_ORIGINS`       | No       | `http://localhost:3000` | Comma-separated allowed origins |
| `LOG_LEVEL`          | No       | `INFO`                 | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `LOG_FORMAT`         | No       | `json`                 | `json` or `text` |
| `DEFAULT_PASSWORD_<USERNAME>` | No | *source default*       | Override the seeded password for a simulation user. Example: `DEFAULT_PASSWORD_ADMIN=Prod_Override_Pass_2026!` replaces the admin account's baked-in password. When `APP_ENV=production` and any default is still in use, the backend emits a WARNING at startup with the list of usernames still on source defaults. Usernames: `admin`, `soc_lead`, `analyst1`, `red_team1`, `viewer1`. |
| `REDIS_URL`          | No       | *(empty)*              | **0.10.0 scaling opt-in.** When set (e.g. `redis://redis:6379/0`), JWT revocations and TOTP state move from process-local dicts into Redis, enabling multi-worker deployments to share ephemeral auth state. Falls back to the in-memory cache silently if the `redis` package is missing or the connection fails. See `docs/operations/SCALING.md` for the full multi-worker roadmap. |

### Frontend

| Variable              | Required | Default                  | Description |
|-----------------------|----------|--------------------------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes      | `http://localhost:8000`   | Backend API base URL (baked into the client-side bundle at build time) |

---

## Option 1: Railway

Railway treats each directory as a separate service in a monorepo.

### Setup

1. **Create a Railway project** and connect the GitHub repository.

2. **Add two services**, each pointing to its subdirectory:

   | Service   | Root directory | Dockerfile             |
   |-----------|----------------|------------------------|
   | backend   | `backend/`     | `backend/Dockerfile`   |
   | frontend  | `frontend/`    | `frontend/Dockerfile`  |

3. **Set environment variables** on each service (see tables above).
   - Backend: set `APP_ENV=production`, `JWT_SECRET=<random>`, `CORS_ORIGINS=https://<frontend-domain>`.
   - Frontend: set `NEXT_PUBLIC_API_URL=https://<backend-domain>`.

4. **Attach a persistent volume** to the backend service:
   - Mount path: `/data`
   - This is where SQLite stores `aegisrange.db`.  Without a volume, data is lost on every redeploy.

5. **Deploy.** Railway reads `railway.toml` from each service directory for health check and restart settings.

### Persistent Volume (SQLite)

The backend Dockerfile defaults `DB_PATH=/data/aegisrange.db`.  Railway volumes survive redeploys but **not service deletion**.

```
Railway Dashboard → Backend service → Settings → Volumes
  Mount path: /data
  Size: 1 GB (sufficient for simulation data)
```

If you later migrate to PostgreSQL, set `DB_PATH` to empty or remove the volume — the app falls back to in-memory mode when no persistence path is configured.

### Health Checks

Both `railway.toml` files configure health checks:
- Backend: `GET /health` (returns `{"status": "ok", ...}`)
- Frontend: `GET /` (Next.js serves the dashboard)

---

## Option 2: Docker Compose (local / self-hosted)

```bash
# Copy and fill in environment variables
cp .env.example .env
# Generate a JWT secret
echo "JWT_SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')" >> .env

# Build and run
docker compose up --build -d

# Verify
curl http://localhost:8000/health
curl http://localhost:3000
```

The `docker-compose.yml` includes:
- A named volume (`backend-data`) mounted at `/data` for SQLite persistence
- A health check on the backend; the frontend waits for it before starting

To stop and remove containers (data in the volume is preserved):
```bash
docker compose down
```

To remove everything including data:
```bash
docker compose down -v
```

---

## Option 3: Manual / Bare Metal

### Backend

```bash
cd backend
pip install -r requirements.txt
export APP_ENV=production
export JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
export DB_PATH=/var/lib/aegisrange/aegisrange.db
mkdir -p /var/lib/aegisrange
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm ci
NEXT_PUBLIC_API_URL=https://api.example.com npm run build
npm start
```

The `NEXT_PUBLIC_API_URL` must be set **at build time** because Next.js inlines it into the client bundle.

---

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

| Job             | Steps                                           |
|-----------------|--------------------------------------------------|
| backend-lint    | `ruff check` + `ruff format --check`            |
| backend-test    | `pytest` (475+ tests, 95% coverage) + `datetime.utcnow` scan |
| frontend-lint   | `next lint` (ESLint)                             |
| frontend-build  | `tsc --noEmit` + `next build` + standalone check |
| docker-build    | Build both Docker images (runs after tests pass) |

All five jobs must pass before a PR can merge.

---

## Security Notes

- **JWT tokens** are delivered via httpOnly cookies. The token never appears in the JSON response body or in JavaScript-accessible storage.
- **`JWT_SECRET`** must be set in production. The app refuses to start without it when `APP_ENV=production`.
- **CORS** is restricted to the origins listed in `CORS_ORIGINS`. In production, set this to the exact frontend domain.
- **SQLite** is the embedded database. For multi-instance deployments, migrate to PostgreSQL (the persistence layer is behind an abstraction that supports this).
