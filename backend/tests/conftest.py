"""Pytest configuration: isolated PostgreSQL test database and clean state per test."""

import os

# Configure the application before any app module is imported. The test database
# is separate from the development database; never point these tests at `mlstem`.
os.environ["DATABASE_URL"] = "postgresql+psycopg://mlstem:mlstem@localhost:5432/mlstem_test"
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production-0123456789"
os.environ["ENVIRONMENT"] = "test"
os.environ["UPLOAD_DIR"] = "/tmp/opencode/mlstem-test-uploads"
os.environ["LOGIN_RATE_LIMIT_ATTEMPTS"] = "1000"
os.environ["ALLOW_STUDENT_REGISTRATION"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_db(_schema):
    yield
    table_names = ", ".join(f'"{table.name}"' for table in Base.metadata.sorted_tables)
    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE TABLE {table_names} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
