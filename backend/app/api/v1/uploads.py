import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.errors import ApiError
from app.db.session import get_db
from app.models.content import Resource
from app.models.enums import Audience, ResourceKind, Role
from app.models.user import User
from app.schemas.content import ResourceOut
from app.services.storage import delete_stored_file, save_upload, storage_path

router = APIRouter(tags=["uploads"])


def upload_out(resource: Resource) -> dict:
    return {
        "id": resource.id,
        "title": resource.title,
        "audience": resource.audience,
        "kind": resource.kind,
        "url": None,
        "original_filename": resource.original_filename,
        "mime": resource.mime,
        "size": resource.size,
        "download_url": f"/api/v1/uploads/{resource.id}/download",
    }


@router.post("/uploads", response_model=ResourceOut, status_code=201)
async def upload_student_file(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stored = await save_upload(file, subdir="uploads")
    resource = Resource(
        entity_type="upload",
        entity_id=user.id,
        audience=Audience.student.value,
        kind=ResourceKind.file.value,
        title=(title or stored.original_filename)[:250],
        file_key=stored.file_key,
        original_filename=stored.original_filename,
        mime=stored.mime,
        size=stored.size,
        uploaded_by=user.id,
        created_at=datetime.now(UTC),
    )
    db.add(resource)
    db.commit()
    return upload_out(resource)


@router.get("/uploads/{resource_id}/download")
def download_own_upload(
    resource_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    resource = db.get(Resource, resource_id)
    if resource is None or resource.entity_type != "upload":
        raise ApiError(404, "not_found", "Файл табылмады.")
    if user.role != Role.admin.value and resource.uploaded_by != user.id:
        raise ApiError(404, "not_found", "Файл табылмады.")
    if not resource.file_key:
        raise ApiError(404, "not_found", "Файл табылмады.")
    path = storage_path(resource.file_key)
    if not Path(path).exists():
        raise ApiError(404, "not_found", "Файл табылмады.")
    return FileResponse(
        path,
        media_type=resource.mime or "application/octet-stream",
        filename=resource.original_filename or "file",
        headers={"Cache-Control": "private, no-store"},
    )


@router.delete("/uploads/{resource_id}", response_model=dict)
def delete_own_upload(
    resource_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    resource = db.get(Resource, resource_id)
    if resource is None or resource.entity_type != "upload":
        raise ApiError(404, "not_found", "Файл табылмады.")
    if user.role != Role.admin.value and resource.uploaded_by != user.id:
        raise ApiError(404, "not_found", "Файл табылмады.")
    from app.models.classroom import SubmissionFile

    referenced = db.query(SubmissionFile).filter(SubmissionFile.file_key == resource.file_key).first()
    if referenced is not None:
        raise ApiError(409, "file_in_use", "Файл тапсырылған жұмысқа тіркелген, жою мүмкін емес.")
    delete_stored_file(resource.file_key)
    db.delete(resource)
    db.commit()
    return {"message": "Файл жойылды."}
