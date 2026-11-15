import uuid

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import Role, UserStatus
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


def _unauthorized() -> ApiError:
    return ApiError(401, "unauthorized", "Авторизация қажет. Қайта кіріңіз.")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise _unauthorized()
    try:
        payload = decode_token(credentials.credentials, "access")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError) as exc:
        raise _unauthorized() from exc
    user = db.get(User, user_id)
    if user is None or user.status != UserStatus.active.value:
        raise _unauthorized()
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None or not credentials.credentials:
        return None
    try:
        payload = decode_token(credentials.credentials, "access")
        user = db.get(User, uuid.UUID(payload["sub"]))
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None
    if user is None or user.status != UserStatus.active.value:
        return None
    return user


def require_roles(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise ApiError(403, "forbidden", "Бұл әрекетке рұқсатыңыз жоқ.")
        return user

    return dependency


StudentUser = Depends(require_roles(Role.student.value))
TeacherUser = Depends(require_roles(Role.teacher.value, Role.admin.value))
AdminUser = Depends(require_roles(Role.admin.value))
AuthenticatedUser = Depends(get_current_user)
