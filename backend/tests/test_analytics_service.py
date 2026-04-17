"""Tests for the AnalyticsService introduced in 0.10.0."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.models import Alert, Confidence, Event, Incident, ResponseAction, Severity
from app.services.analytics_service import AnalyticsService
from app.services.risk_service import RiskProfile
from app.store import InMemoryStore
from tests.auth_helper import authenticated_client


def _mk_event(
    *,
    correlation_id: str,
    actor_id: str = "user-alice",
    ts: datetime | None = None,
) -> Event:
    return Event(
        event_type="authentication.login.failure",
        category="authentication",
        actor_id=actor_id,
        actor_type="user",
        actor_role="analyst",
        target_type="identity",
        target_id=actor_id,
        request_id=f"req-{uuid4()}",
        correlation_id=correlation_id,
        session_id=None,
        source_ip="203.0.113.10",
        user_agent="test-client",
        origin="api",
        status="failure",
        status_code="401",
        error_message=None,
        severity=Severity.INFORMATIONAL,
        confidence=Confidence.LOW,
        payload={},
        timestamp=ts or datetime.now(timezone.utc),
    )


def _mk_alert(
    *, correlation_id: str, ts: datetime, actor_id: str = "user-alice"
) -> Alert:
    return Alert(
        rule_id="DET-AUTH-001",
        rule_name="Repeated Authentication Failure Burst",
        severity=Severity.HIGH,
        confidence=Confidence.HIGH,
        actor_id=actor_id,
        correlation_id=correlation_id,
        contributing_event_ids=[],
        summary="test",
        payload={},
        created_at=ts,
    )


def _mk_response(*, correlation_id: str, ts: datetime) -> ResponseAction:
    return ResponseAction(
        playbook_id="PB-AUTH-001",
        action_type="REVOKE_SESSION",
        actor_id="user-alice",
        correlation_id=correlation_id,
        reason="test",
        related_alert_id="alert-001",
        payload={},
        created_at=ts,
    )


class TestMTTDMTTR(unittest.TestCase):
    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.svc = AnalyticsService(self.store)

    def test_empty_store_returns_zero_correlations(self) -> None:
        summary = self.svc.mttd_mttr_summary()
        self.assertEqual(summary["total_correlations"], 0)
        self.assertIsNone(summary["mttd_seconds_mean"])
        self.assertIsNone(summary["mttr_seconds_mean"])
        self.assertEqual(summary["per_incident"], [])

    def test_single_correlation_full_path(self) -> None:
        corr = f"corr-{uuid4()}"
        t0 = datetime(2026, 4, 15, 10, 0, 0, tzinfo=timezone.utc)
        self.store.append_event(_mk_event(correlation_id=corr, ts=t0))
        self.store.extend_alerts(
            [_mk_alert(correlation_id=corr, ts=t0 + timedelta(seconds=30))]
        )
        self.store.extend_responses(
            [_mk_response(correlation_id=corr, ts=t0 + timedelta(seconds=90))]
        )

        summary = self.svc.mttd_mttr_summary()
        self.assertEqual(summary["total_correlations"], 1)
        self.assertEqual(summary["mttd_seconds_mean"], 30.0)
        self.assertEqual(summary["mttr_seconds_mean"], 60.0)
        row = summary["per_incident"][0]
        self.assertEqual(row["correlation_id"], corr)
        self.assertEqual(row["mttd_seconds"], 30.0)
        self.assertEqual(row["mttr_seconds"], 60.0)

    def test_in_flight_correlation_excluded_from_means(self) -> None:
        corr_done = f"corr-{uuid4()}"
        corr_open = f"corr-{uuid4()}"
        t0 = datetime(2026, 4, 15, 10, 0, 0, tzinfo=timezone.utc)
        # Completed correlation
        self.store.append_event(_mk_event(correlation_id=corr_done, ts=t0))
        self.store.extend_alerts(
            [_mk_alert(correlation_id=corr_done, ts=t0 + timedelta(seconds=60))]
        )
        self.store.extend_responses(
            [_mk_response(correlation_id=corr_done, ts=t0 + timedelta(seconds=120))]
        )
        # Open correlation — event only, no alert, no response
        self.store.append_event(_mk_event(correlation_id=corr_open, ts=t0))

        summary = self.svc.mttd_mttr_summary()
        self.assertEqual(summary["total_correlations"], 2)
        self.assertEqual(summary["correlations_with_detection"], 1)
        self.assertEqual(summary["correlations_with_response"], 1)
        # Aggregate mean is driven only by the completed correlation.
        self.assertEqual(summary["mttd_seconds_mean"], 60.0)
        self.assertEqual(summary["mttr_seconds_mean"], 60.0)

    def test_time_to_close_uses_incident_closed_at(self) -> None:
        corr = f"corr-{uuid4()}"
        t0 = datetime(2026, 4, 15, 10, 0, 0, tzinfo=timezone.utc)
        self.store.append_event(_mk_event(correlation_id=corr, ts=t0))
        incident = Incident(
            incident_type="auth",
            primary_actor_id="user-alice",
            actor_type="user",
            correlation_id=corr,
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            closed_at=t0 + timedelta(hours=1),
        )
        self.store.upsert_incident(incident)

        summary = self.svc.mttd_mttr_summary()
        self.assertEqual(summary["time_to_close_seconds_mean"], 3600.0)


class TestRiskTrajectory(unittest.TestCase):
    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.svc = AnalyticsService(self.store)

    def test_unknown_actor_returns_empty_series(self) -> None:
        out = self.svc.risk_trajectory("user-nobody")
        self.assertEqual(out["actor_id"], "user-nobody")
        self.assertEqual(out["current_score"], 0)
        self.assertEqual(out["points"], [])

    def test_returns_existing_history(self) -> None:
        profile = RiskProfile(actor_id="user-alice", current_score=45, peak_score=60)
        profile.score_history = [
            {
                "timestamp": "2026-04-15T10:00:00+00:00",
                "rule_id": "DET-AUTH-001",
                "delta": 30,
                "new_score": 30,
            },
            {
                "timestamp": "2026-04-15T10:05:00+00:00",
                "rule_id": "DET-AUTH-002",
                "delta": 15,
                "new_score": 45,
            },
        ]
        self.store.update_risk_profile("user-alice", profile)
        out = self.svc.risk_trajectory("user-alice")
        self.assertEqual(len(out["points"]), 2)
        self.assertEqual(out["current_score"], 45)
        self.assertEqual(out["peak_score"], 60)
        self.assertEqual(out["points"][1]["score"], 45)

    def test_since_filter_drops_older_points(self) -> None:
        profile = RiskProfile(actor_id="user-alice", current_score=45)
        profile.score_history = [
            {
                "timestamp": "2026-04-15T09:00:00+00:00",
                "rule_id": "DET-AUTH-001",
                "delta": 30,
                "new_score": 30,
            },
            {
                "timestamp": "2026-04-15T11:00:00+00:00",
                "rule_id": "DET-AUTH-002",
                "delta": 15,
                "new_score": 45,
            },
        ]
        self.store.update_risk_profile("user-alice", profile)
        cutoff = datetime(2026, 4, 15, 10, 0, 0, tzinfo=timezone.utc)
        out = self.svc.risk_trajectory("user-alice", since=cutoff)
        self.assertEqual(len(out["points"]), 1)
        self.assertEqual(out["points"][0]["rule_id"], "DET-AUTH-002")


class TestAlertDisposition(unittest.TestCase):
    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.svc = AnalyticsService(self.store)

    def test_empty_store_returns_zero_counts(self) -> None:
        out = self.svc.alert_disposition_summary()
        self.assertEqual(out["alerts_total"], 0)
        self.assertEqual(out["incidents_total"], 0)
        self.assertEqual(out["stale_investigations"], [])

    def test_counts_by_severity_and_status(self) -> None:
        now = datetime.now(timezone.utc)
        self.store.extend_alerts(
            [
                _mk_alert(correlation_id=f"c{i}", ts=now) for i in range(2)
            ]
        )
        inc1 = Incident(
            incident_type="auth",
            primary_actor_id="user-alice",
            actor_type="user",
            correlation_id="c1",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            status="open",
        )
        inc1.updated_at = now  # fresh
        self.store.upsert_incident(inc1)
        out = self.svc.alert_disposition_summary()
        self.assertEqual(out["alerts_total"], 2)
        self.assertEqual(out["alerts_by_severity"].get("high"), 2)
        self.assertEqual(out["incidents_by_status"].get("open"), 1)
        # Fresh incident → not stale.
        self.assertEqual(out["stale_investigations"], [])

    def test_stale_investigation_surfaces_on_watchlist(self) -> None:
        very_old = datetime.now(timezone.utc) - timedelta(days=3)
        inc = Incident(
            incident_type="auth",
            primary_actor_id="user-alice",
            actor_type="user",
            correlation_id="c-stale",
            severity=Severity.HIGH,
            confidence=Confidence.HIGH,
            status="investigating",
        )
        inc.updated_at = very_old
        self.store.upsert_incident(inc)
        out = self.svc.alert_disposition_summary()
        self.assertEqual(len(out["stale_investigations"]), 1)
        self.assertEqual(out["stale_investigations"][0]["correlation_id"], "c-stale")


class TestCoverage(unittest.TestCase):
    def setUp(self) -> None:
        self.store = InMemoryStore()
        self.svc = AnalyticsService(self.store)

    def test_coverage_reports_all_rules_never_fired_when_empty(self) -> None:
        out = self.svc.coverage_summary()
        self.assertEqual(out["rules_with_triggers"], 0)
        # registry holds 13 rules as of 0.10.0
        self.assertEqual(out["rules_total"], 13)
        self.assertIn("DET-AUTH-001", out["rules_never_fired"])

    def test_last_fired_tracks_most_recent_alert(self) -> None:
        early = datetime(2026, 4, 15, 10, 0, 0, tzinfo=timezone.utc)
        late = early + timedelta(hours=1)
        self.store.extend_alerts(
            [
                _mk_alert(correlation_id="c1", ts=early),
                _mk_alert(correlation_id="c2", ts=late),
            ]
        )
        out = self.svc.coverage_summary()
        self.assertEqual(out["rules_with_triggers"], 1)
        row = next(r for r in out["per_rule"] if r["rule_id"] == "DET-AUTH-001")
        self.assertEqual(row["trigger_count"], 2)
        self.assertEqual(row["last_fired_at"], late.isoformat())


class TestAnalyticsEndpoints(unittest.TestCase):
    """End-to-end checks that the routes return the service output with
    the right auth gate."""

    def test_mttd_mttr_requires_analyst(self) -> None:
        unauth = TestClient(app)
        resp = unauth.get("/analytics/mttd-mttr")
        self.assertEqual(resp.status_code, 401)

    def test_mttd_mttr_returns_shape(self) -> None:
        client = authenticated_client("analyst")
        resp = client.get("/analytics/mttd-mttr")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("total_correlations", data)
        self.assertIn("per_incident", data)

    def test_risk_trajectory_rejects_bad_since(self) -> None:
        client = authenticated_client("analyst")
        resp = client.get(
            "/analytics/risk-trajectory/user-alice", params={"since": "not-a-date"}
        )
        self.assertEqual(resp.status_code, 400)

    def test_alert_disposition_endpoint(self) -> None:
        client = authenticated_client("analyst")
        resp = client.get("/analytics/alert-disposition")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("alerts_by_severity", resp.json())

    def test_coverage_endpoint(self) -> None:
        client = authenticated_client("analyst")
        resp = client.get("/analytics/coverage")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["rules_total"], 13)


if __name__ == "__main__":
    unittest.main()
