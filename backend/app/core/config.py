from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "ML + STEM LAB"
    environment: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    secret_key: str = "insecure-dev-secret-change-me-please"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    jwt_algorithm: str = "HS256"

    database_url: str = "postgresql+psycopg://mlstem:mlstem@localhost:5432/mlstem"
    sql_echo: bool = False

    cors_origins: str = "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173"

    upload_dir: Path = Path("uploads")
    max_upload_mb: int = 25
    allowed_extensions: str = "pdf,docx,pptx,csv,xlsx,ipynb,png,jpg,jpeg,webp"

    allow_student_registration: bool = True
    login_rate_limit_attempts: int = 8
    login_rate_limit_window_seconds: int = 60

    admin_email: str = "admin@mlstem.kz"
    admin_password: str = "Admin123!"
    demo_teacher_email: str = "teacher@mlstem.kz"
    demo_teacher_password: str = "Teacher123!"
    demo_student_email: str = "student@mlstem.kz"
    demo_student_password: str = "Student123!"

    seed_demo_content: bool = True
    docs_enabled: bool = True

    @field_validator("upload_dir", mode="before")
    @classmethod
    def _upload_dir(cls, value: str | Path) -> Path:
        return Path(value)

    @property
    def sqlalchemy_database_url(self) -> str:
        # SQLite is only used by isolated tooling; production is PostgreSQL.
        if self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql+psycopg://", 1)
        return self.database_url

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allowed_extension_set(self) -> set[str]:
        return {ext.strip().lower().lstrip(".") for ext in self.allowed_extensions.split(",") if ext.strip()}

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
