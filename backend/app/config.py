from __future__ import annotations

import os


class Settings:
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = os.getenv("LOG_FORMAT", "json")
    APP_ENV: str = os.getenv("APP_ENV", "development")


settings = Settings()
