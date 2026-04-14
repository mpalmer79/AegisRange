from __future__ import annotations

import os
from typing import Literal


class Settings:
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(
        ","
    )
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = os.getenv("LOG_FORMAT", "json")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_SECRET_PREVIOUS: str = os.getenv("JWT_SECRET_PREVIOUS", "")
    TOKEN_EXPIRY_HOURS: int = int(os.getenv("TOKEN_EXPIRY_HOURS", "24"))
    DB_PATH: str = os.getenv("DB_PATH", "aegisrange.db")
    AUTH_COOKIE_NAME: str = "aegisrange_token"
    AUTH_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    CSRF_COOKIE_NAME: str = "aegisrange_csrf"
    CSRF_HEADER_NAME: str = "x-csrf-token"

    # Account lockout (NIST 800-53 AC-7)
    LOCKOUT_THRESHOLD: int = int(os.getenv("LOCKOUT_THRESHOLD", "5"))
    LOCKOUT_DURATION_MINUTES: int = int(os.getenv("LOCKOUT_DURATION_MINUTES", "15"))

    # Password complexity
    PASSWORD_MIN_LENGTH: int = int(os.getenv("PASSWORD_MIN_LENGTH", "10"))
    PASSWORD_REQUIRE_UPPERCASE: bool = (
        os.getenv("PASSWORD_REQUIRE_UPPERCASE", "true").lower() == "true"
    )
    PASSWORD_REQUIRE_LOWERCASE: bool = (
        os.getenv("PASSWORD_REQUIRE_LOWERCASE", "true").lower() == "true"
    )
    PASSWORD_REQUIRE_DIGIT: bool = (
        os.getenv("PASSWORD_REQUIRE_DIGIT", "true").lower() == "true"
    )
    PASSWORD_REQUIRE_SPECIAL: bool = (
        os.getenv("PASSWORD_REQUIRE_SPECIAL", "true").lower() == "true"
    )

    @property
    def auth_cookie_secure(self) -> bool:
        """Only set Secure flag in production (requires HTTPS)."""
        return self.APP_ENV == "production"

    @property
    def jwt_secret_key(self) -> str:
        """Return the JWT secret, enforcing it is set in production."""
        if self.JWT_SECRET:
            return self.JWT_SECRET
        if self.APP_ENV == "production":
            raise RuntimeError(
                "JWT_SECRET environment variable must be set in production. "
                'Generate a strong random secret: python -c "import secrets; print(secrets.token_urlsafe(64))"'
            )
        return "aegisrange-dev-secret-do-not-use-in-production"

    @property
    def jwt_previous_secret_key(self) -> str | None:
        """Return the previous JWT secret for key rotation, or None."""
        return self.JWT_SECRET_PREVIOUS or None


settings = Settings()
