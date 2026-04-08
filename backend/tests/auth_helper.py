"""Test authentication helper.

Provides a pre-authenticated TestClient wrapper for use in tests.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import AuthService

_auth = AuthService()


def get_admin_token() -> str:
    """Generate a valid admin JWT token for testing."""
    return _auth.create_token("admin", "admin")


def get_analyst_token() -> str:
    """Generate a valid analyst JWT token for testing."""
    return _auth.create_token("analyst1", "analyst")


def get_viewer_token() -> str:
    """Generate a valid viewer JWT token for testing."""
    return _auth.create_token("viewer1", "viewer")


def get_redteam_token() -> str:
    """Generate a valid red_team JWT token for testing."""
    return _auth.create_token("red_team1", "red_team")


def authenticated_client(role: str = "admin") -> TestClient:
    """Create a TestClient with authentication headers pre-configured."""
    token_map = {
        "admin": get_admin_token,
        "analyst": get_analyst_token,
        "viewer": get_viewer_token,
        "red_team": get_redteam_token,
    }
    token = token_map.get(role, get_admin_token)()
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {token}"
    return client
