"""Tests for the AuthCache abstraction introduced in 0.10.0.

Covers the in-memory implementation directly (the default) and exercises
the protocol contract that :class:`~app.services.auth_cache.RedisAuthCache`
is expected to satisfy. The Redis implementation itself needs a live
Redis instance to test end-to-end; we keep those tests opt-in behind an
env var so CI without Redis still passes.
"""

from __future__ import annotations

import os
import time
import unittest

from app.services.auth_cache import (
    AuthCache,
    InMemoryAuthCache,
    build_auth_cache,
)


class _AuthCacheContractMixin:
    """Protocol-contract assertions. Each test invokes ``self._cache()``
    to get a fresh cache instance, so the same suite can run against the
    in-memory and Redis implementations.

    Subclasses provide ``_cache()`` and (optionally) a ``_flush()``
    teardown.
    """

    def _cache(self) -> AuthCache:
        raise NotImplementedError

    # -- JTI revocations -----------------------------------------------------

    def test_jti_unknown_is_not_revoked(self) -> None:
        cache = self._cache()
        self.assertFalse(cache.is_jti_revoked("jti-unknown"))

    def test_revoke_then_check(self) -> None:
        cache = self._cache()
        cache.revoke_jti("jti-alpha")
        self.assertTrue(cache.is_jti_revoked("jti-alpha"))

    def test_revoke_is_per_jti(self) -> None:
        cache = self._cache()
        cache.revoke_jti("jti-alpha")
        self.assertTrue(cache.is_jti_revoked("jti-alpha"))
        self.assertFalse(cache.is_jti_revoked("jti-beta"))

    def test_all_revoked_jtis_returns_snapshot(self) -> None:
        cache = self._cache()
        cache.revoke_jti("jti-alpha")
        cache.revoke_jti("jti-beta")
        snapshot = cache.all_revoked_jtis()
        self.assertIn("jti-alpha", snapshot)
        self.assertIn("jti-beta", snapshot)

    def test_load_revoked_jtis_restores_state(self) -> None:
        cache = self._cache()
        cache.load_revoked_jtis({"jti-restored": time.monotonic()})
        self.assertTrue(cache.is_jti_revoked("jti-restored"))

    def test_load_revoked_jtis_clears_prior_state(self) -> None:
        cache = self._cache()
        cache.revoke_jti("jti-old")
        cache.load_revoked_jtis({})
        # For in-memory this is immediate. For Redis it would be too —
        # load is the canonical "reset to this set" operation.
        self.assertFalse(cache.is_jti_revoked("jti-old"))

    # -- TOTP state ----------------------------------------------------------

    def test_totp_unknown_user_has_no_secret(self) -> None:
        cache = self._cache()
        self.assertIsNone(cache.totp_secret_for("nobody"))
        self.assertFalse(cache.is_totp_enabled("nobody"))

    def test_set_and_read_totp_secret(self) -> None:
        cache = self._cache()
        cache.set_totp_secret("admin", "ABCDEF123456")
        self.assertEqual(cache.totp_secret_for("admin"), "ABCDEF123456")

    def test_clear_totp_secret(self) -> None:
        cache = self._cache()
        cache.set_totp_secret("admin", "ABCDEF123456")
        cache.clear_totp_secret("admin")
        self.assertIsNone(cache.totp_secret_for("admin"))

    def test_enable_and_disable_totp(self) -> None:
        cache = self._cache()
        cache.enable_totp("admin")
        self.assertTrue(cache.is_totp_enabled("admin"))
        cache.disable_totp("admin")
        self.assertFalse(cache.is_totp_enabled("admin"))

    def test_all_totp_snapshots(self) -> None:
        cache = self._cache()
        cache.set_totp_secret("admin", "AAAA")
        cache.set_totp_secret("analyst1", "BBBB")
        cache.enable_totp("admin")
        secrets = cache.all_totp_secrets()
        self.assertEqual(secrets.get("admin"), "AAAA")
        self.assertEqual(secrets.get("analyst1"), "BBBB")
        enabled = cache.all_totp_enabled()
        self.assertIn("admin", enabled)
        self.assertNotIn("analyst1", enabled)

    def test_load_totp_state_replaces_existing(self) -> None:
        cache = self._cache()
        cache.set_totp_secret("old-user", "OLD")
        cache.enable_totp("old-user")
        cache.load_totp_state({"new-user": "NEW"}, {"new-user"})
        self.assertIsNone(cache.totp_secret_for("old-user"))
        self.assertFalse(cache.is_totp_enabled("old-user"))
        self.assertEqual(cache.totp_secret_for("new-user"), "NEW")
        self.assertTrue(cache.is_totp_enabled("new-user"))


