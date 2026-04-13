from __future__ import annotations

from uuid import uuid4

from app.models import Confidence, Event, Severity, utc_now
from app.services.document_service import DocumentService
from app.services.identity_service import IdentityService
from app.services.pipeline_service import EventPipelineService
from app.store import InMemoryStore


class ScenarioEngine:
    def __init__(
        self,
        *,
        identity: IdentityService,
        documents: DocumentService,
        pipeline: EventPipelineService,
        store: InMemoryStore,
    ) -> None:
        self.identity = identity
        self.documents = documents
        self.pipeline = pipeline
        self.store = store

    def run_auth_001(
        self, correlation_id: str, *, operated_by: str | None = None
    ) -> dict[str, object]:
        """SCN-AUTH-001: credential abuse with suspicious success."""
        for _ in range(5):
            self.identity.authenticate("alice", "wrong")
            self.pipeline.process(
                self._new_event(
                    event_type="authentication.login.failure",
                    category="authentication",
                    actor_id="user-alice",
                    actor_role="analyst",
                    correlation_id=correlation_id,
                    target_id="alice",
                    status="failure",
                    status_code="401",
                    error_message="invalid_credentials",
                    payload={"username": "alice", "authentication_method": "password"},
                )
            )

        success_result = self.identity.authenticate("alice", "correct-horse")
        self.pipeline.process(
            self._new_event(
                event_type="authentication.login.success",
                category="authentication",
                actor_id=success_result.actor_id,
                actor_role=success_result.actor_role,
                correlation_id=correlation_id,
                target_id="alice",
                status="success",
                status_code="200",
                session_id=success_result.session_id,
                payload={"username": "alice", "authentication_method": "password"},
            )
        )

        return self._summary("SCN-AUTH-001", correlation_id, operated_by=operated_by)

    def run_session_002(
        self, correlation_id: str, *, operated_by: str | None = None
    ) -> dict[str, object]:
        """SCN-SESSION-002: token reuse from conflicting origins."""
        login = self.identity.authenticate("bob", "hunter2")
        session_id = login.session_id
        if session_id is None:
            raise RuntimeError("Scenario setup failed: expected valid session")

        self.pipeline.process(
            self._new_event(
                event_type="session.token.issued",
                category="session",
                actor_id=login.actor_id,
                actor_role=login.actor_role,
                correlation_id=correlation_id,
                target_type="session",
                target_id=session_id,
                session_id=session_id,
                source_ip="198.51.100.10",
                payload={
                    "token_id": session_id,
                    "session_state": "issued",
                    "authentication_strength": "password",
                },
            )
        )

        for ip in ("198.51.100.10", "203.0.113.55"):
            self.pipeline.process(
                self._new_event(
                    event_type="authorization.check.success",
                    category="session",
                    actor_id=login.actor_id,
                    actor_role=login.actor_role,
                    correlation_id=correlation_id,
                    target_type="session",
                    target_id=session_id,
                    session_id=session_id,
                    source_ip=ip,
                    payload={
                        "session_id": session_id,
                        "route": "/documents/doc-002/read",
                    },
                )
            )

        return self._summary("SCN-SESSION-002", correlation_id, operated_by=operated_by)

    def run_doc_003(
        self, correlation_id: str, *, operated_by: str | None = None
    ) -> dict[str, object]:
        """SCN-DOC-003: abnormal bulk read access."""
        login = self.identity.authenticate("bob", "hunter2")
        session_id = login.session_id

        for index in range(20):
            allowed, doc = self.documents.can_read("admin", "doc-002")
            if not allowed or not doc:
                raise RuntimeError(
                    "Scenario setup failed: expected admin document access"
                )

            self.pipeline.process(
                self._new_event(
                    event_type="document.read.success",
                    category="document",
                    actor_id="user-bob",
                    actor_role="admin",
                    correlation_id=correlation_id,
                    target_type="document",
                    target_id=doc.document_id,
                    session_id=session_id,
                    source_ip="198.51.100.10",
                    payload={
                        "document_id": f"{doc.document_id}-{index}",
                        "classification": doc.classification,
                        "sensitivity_score": 80,
                    },
                )
            )

        return self._summary("SCN-DOC-003", correlation_id, operated_by=operated_by)

    def run_doc_004(
        self, correlation_id: str, *, operated_by: str | None = None
    ) -> dict[str, object]:
        """SCN-DOC-004: read-to-download exfiltration pattern."""
        login = self.identity.authenticate("bob", "hunter2")
        session_id = login.session_id
        document_ids = ["doc-001", "doc-002", "doc-003"]

        for doc_id in document_ids:
            allowed, doc = self.documents.can_read("admin", doc_id)
            if not allowed or not doc:
                raise RuntimeError("Scenario setup failed: expected admin read access")
            self.pipeline.process(
                self._new_event(
                    event_type="document.read.success",
                    category="document",
                    actor_id="user-bob",
                    actor_role="admin",
                    correlation_id=correlation_id,
                    target_type="document",
                    target_id=doc.document_id,
                    session_id=session_id,
                    source_ip="198.51.100.10",
                    payload={
                        "document_id": doc.document_id,
                        "classification": doc.classification,
                        "sensitivity_score": 90,
                    },
                )
            )

        for doc_id in document_ids:
            allowed, doc = self.documents.can_download("admin", doc_id)
            if not allowed or not doc:
                raise RuntimeError(
                    "Scenario setup failed: expected admin download access"
                )
            self.pipeline.process(
                self._new_event(
                    event_type="document.download.success",
                    category="document",
                    actor_id="user-bob",
                    actor_role="admin",
                    correlation_id=correlation_id,
                    target_type="document",
                    target_id=doc.document_id,
                    session_id=session_id,
                    source_ip="198.51.100.10",
                    payload={
                        "document_id": doc.document_id,
                        "classification": doc.classification,
                        "sensitivity_score": 90,
                    },
                )
            )

        return self._summary("SCN-DOC-004", correlation_id, operated_by=operated_by)

    def run_svc_005(
        self, correlation_id: str, *, operated_by: str | None = None
    ) -> dict[str, object]:
        """SCN-SVC-005: unauthorized service access."""
        routes = ["/admin/config", "/admin/secrets", "/admin/users", "/admin/audit"]
        for route in routes:
            self.pipeline.process(
                self._new_event(
                    event_type="authorization.failure",
                    category="system",
                    actor_id="svc-data-processor",
                    actor_type="service",
                    actor_role="service",
                    correlation_id=correlation_id,
                    target_id=route,
                    source_ip="10.0.1.50",
                    status="failure",
                    status_code="403",
                    payload={"route": route, "service_id": "svc-data-processor"},
                )
            )

        return self._summary("SCN-SVC-005", correlation_id, operated_by=operated_by)

    def run_corr_006(
        self, correlation_id: str, *, operated_by: str | None = None
    ) -> dict[str, object]:
        """SCN-CORR-006: multi-signal compromise sequence."""

        # --- Phase 1: Credential abuse (triggers DET-AUTH-001 + DET-AUTH-002) ---
        for _ in range(5):
            self.identity.authenticate("alice", "wrong")
            self.pipeline.process(
                self._new_event(
                    event_type="authentication.login.failure",
                    category="authentication",
                    actor_id="user-alice",
                    actor_role="analyst",
                    correlation_id=correlation_id,
                    target_id="alice",
                    status="failure",
                    status_code="401",
                    error_message="invalid_credentials",
                    payload={"username": "alice", "authentication_method": "password"},
                )
            )

        success_result = self.identity.authenticate("alice", "correct-horse")
        self.pipeline.process(
            self._new_event(
                event_type="authentication.login.success",
                category="authentication",
                actor_id=success_result.actor_id,
                actor_role=success_result.actor_role,
                correlation_id=correlation_id,
                target_id="alice",
                status="success",
                status_code="200",
                session_id=success_result.session_id,
                payload={"username": "alice", "authentication_method": "password"},
            )
        )

        session_id = success_result.session_id

        # --- Phase 2: Bulk document access (triggers DET-DOC-005) ---
        doc_ids_bulk = ["doc-001", "doc-002"]
        for index in range(20):
            doc_id = doc_ids_bulk[index % 2]
            allowed, doc = self.documents.can_read("analyst", doc_id)
            if not allowed or not doc:
                raise RuntimeError(
                    "Scenario setup failed: expected analyst read access"
                )

            self.pipeline.process(
                self._new_event(
                    event_type="document.read.success",
                    category="document",
                    actor_id="user-alice",
                    actor_role="analyst",
                    correlation_id=correlation_id,
                    target_type="document",
                    target_id=doc.document_id,
                    session_id=session_id,
                    source_ip="203.0.113.10",
                    payload={
                        "document_id": f"{doc.document_id}-{index}",
                        "classification": doc.classification,
                        "sensitivity_score": 80,
                    },
                )
            )

        # --- Phase 3: Read-to-download exfiltration (triggers DET-DOC-006) ---
        exfil_doc_ids = ["doc-001", "doc-002", "doc-003"]

        # Reads
        for doc_id in exfil_doc_ids:
            if doc_id in ("doc-001", "doc-002"):
                allowed, doc = self.documents.can_read("analyst", doc_id)
                if not allowed or not doc:
                    raise RuntimeError(
                        "Scenario setup failed: expected analyst read access"
                    )
            else:
                # doc-003 is restricted; analyst cannot read it via access control,
                # but the scenario generates the event directly to test detection.
                doc = self.documents.documents[doc_id]

            self.pipeline.process(
                self._new_event(
                    event_type="document.read.success",
                    category="document",
                    actor_id="user-alice",
                    actor_role="analyst",
                    correlation_id=correlation_id,
                    target_type="document",
                    target_id=doc.document_id,
                    session_id=session_id,
                    source_ip="203.0.113.10",
                    payload={
                        "document_id": doc.document_id,
                        "classification": doc.classification,
                        "sensitivity_score": 90,
                    },
                )
            )

        # Downloads — bypass access control since actor may already be restricted
        # by earlier detection responses. Scenario tests detection patterns.
        for doc_id in exfil_doc_ids:
            doc = self.documents.documents[doc_id]

            self.pipeline.process(
                self._new_event(
                    event_type="document.download.success",
                    category="document",
                    actor_id="user-alice",
                    actor_role="analyst",
                    correlation_id=correlation_id,
                    target_type="document",
                    target_id=doc.document_id,
                    session_id=session_id,
                    source_ip="203.0.113.10",
                    payload={
                        "document_id": doc.document_id,
                        "classification": doc.classification,
                        "sensitivity_score": 90,
                    },
                )
            )

        return self._summary("SCN-CORR-006", correlation_id, operated_by=operated_by)

    def _summary(
        self, scenario_id: str, correlation_id: str, *, operated_by: str | None = None
    ) -> dict[str, object]:
        incident = self.store.get_incident(correlation_id)
        events_count = len(
            [e for e in self.store.get_events() if e.correlation_id == correlation_id]
        )
        alerts_count = len(
            [a for a in self.store.get_alerts() if a.correlation_id == correlation_id]
        )
        responses_count = len(
            [
                r
                for r in self.store.get_responses()
                if r.correlation_id == correlation_id
            ]
        )
        summary: dict[str, object] = {
            "scenario_id": scenario_id,
            "correlation_id": correlation_id,
            "events_total": events_count,
            "events_generated": events_count,
            "alerts_total": alerts_count,
            "alerts_generated": alerts_count,
            "responses_total": responses_count,
            "responses_generated": responses_count,
            "incident_id": incident.incident_id if incident else None,
            "step_up_required": self.store.is_step_up_required("user-alice"),
            "revoked_sessions": sorted(self.store.get_all_revoked_sessions()),
            "download_restricted_actors": sorted(
                self.store.get_all_download_restricted()
            ),
            "disabled_services": sorted(self.store.get_all_disabled_services()),
            "quarantined_artifacts": sorted(self.store.get_all_quarantined_artifacts()),
            "policy_change_restricted_actors": sorted(
                self.store.get_all_policy_change_restricted()
            ),
            "operated_by": operated_by,
        }
        self.store.append_scenario_history(
            {
                **summary,
                "executed_at": utc_now().isoformat(),
            }
        )
        return summary

    @staticmethod
    def _new_event(
        *,
        event_type: str,
        category: str,
        actor_id: str,
        actor_role: str,
        correlation_id: str,
        payload: dict[str, object],
        actor_type: str = "user",
        target_id: str | None = None,
        target_type: str = "identity",
        session_id: str | None = None,
        source_ip: str = "203.0.113.10",
        status: str = "success",
        status_code: str | None = "200",
        error_message: str | None = None,
    ) -> Event:
        return Event(
            event_type=event_type,
            category=category,
            actor_id=actor_id,
            actor_type=actor_type,
            actor_role=actor_role,
            target_type=target_type,
            target_id=target_id,
            request_id=f"req-{uuid4()}",
            correlation_id=correlation_id,
            session_id=session_id,
            source_ip=source_ip,
            user_agent="scenario-engine",
            origin="internal",
            status=status,
            status_code=status_code,
            error_message=error_message,
            severity=Severity.INFORMATIONAL,
            confidence=Confidence.LOW,
            payload=payload,
        )
