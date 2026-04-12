# Contributing to AegisRange

## Development Setup

See the [README](README.md) Quick Start section for environment setup.

## Branch Strategy

- `main` is the stable branch. All changes go through pull requests.
- Feature branches: `feat/<description>`
- Bug fixes: `fix/<description>`

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add kill chain visualization to incident detail
fix: correct JTI pruning for expired revocations
refactor: encapsulate store internals behind accessor methods
perf: add secondary indices for event lookups
test: add pagination endpoint tests
docs: update deployment guide for Railway volumes
```

## Code Style

### Backend (Python)

- **Formatter**: `ruff format`
- **Linter**: `ruff check`
- **Type hints**: All function signatures must include type annotations
- **Tests**: Every feature/fix must include tests. Minimum 80% coverage enforced.

```bash
cd backend
ruff format .
ruff check .
pytest tests/ --cov=app
```

### Frontend (TypeScript)

- **Linter**: `next lint` (ESLint)
- **Type check**: `npx tsc --noEmit`

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

## Architecture Constraints

1. **Single worker**: The backend must run with one Uvicorn worker. The in-memory store and rate limiter are process-local.
2. **Store encapsulation**: Services must use accessor methods on the store, never access raw attributes directly. An AST-based test enforces this.
3. **Response models**: All API endpoints must have a Pydantic `response_model=` annotation.
4. **No `datetime.utcnow()`**: Use `app.models.utc_now()` for timezone-aware timestamps.

## Running Tests

```bash
cd backend

# Full suite
pytest tests/

# With coverage
pytest tests/ --cov=app --cov-report=term-missing

# Single test file
pytest tests/test_api.py -v

# Single test
pytest tests/test_api.py::TestEventsEndpoint::test_events_after_login -v
```

## Adding a New Detection Rule

1. Add the rule function in `app/services/detection_service.py`
2. Register it in the rule list
3. Add MITRE mapping in `app/services/mitre_service.py`
4. Add tests in `tests/test_detection_rules.py`
5. Run the full test suite

## Adding a New Scenario

1. Create the scenario method in `app/services/scenario_service.py`
2. Add the route in `app/routers/scenarios.py`
3. Add tests in `tests/test_scenarios.py`
4. Run the full test suite