class TestInMemoryAuthCache(_AuthCacheContractMixin, unittest.TestCase):
    """Exercise the default in-memory implementation."""

    def _cache(self) -> InMemoryAuthCache:
        return InMemoryAuthCache()

    def test_prune_removes_expired(self) -> None:
        cache = InMemoryAuthCache()
        cache.revoke_jti("jti-old")
        # Rewind the timestamp so the JTI is "old" enough to prune.
        cache._revoked_jtis["jti-old"] -= 3600  # one hour in the past
        pruned = cache.prune_expired_revocations(max_age_seconds=60)
        self.assertEqual(pruned, 1)
        self.assertFalse(cache.is_jti_revoked("jti-old"))

    def test_prune_keeps_fresh(self) -> None:
        cache = InMemoryAuthCache()
        cache.revoke_jti("jti-fresh")
        pruned = cache.prune_expired_revocations(max_age_seconds=3600)
        self.assertEqual(pruned, 0)
        self.assertTrue(cache.is_jti_revoked("jti-fresh"))

    def test_shared_backing_dict_is_visible_via_cache(self) -> None:
        """InMemoryStore seeds the cache with its existing dict/set so
        legacy direct-attribute access stays consistent. Assert that a
        mutation to the backing dict is visible through the cache."""
        backing: dict[str, float] = {}
        cache = InMemoryAuthCache(revoked_jtis=backing)
        backing["jti-external-mutation"] = time.monotonic()
        self.assertTrue(cache.is_jti_revoked("jti-external-mutation"))

    def test_load_revoked_jtis_mutates_in_place(self) -> None:
        """Because the backing dict may be shared with the store, load
        must mutate-in-place rather than reassign."""
        backing: dict[str, float] = {"jti-old": 0.0}
        cache = InMemoryAuthCache(revoked_jtis=backing)
        cache.load_revoked_jtis({"jti-new": 1.0})
        self.assertNotIn("jti-old", backing)
        self.assertIn("jti-new", backing)


class TestBuildAuthCacheFactory(unittest.TestCase):
    def test_no_url_returns_in_memory(self) -> None:
        cache = build_auth_cache(None)
        self.assertIsInstance(cache, InMemoryAuthCache)

    def test_empty_string_returns_in_memory(self) -> None:
        cache = build_auth_cache("")
        self.assertIsInstance(cache, InMemoryAuthCache)


@unittest.skipUnless(
    os.environ.get("AEGISRANGE_TEST_REDIS_URL"),
    "Set AEGISRANGE_TEST_REDIS_URL to run Redis-backed tests "
    "(e.g. redis://localhost:6379/15).",
)
class TestRedisAuthCache(_AuthCacheContractMixin, unittest.TestCase):
    """Opt-in — runs the same protocol contract against Redis.

    Uses a dedicated Redis DB (15 by convention). Each test gets a
    fresh key namespace by flushing the DB in setUp."""

    @classmethod
    def setUpClass(cls) -> None:
        from app.services.auth_cache import RedisAuthCache

        cls._cls_cache = RedisAuthCache(
            os.environ["AEGISRANGE_TEST_REDIS_URL"], jti_ttl_seconds=5
        )

    def setUp(self) -> None:
        self._cls_cache._client.flushdb()

    def _cache(self) -> AuthCache:
        return self._cls_cache


if __name__ == "__main__":
    unittest.main()
