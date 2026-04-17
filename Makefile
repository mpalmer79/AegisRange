# AegisRange — top-level developer targets.
#
# `make check` runs the same lint / type-check / test gates CI runs,
# so a clean local check means the push is likely green. Use it
# before committing, or wire it into a pre-push hook if you want.
#
# Targets assume:
#   - backend deps installed (pip install -r backend/requirements.txt -r backend/dev-requirements.txt)
#   - frontend deps installed (cd frontend && npm ci)
# If either is missing, run `make install`.

.PHONY: help install check check-backend check-frontend lint type test clean

help:
	@echo "Targets:"
	@echo "  make check            Run all gates (lint + type + test, both sides)"
	@echo "  make check-backend    Backend only (ruff + pytest)"
	@echo "  make check-frontend   Frontend only (tsc + jest + eslint)"
	@echo "  make lint             Lint both sides"
	@echo "  make type             Type-check both sides"
	@echo "  make test             Run test suites on both sides"
	@echo "  make install          Install all local dev deps"

install:
	cd backend && pip install -r requirements.txt -r dev-requirements.txt
	cd frontend && npm ci

check: check-backend check-frontend

check-backend:
	cd backend && python3 -m ruff check app/ tests/
	cd backend && PYTHONPATH=. python3 -m pytest tests/ -q

check-frontend:
	cd frontend && npx tsc --noEmit
	cd frontend && npm run lint --if-present
	cd frontend && npm test -- --watchAll=false

lint:
	cd backend && python3 -m ruff check app/ tests/
	cd frontend && npm run lint --if-present

type:
	cd frontend && npx tsc --noEmit

test:
	cd backend && PYTHONPATH=. python3 -m pytest tests/ -q
	cd frontend && npm test -- --watchAll=false

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
