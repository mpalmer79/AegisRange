from __future__ import annotations

import os


class Settings:
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = os.getenv("LOG_FORMAT", "json")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    TOKEN_EXPIRY_HOURS: int = int(os.getenv("TOKEN_EXPIRY_HOURS", "24"))
    DB_PATH: str = os.getenv("DB_PATH", "aegisrange.db")
    AUTH_COOKIE_NAME: str = "aegisrange_token"
    AUTH_COOKIE_SAMESITE: str = "lax"

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
                "Generate a strong random secret: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        return "aegisrange-dev-secret-do-not-use-in-production"


settings = Settings()
