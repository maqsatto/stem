import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def log_action(
    db: Session,
    actor_id: uuid.UUID | None,
    action: str,
    entity: str,
    entity_id: uuid.UUID | None = None,
    details: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details_json=details or {},
            created_at=datetime.now(UTC),
        )
    )
