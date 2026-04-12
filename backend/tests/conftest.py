"""Shared pytest fixtures for the AegisRange test suite.

Centralizes common setup (store reset, authenticated clients, scenario
execution) so individual test files don't duplicate boilerplate.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app, reset_rate_limits
from app.store import STORE
from tests.auth_helper import authenticated_client


@pytest.fixture(autouse=True)
def _reset_store():
    """Reset the in-memory store before every test to ensure isolation."""
    STORE.reset()
    reset_rate_limits()
    yield
    STORE.reset()
    reset_rate_limits()


@pytest.fixture()
def admin_client() -> TestClient:
    """Pre-authenticated admin client."""
    return authenticated_client("admin")


@pytest.fixture()
def analyst_client() -> TestClient:
    """Pre-authenticated analyst client."""
    return authenticated_client("analyst")


@pytest.fixture()
def viewer_client() -> TestClient:
    """Pre-authenticated viewer client."""
    return authenticated_client("viewer")


@pytest.fixture()
def red_team_client() -> TestClient:
    """Pre-authenticated red_team client."""
    return authenticated_client("red_team")


@pytest.fixture()
def unauthenticated_client() -> TestClient:
    """Client with no authentication headers."""
    return TestClient(app)


@pytest.fixture()
def scenario_seeded(red_team_client: TestClient) -> str:
    """Run scn-auth-001 and return the correlation_id."""
    resp = red_team_client.post("/scenarios/scn-auth-001")
    assert resp.status_code == 200
    return resp.json()["correlation_id"]
