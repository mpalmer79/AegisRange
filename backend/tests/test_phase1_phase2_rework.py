"""Tests verifying Phase 1/2 rework fixes.

Covers:
- x_source_ip is NOT used as event source_ip (derived from TCP connection)
- Platform user attribution in simulation event payloads
- STORE write-path discipline (no direct collection mutations)
- datetime.utcnow deprecation elimination
- Trust boundary documentation on schemas
"""
from __future__ import annotations

import inspect
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.models import utc_now
from app.store import STORE, InMemoryStore
from tests.auth_helper import authenticated_client


class TestSourceIPDerivation(unittest.TestCase):
    """Verify that source_ip is derived from the TCP connection, not x_source_ip header."""

    def setUp(self) -> None:
        admin = authenticated_client("admin")
        admin.post("/admin/reset")

    def test_identity_login_ignores_x_source_ip_for_source_ip(self) -> None:
        """The x_source_ip header should end up in payload.simulated_source_ip,
        NOT in the event's source_ip field."""
        client = authenticated_client("viewer")
        client.post(
            "/identity/login",
            json={"username": "alice", "password": "correct-horse"},
            headers={"x-source-ip": "10.99.99.99"},
        )
        events = client.get("/events?event_type=authentication.login.success").json()
        self.assertGreater(len(events), 0)
        latest = events[-1]
        # source_ip should be the TestClient's IP, not the header value
        self.assertNotEqual(latest["source_ip"], "10.99.99.99")
        # The header value should be in the payload as simulation metadata
        self.assertEqual(latest["payload"]["simulated_source_ip"], "10.99.99.99")

    def test_document_read_ignores_x_source_ip_for_source_ip(self) -> None:
        """Document read events should use real client IP, not x_source_ip."""
        client = authenticated_client("viewer")
        client.post(
            "/documents/doc-001/read",
            json={"actor_id": "user-alice", "actor_role": "analyst"},
            headers={"x-source-ip": "192.168.1.99"},
        )
        events = client.get("/events?event_type=document.read.success").json()
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertNotEqual(latest["source_ip"], "192.168.1.99")
        self.assertEqual(latest["payload"]["simulated_source_ip"], "192.168.1.99")


class TestPlatformUserAttribution(unittest.TestCase):
    """Verify that the platform user ID is recorded in simulation event payloads."""

    def setUp(self) -> None:
        admin = authenticated_client("admin")
        admin.post("/admin/reset")

    def test_identity_login_records_platform_user(self) -> None:
        """Simulation login events should record which platform user triggered them."""
        client = authenticated_client("viewer")
        client.post(
            "/identity/login",
            json={"username": "alice", "password": "correct-horse"},
        )
        events = client.get("/events?event_type=authentication.login.success").json()
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertIn("platform_user_id", latest["payload"])
        self.assertEqual(latest["payload"]["platform_user_id"], "viewer1")

    def test_document_read_records_platform_user(self) -> None:
        """Document read events should record which platform user triggered them."""
        client = authenticated_client("analyst")
        client.post(
            "/documents/doc-001/read",
            json={"actor_id": "user-alice", "actor_role": "analyst"},
        )
        events = client.get("/events?event_type=document.read.success").json()
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertIn("platform_user_id", latest["payload"])
        self.assertEqual(latest["payload"]["platform_user_id"], "analyst1")

    def test_session_revoke_records_platform_user(self) -> None:
        """Session revocation events should record the platform user."""
        viewer = authenticated_client("viewer")
        resp = viewer.post(
            "/identity/login",
            json={"username": "alice", "password": "correct-horse"},
        )
        session_id = resp.json()["session_id"]

        analyst = authenticated_client("analyst")
        analyst.post(f"/identity/sessions/{session_id}/revoke")
        events = analyst.get("/events?event_type=session.token.revoked").json()
        self.assertGreater(len(events), 0)
        latest = events[-1]
        self.assertEqual(latest["payload"]["platform_user_id"], "analyst1")


