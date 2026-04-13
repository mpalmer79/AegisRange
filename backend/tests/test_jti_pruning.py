"""Tests for TTL-based JTI revocation pruning."""

from __future__ import annotations

import time
import unittest
from unittest.mock import patch

from app.store import InMemoryStore


class TestJtiPruning(unittest.TestCase):
    """Verify TTL-based pruning of revoked JTIs."""

    def test_is_jti_revoked_with_dict_structure(self) -> None:
        """is_jti_revoked returns True for revoked JTIs."""
        store = InMemoryStore()
        store.revoke_jti("jti-abc")
        self.assertTrue(store.is_jti_revoked("jti-abc"))
        self.assertFalse(store.is_jti_revoked("jti-unknown"))

    def test_prune_removes_old_entries(self) -> None:
        """Entries older than max_age_seconds are pruned."""
        store = InMemoryStore()
        # Insert a JTI with a fake old timestamp
        old_time = time.monotonic() - 90000  # 25 hours ago
        store.revoked_jtis["jti-old"] = old_time
        store.revoked_jtis["jti-recent"] = time.monotonic()

        pruned = store.prune_expired_revocations(max_age_seconds=86400)

        self.assertEqual(pruned, 1)
        self.assertFalse(store.is_jti_revoked("jti-old"))
        self.assertTrue(store.is_jti_revoked("jti-recent"))

    def test_prune_preserves_recent_entries(self) -> None:
        """Entries within max_age_seconds are preserved."""
        store = InMemoryStore()
        store.revoke_jti("jti-1")
        store.revoke_jti("jti-2")
        store.revoke_jti("jti-3")

        pruned = store.prune_expired_revocations(max_age_seconds=86400)

        self.assertEqual(pruned, 0)
        self.assertTrue(store.is_jti_revoked("jti-1"))
        self.assertTrue(store.is_jti_revoked("jti-2"))
        self.assertTrue(store.is_jti_revoked("jti-3"))

    def test_prune_returns_count(self) -> None:
        """prune_expired_revocations returns the number of entries pruned."""
        store = InMemoryStore()
        old_time = time.monotonic() - 200000
        for i in range(5):
            store.revoked_jtis[f"jti-old-{i}"] = old_time
        store.revoke_jti("jti-fresh")

        pruned = store.prune_expired_revocations(max_age_seconds=86400)

        self.assertEqual(pruned, 5)
        self.assertEqual(len(store.revoked_jtis), 1)

    def test_prune_noop_when_empty(self) -> None:
        """Pruning an empty revocation dict returns 0."""
        store = InMemoryStore()
        pruned = store.prune_expired_revocations()
        self.assertEqual(pruned, 0)


class TestJtiPruningMiddleware(unittest.TestCase):
    """Verify that the correlation middleware triggers periodic pruning."""

    def test_pruning_triggered_every_100_requests(self) -> None:
        """JTI pruning fires every 100 requests through the middleware."""
        from fastapi.testclient import TestClient
        from app.main import app
        import app.main as main_mod

        client = TestClient(app)
        # Reset counter
        main_mod._jti_prune_counter = 0

        with patch.object(
            main_mod.STORE, "prune_expired_revocations", return_value=0
        ) as mock_prune:
            # Send 99 requests — should not trigger
            for _ in range(99):
                client.get("/health")
            mock_prune.assert_not_called()

            # 100th request should trigger pruning
            client.get("/health")
            mock_prune.assert_called_once()

        # Reset counter for other tests
        main_mod._jti_prune_counter = 0


if __name__ == "__main__":
    unittest.main()
