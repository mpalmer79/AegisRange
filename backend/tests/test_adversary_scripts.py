"""Adversary script equivalence tests.

For each scenario, applying the beat sequence synchronously must
produce the SAME final store state as calling the legacy
``ScenarioEngine.run_*`` method. These tests lock in the refactoring
so Phase 3 (command-driven objectives) can safely consume the scripts
instead of the monolithic engine methods.
"""

from __future__ import annotations

import unittest
from uuid import uuid4

from app.services.adversary_scripts import (
    ScriptContext,
    apply_beat,
    build_script,
)
from app.services.detection_service import DetectionService
from app.services.document_service import DocumentService
from app.services.event_services import TelemetryService
from app.services.identity_service import IdentityService
from app.services.incident_service import IncidentService
from app.services.pipeline_service import EventPipelineService
from app.services.response_service import ResponseOrchestrator
from app.services.scenario_service import ScenarioEngine
from app.store import InMemoryStore


def _make_env():
    store = InMemoryStore()
    telemetry = TelemetryService(store)
    detection = DetectionService(telemetry)
    response = ResponseOrchestrator(store)
    incidents = IncidentService(store)
    pipeline = EventPipelineService(
        telemetry=telemetry,
        detection=detection,
        response=response,
        incidents=incidents,
        store=store,
    )
    identity = IdentityService(store)
    documents = DocumentService(store=store)
    engine = ScenarioEngine(
        identity=identity,
        documents=documents,
        pipeline=pipeline,
        store=store,
    )
    return store, engine, pipeline, identity, documents


def _apply_all(script, ctx: ScriptContext) -> None:
    for beat in script:
        apply_beat(beat, ctx)


def _counts(store, corr):
    events = sum(1 for e in store.get_events() if e.correlation_id == corr)
    alerts = sum(1 for a in store.get_alerts() if a.correlation_id == corr)
    responses = sum(1 for r in store.get_responses() if r.correlation_id == corr)
    incident = store.get_incident(corr)
    return events, alerts, responses, incident


class AdversaryScriptEquivalence(unittest.TestCase):
    """Scripts run synchronously must match the legacy engine output."""

    def _compare(self, scenario_id: str, engine_method_name: str) -> None:
        corr_legacy = f"corr-{uuid4()}"
        corr_script = f"corr-{uuid4()}"

        # --- legacy run ---
        store_l, engine_l, *_ = _make_env()
        getattr(engine_l, engine_method_name)(corr_legacy)
        legacy = _counts(store_l, corr_legacy)

        # --- script run ---
        store_s, _, pipeline_s, identity_s, documents_s = _make_env()
        ctx = ScriptContext(
            correlation_id=corr_script,
            pipeline=pipeline_s,
            identity=identity_s,
            documents=documents_s,
            store=store_s,
        )
        script = build_script(scenario_id)
        _apply_all(script, ctx)
        script_out = _counts(store_s, corr_script)

        self.assertEqual(
            legacy[0],
            script_out[0],
            f"{scenario_id}: event count mismatch "
            f"(legacy={legacy[0]}, script={script_out[0]})",
        )
        self.assertEqual(
            legacy[1],
            script_out[1],
            f"{scenario_id}: alert count mismatch "
            f"(legacy={legacy[1]}, script={script_out[1]})",
        )
        self.assertEqual(
            legacy[2],
            script_out[2],
            f"{scenario_id}: response count mismatch "
            f"(legacy={legacy[2]}, script={script_out[2]})",
        )
        # Both runs must produce (or not produce) an incident; for
        # scenarios that DO produce one, its detection_ids must match.
        self.assertEqual(
            bool(legacy[3]),
            bool(script_out[3]),
            f"{scenario_id}: incident presence mismatch",
        )
        if legacy[3] is not None and script_out[3] is not None:
            self.assertEqual(
                sorted(legacy[3].detection_ids),
                sorted(script_out[3].detection_ids),
                f"{scenario_id}: detection_ids mismatch",
            )

    def test_scn_auth_001(self) -> None:
        self._compare("scn-auth-001", "run_auth_001")

    def test_scn_session_002(self) -> None:
        self._compare("scn-session-002", "run_session_002")

    def test_scn_doc_003(self) -> None:
        self._compare("scn-doc-003", "run_doc_003")

    def test_scn_doc_004(self) -> None:
        self._compare("scn-doc-004", "run_doc_004")

    def test_scn_svc_005(self) -> None:
        self._compare("scn-svc-005", "run_svc_005")

    def test_scn_corr_006(self) -> None:
        self._compare("scn-corr-006", "run_corr_006")


class BuildScriptBehaviour(unittest.TestCase):
    def test_unknown_scenario_raises(self) -> None:
        with self.assertRaises(ValueError):
            build_script("scn-does-not-exist")

    def test_each_call_returns_fresh_list(self) -> None:
        a = build_script("scn-auth-001")
        b = build_script("scn-auth-001")
        self.assertIsNot(a, b)
        self.assertEqual(len(a), len(b))
        # Mutating params in one run must not affect the next.
        a[0].params["side_effect"] = True
        self.assertNotIn("side_effect", b[0].params)


if __name__ == "__main__":
    unittest.main()