class TestStoreWriteMethodDiscipline(unittest.TestCase):
    """Verify STORE write methods exist and work for all operational state."""

    def setUp(self) -> None:
        self.store = InMemoryStore()

    def test_revoke_session(self) -> None:
        self.store.revoke_session("sess-1")
        self.assertIn("sess-1", self.store.revoked_sessions)

    def test_require_step_up(self) -> None:
        self.store.require_step_up("actor-1")
        self.assertIn("actor-1", self.store.step_up_required)

    def test_clear_step_up(self) -> None:
        self.store.require_step_up("actor-1")
        self.store.clear_step_up("actor-1")
        self.assertNotIn("actor-1", self.store.step_up_required)

    def test_restrict_downloads(self) -> None:
        self.store.restrict_downloads("actor-1")
        self.assertIn("actor-1", self.store.download_restricted_actors)

    def test_disable_service(self) -> None:
        self.store.disable_service("svc-1")
        self.assertIn("svc-1", self.store.disabled_services)

    def test_block_routes(self) -> None:
        self.store.block_routes("svc-1", ["/api/admin", "/api/config"])
        self.assertIn("svc-1", self.store.blocked_routes)
        self.assertEqual(self.store.blocked_routes["svc-1"], {"/api/admin", "/api/config"})

    def test_quarantine_artifact(self) -> None:
        self.store.quarantine_artifact("art-1")
        self.assertIn("art-1", self.store.quarantined_artifacts)

    def test_restrict_policy_changes(self) -> None:
        self.store.restrict_policy_changes("actor-1")
        self.assertIn("actor-1", self.store.policy_change_restricted_actors)

    def test_update_risk_profile(self) -> None:
        profile = {"actor_id": "actor-1", "score": 50}
        self.store.update_risk_profile("actor-1", profile)
        self.assertEqual(self.store.risk_profiles["actor-1"], profile)

    def test_add_alert_signature_novel(self) -> None:
        sig = ("rule-1", "actor-1", "corr-1")
        self.assertTrue(self.store.add_alert_signature(sig))

    def test_add_alert_signature_duplicate(self) -> None:
        sig = ("rule-1", "actor-1", "corr-1")
        self.store.add_alert_signature(sig)
        self.assertFalse(self.store.add_alert_signature(sig))

    def test_set_actor_session(self) -> None:
        self.store.set_actor_session("actor-1", "sess-1")
        self.assertEqual(self.store.actor_sessions["actor-1"], "sess-1")

    def test_no_direct_collection_mutations_in_services(self) -> None:
        """Services should not directly mutate STORE collections via .add/.append etc."""
        import app.services.response_service as rs
        import app.services.event_services as es
        import app.services.identity_service as ids
        import app.services.pipeline_service as ps
        import app.services.risk_service as risk

        for mod in [rs, es, ids, ps, risk]:
            source = inspect.getsource(mod)
            # Check for direct collection mutations (excluding store.py itself)
            for pattern in [
                "self.store.revoked_sessions.add(",
                "self.store.step_up_required.add(",
                "self.store.download_restricted_actors.add(",
                "self.store.disabled_services.add(",
                "self.store.quarantined_artifacts.add(",
                "self.store.policy_change_restricted_actors.add(",
                "self.store.blocked_routes[",
                "self.store.risk_profiles[",
                "self.store.actor_sessions[",
                "self.store.alert_signatures.add(",
                "self.store.login_failures_by_actor[",
                "self.store.document_reads_by_actor[",
                "self.store.authorization_failures_by_actor[",
                "self.store.artifact_failures_by_actor[",
            ]:
                self.assertNotIn(
                    pattern,
                    source,
                    f"Direct mutation found in {mod.__name__}: {pattern}",
                )


class TestDatetimeDeprecation(unittest.TestCase):
    """Verify that no deprecated datetime.utcnow() calls remain in runtime code."""

    @staticmethod
    def _find_utcnow_calls(source: str) -> list[int]:
        """Use the AST to find actual datetime.utcnow() calls (ignoring
        strings, comments, docstrings)."""
        import ast

        try:
            tree = ast.parse(source)
        except SyntaxError:
            return []

        hits: list[int] = []
        for node in ast.walk(tree):
            # Match: datetime.utcnow()
            if isinstance(node, ast.Call):
                func = node.func
                if (
                    isinstance(func, ast.Attribute)
                    and func.attr == "utcnow"
                    and isinstance(func.value, ast.Name)
                    and func.value.id == "datetime"
                ):
                    hits.append(node.lineno)
            # Match: default_factory=datetime.utcnow (attr ref without call)
            if isinstance(node, ast.Attribute):
                if (
                    node.attr == "utcnow"
                    and isinstance(node.value, ast.Name)
                    and node.value.id == "datetime"
                ):
                    hits.append(node.lineno)
        return hits

    def test_no_utcnow_calls_in_backend(self) -> None:
        """All backend Python files should use utc_now(), not datetime.utcnow()."""
        import pathlib

        backend = pathlib.Path(__file__).parent.parent / "app"
        for py_file in backend.rglob("*.py"):
            hits = self._find_utcnow_calls(py_file.read_text())
            self.assertEqual(
                hits, [],
                f"datetime.utcnow usage on line(s) {hits} in {py_file.relative_to(backend.parent)}",
            )

    def test_no_utcnow_calls_in_tests(self) -> None:
        """Test files should also not use datetime.utcnow()."""
        import pathlib

        tests = pathlib.Path(__file__).parent
        for py_file in tests.rglob("*.py"):
            hits = self._find_utcnow_calls(py_file.read_text())
            self.assertEqual(
                hits, [],
                f"datetime.utcnow usage on line(s) {hits} in {py_file.relative_to(tests.parent)}",
            )

    def test_zero_deprecation_warnings(self) -> None:
        """utc_now() should produce zero DeprecationWarning."""
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("error", DeprecationWarning)
            utc_now()


class TestTrustBoundaryDocs(unittest.TestCase):
    """Verify trust boundary documentation is present on schemas."""

    def test_read_request_documents_simulation_context(self) -> None:
        from app.schemas import ReadRequest
        doc = ReadRequest.__doc__ or ""
        self.assertIn("simulated threat actor", doc)
        self.assertIn("platform_user_id", doc)
        self.assertIn("NOT", doc)

    def test_download_request_references_read_request(self) -> None:
        from app.schemas import DownloadRequest
        doc = DownloadRequest.__doc__ or ""
        self.assertIn("ReadRequest", doc)


if __name__ == "__main__":
    unittest.main()
