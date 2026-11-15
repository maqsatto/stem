from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

from app.core.config import settings

_hasher = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, VerifyMismatchError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except VerificationError:
        return True


def _encode_token(subject: str, token_type: str, expires_delta: timedelta, jti: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": jti,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str) -> str:
    return _encode_token(
        subject=user_id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_minutes),
        jti=uuid4().hex,
    )


def create_refresh_token(user_id: str) -> tuple[str, str, datetime]:
    jti = uuid4().hex
    token = _encode_token(
        subject=user_id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_days),
        jti=jti,
    )
    expires_at = datetime.now(UTC) + timedelta(days=settings.refresh_token_days)
    return token, jti, expires_at


def decode_token(token: str, expected_type: str = "access") -> dict:
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return payload


def token_fingerprint(jti: str) -> str:
    return sha256(f"{settings.secret_key}:{jti}".encode()).hexdigest()
