"""TOTP (Time-based One-Time Password) service for AegisRange MFA.

Implements RFC 6238 TOTP generation and verification using only
stdlib ``hmac`` and ``hashlib`` modules — no external dependency
required.  Provides enrollment, verification, and provisioning URI
generation for authenticator app integration.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import struct
import time
from urllib.parse import quote


class TOTPService:
    """RFC 6238 TOTP generation and verification.

    Uses HMAC-SHA1 with a 30-second time step and 6-digit codes,
    matching the defaults used by Google Authenticator, Authy, and
    other standard authenticator apps.
    """

    _DIGITS = 6
    _PERIOD = 30  # seconds
    _ISSUER = "AegisRange"

    def generate_secret(self) -> str:
        """Generate a new base32-encoded 20-byte TOTP secret."""
        return base64.b32encode(os.urandom(20)).decode("ascii")

    def generate_code(
        self,
        secret: str,
        timestamp: float | None = None,
    ) -> str:
        """Generate a 6-digit TOTP code for the given secret and time.

        If *timestamp* is None, uses the current time.
        """
        if timestamp is None:
            timestamp = time.time()
        counter = int(timestamp) // self._PERIOD
        return self._hotp(secret, counter)

    def verify_code(
        self,
        secret: str,
        code: str,
        *,
        window: int = 1,
        timestamp: float | None = None,
    ) -> bool:
        """Verify a TOTP code, checking ±window time periods.

        Returns True if the code matches any period within the window.
        """
        if timestamp is None:
            timestamp = time.time()
        counter = int(timestamp) // self._PERIOD
        for offset in range(-window, window + 1):
            expected = self._hotp(secret, counter + offset)
            if hmac.compare_digest(expected, code):
                return True
        return False

    def provisioning_uri(
        self,
        secret: str,
        username: str,
    ) -> str:
        """Generate an otpauth:// provisioning URI for authenticator apps."""
        label = quote(f"{self._ISSUER}:{username}", safe="")
        params = (
            f"secret={secret}"
            f"&issuer={quote(self._ISSUER)}"
            f"&algorithm=SHA1"
            f"&digits={self._DIGITS}"
            f"&period={self._PERIOD}"
        )
        return f"otpauth://totp/{label}?{params}"

    def _hotp(self, secret: str, counter: int) -> str:
        """Compute an HOTP code per RFC 4226."""
        key = base64.b32decode(secret, casefold=True)
        msg = struct.pack(">Q", counter)
        digest = hmac.new(key, msg, hashlib.sha1).digest()
        offset = digest[-1] & 0x0F
        code_int = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
        return str(code_int % (10**self._DIGITS)).zfill(self._DIGITS)


# Module-level singleton
totp_service = TOTPService()
