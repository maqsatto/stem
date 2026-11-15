import uuid
from datetime import UTC, datetime

import jwt
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.errors import ApiError
from app.core.rate_limit import SlidingWindowLimiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    needs_rehash,
    token_fingerprint,
    verify_password,
)
from app.db.session import get_db
from app.models.classroom import Classroom, ClassroomMember
from app.models.enums import Role, UserStatus
from app.models.user import RefreshToken, User
from app.schemas.auth import (
    ChangePasswordIn,
    ClassroomBrief,
    LoginIn,
    LogoutIn,
    MeOut,
    MeUpdateIn,
    RefreshIn,
    RegisterIn,
    TokenPairOut,
    UserOut,
)
from app.schemas.common import MessageOut
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["auth"])
profile_router = APIRouter(tags=["profile"])
login_limiter = SlidingWindowLimiter(
    limit=settings.login_rate_limit_attempts,
    window_seconds=settings.login_rate_limit_window_seconds,
)


def issue_tokens(db: Session, user: User) -> TokenPairOut:
    access = create_access_token(str(user.id))
    refresh, jti, expires_at = create_refresh_token(str(user.id))
    db.add(
        RefreshToken(
            user_id=user.id,
            jti_fingerprint=token_fingerprint(jti),
            expires_at=expires_at,
            created_at=datetime.now(UTC),
        )
    )
    db.commit()
    return TokenPairOut(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_minutes * 60,
        user=UserOut.model_validate(user),
    )


def _normalize_email(email: str) -> str:
    return email.strip().lower()


@router.post("/register", response_model=TokenPairOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> TokenPairOut:
    if not settings.allow_student_registration:
        raise ApiError(
            403,
            "registration_disabled",
            "Өз бетінше тіркелу өшірілген. Мұғалімнен аккаунт сұраңыз.",
        )
    email = _normalize_email(payload.email)
    if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
        raise ApiError(409, "email_taken", "Бұл email тіркелген. Кіру бетін қолданыңыз.")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
        role=Role.student.value,
        status=UserStatus.active.value,
    )
    db.add(user)
    db.flush()
    log_action(db, user.id, "user_registered", "user", user.id)
    tokens = issue_tokens(db, user)
    return tokens


@router.post("/login", response_model=TokenPairOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)) -> TokenPairOut:
    email = _normalize_email(payload.email)
    client = request.client.host if request.client else "unknown"
    limiter_key = f"{client}:{email}"
    login_limiter.check(limiter_key)

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise ApiError(401, "invalid_credentials", "Email немесе құпиясөз қате.")
    if user.status != UserStatus.active.value:
        raise ApiError(403, "account_disabled", "Аккаунт өшірілген. Әкімшіге хабарласыңыз.")

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    user.last_login_at = datetime.now(UTC)
    login_limiter.reset(limiter_key)
    db.commit()
    return issue_tokens(db, user)


@router.post("/refresh", response_model=TokenPairOut)
def refresh(payload: RefreshIn, db: Session = Depends(get_db)) -> TokenPairOut:
    try:
        data = decode_token(payload.refresh_token, "refresh")
        user_id = uuid.UUID(data["sub"])
        jti = data["jti"]
    except (jwt.InvalidTokenError, KeyError, ValueError) as exc:
        raise ApiError(401, "invalid_refresh", "Сессия мерзімі бітті. Қайта кіріңіз.") from exc

    record = db.execute(
        select(RefreshToken).where(RefreshToken.jti_fingerprint == token_fingerprint(jti))
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if record is None or record.revoked_at is not None or record.expires_at < now:
        raise ApiError(401, "invalid_refresh", "Сессия мерзімі бітті. Қайта кіріңіз.")
    user = db.get(User, user_id)
    if user is None or user.status != UserStatus.active.value:
        raise ApiError(401, "invalid_refresh", "Аккаунт қолжетімсіз.")
    record.revoked_at = now
    db.commit()
    return issue_tokens(db, user)


@router.post("/logout", response_model=MessageOut)
def logout(
    payload: LogoutIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    if payload.refresh_token:
        try:
            data = decode_token(payload.refresh_token, "refresh")
            record = db.execute(
                select(RefreshToken).where(
                    RefreshToken.jti_fingerprint == token_fingerprint(data["jti"])
                )
            ).scalar_one_or_none()
            if record and record.user_id == user.id and record.revoked_at is None:
                record.revoked_at = datetime.now(UTC)
                db.commit()
        except (jwt.InvalidTokenError, KeyError):
            pass
    return MessageOut(message="Сессия жабылды.")


def _classrooms_for(db: Session, user: User) -> list[ClassroomBrief]:
    if user.role == Role.teacher.value:
        rows = db.execute(
            select(Classroom).where(Classroom.teacher_id == user.id)
        ).scalars().all()
    elif user.role == Role.student.value:
        rows = db.execute(
            select(Classroom)
            .join(ClassroomMember, ClassroomMember.classroom_id == Classroom.id)
            .where(ClassroomMember.student_id == user.id)
        ).scalars().all()
    else:
        rows = []
    return [ClassroomBrief(id=row.id, title=row.title) for row in rows]


@profile_router.get("/me", response_model=MeOut)
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeOut:
    return MeOut(
        **UserOut.model_validate(user).model_dump(),
        classrooms=_classrooms_for(db, user),
    )


@profile_router.patch("/me", response_model=MeOut)
def update_me(
    payload: MeUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeOut:
    user.display_name = payload.display_name.strip()
    db.commit()
    return MeOut(
        **UserOut.model_validate(user).model_dump(),
        classrooms=_classrooms_for(db, user),
    )


@profile_router.post("/change-password", response_model=MessageOut)
def change_password(
    payload: ChangePasswordIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    if not verify_password(payload.current_password, user.password_hash):
        raise ApiError(400, "invalid_password", "Ағымдағы құпиясөз қате.")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    now = datetime.now(UTC)
    for token in db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        )
    ).scalars().all():
        token.revoked_at = now
    db.commit()
    log_action(db, user.id, "password_changed", "user", user.id)
    db.commit()
    return MessageOut(message="Құпиясөз жаңартылды. Қайта кіріңіз.")


