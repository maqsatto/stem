import secrets
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.errors import ApiError

# Expected MIME families for allowed extensions. Browsers are inconsistent, so
# several values are accepted, but executable/script types never pass.
MIME_MAP: dict[str, tuple[str, ...]] = {
    "pdf": ("application/pdf",),
    "docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
        "application/octet-stream",
    ),
    "pptx": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/zip",
        "application/octet-stream",
    ),
    "xlsx": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
        "application/octet-stream",
    ),
    "csv": ("text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"),
    "ipynb": ("application/json", "text/plain", "application/octet-stream"),
    "png": ("image/png",),
    "jpg": ("image/jpeg",),
    "jpeg": ("image/jpeg",),
    "webp": ("image/webp",),
}

MAGIC_MAP = {
    "pdf": (b"%PDF",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "webp": (b"RIFF",),
    "docx": (b"PK\x03\x04",),
    "pptx": (b"PK\x03\x04",),
    "xlsx": (b"PK\x03\x04",),
}


class StoredFile:
    def __init__(self, file_key: str, original_filename: str, mime: str, size: int):
        self.file_key = file_key
        self.original_filename = original_filename
        self.mime = mime
        self.size = size


def ensure_upload_dir() -> Path:
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_extension(filename: str) -> str:
    ext = Path(filename or "").suffix.lower().lstrip(".")
    if not ext or ext not in settings.allowed_extension_set:
        raise ApiError(
            422,
            "invalid_file_type",
            f"Рұқсат етілмеген файл кеңейтімі. Рұқсат етілген: {', '.join(sorted(settings.allowed_extension_set))}",
        )
    return ext


async def save_upload(upload: UploadFile, subdir: str = "resource") -> StoredFile:
    filename = Path(upload.filename or "file").name
    ext = _safe_extension(filename)
    content_type = (upload.content_type or "application/octet-stream").lower()
    allowed_mimes = MIME_MAP.get(ext, ())
    if content_type not in allowed_mimes:
        raise ApiError(
            422,
            "mime_mismatch",
            f"Файл түрі ({content_type}) кеңейтімге сәйкес емес ({ext}).",
        )

    content = await upload.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise ApiError(
            413,
            "file_too_large",
            f"Файл өлшемі {settings.max_upload_mb} МБ-тан аспауы керек.",
        )
    if not content:
        raise ApiError(422, "empty_file", "Бос файл жүктеп болмайды.")

    signatures = MAGIC_MAP.get(ext)
    if signatures and not any(content.startswith(signature) for signature in signatures):
        raise ApiError(
            422,
            "content_mismatch",
            "Файл мазмұны оның кеңейтіміне сәйкес келмейді.",
        )
    if ext in {"ipynb", "csv"} and b"\x00" in content[:2048]:
        raise ApiError(422, "content_mismatch", "Файл мазмұны қауіпсіз мәтін форматына сәйкес емес.")

    key = f"{subdir}/{uuid.uuid4().hex}{secrets.token_hex(4)}.{ext}"
    destination = ensure_upload_dir() / key
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    return StoredFile(
        file_key=key,
        original_filename=filename[:255],
        mime=content_type,
        size=len(content),
    )


def storage_path(file_key: str) -> Path:
    root = ensure_upload_dir().resolve()
    candidate = (root / file_key).resolve()
    if root not in candidate.parents and candidate != root:
        raise ApiError(400, "invalid_file_key", "Қате файл кілті.")
    return candidate


def delete_stored_file(file_key: str | None) -> None:
    if not file_key:
        return
    path = storage_path(file_key)
    if path.exists() and path.is_file():
        path.unlink()
