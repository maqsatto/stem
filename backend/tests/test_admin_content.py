"""CMS publishing, content privacy, sanitization and upload validation."""

from tests.helpers import (
    auth,
    create_algorithm,
    create_lesson,
    create_resource,
    create_task,
    create_user,
    login,
)


def test_answer_key_and_resource_audience_leakage(client, db):
    student = create_user(db, role="student")
    teacher = create_user(db, role="teacher")
    admin = create_user(db, role="admin")
    lesson = create_lesson(db)
    task = create_task(db)
    create_resource(db, "lesson", lesson.id, audience="student", url="https://example.com/student")
    create_resource(db, "lesson", lesson.id, audience="teacher", url="https://example.com/teacher")
    create_resource(db, "lesson", lesson.id, audience="admin", url="https://example.com/admin")

    student_headers = auth(login(client, student.email))
    teacher_headers = auth(login(client, teacher.email))
    admin_headers = auth(login(client, admin.email))

    student_task = client.get(f"/api/v1/tasks/{task.id}", headers=student_headers)
    assert student_task.status_code == 200
    assert all(option["is_correct"] is None for option in student_task.json()["options"])
    assert student_task.json()["answer_key_available"] is False

    teacher_task = client.get(f"/api/v1/tasks/{task.id}", headers=teacher_headers)
    assert teacher_task.status_code == 200
    assert all(option["is_correct"] is not None for option in teacher_task.json()["options"])
    assert teacher_task.json()["answer_key_available"] is True

    admin_task = client.get(f"/api/v1/tasks/{task.id}", headers=admin_headers)
    assert admin_task.status_code == 200
    assert all(option["is_correct"] is not None for option in admin_task.json()["options"])

    student_lesson = client.get(f"/api/v1/lessons/{lesson.id}", headers=student_headers)
    assert student_lesson.status_code == 200
    assert {item["audience"] for item in student_lesson.json()["resources"]} == {"student"}

    teacher_lesson = client.get(f"/api/v1/lessons/{lesson.id}", headers=teacher_headers)
    assert teacher_lesson.status_code == 200
    assert {item["audience"] for item in teacher_lesson.json()["resources"]} == {
        "student",
        "teacher",
    }

    admin_lesson = client.get(f"/api/v1/lessons/{lesson.id}", headers=admin_headers)
    assert admin_lesson.status_code == 200
    assert len(admin_lesson.json()["resources"]) == 3


def test_draft_content_is_not_public(client, db):
    student = create_user(db, role="student")
    admin = create_user(db, role="admin")
    draft = create_algorithm(db, status="draft")
    student_headers = auth(login(client, student.email))
    admin_headers = auth(login(client, admin.email))

    listing = client.get("/api/v1/algorithms", headers=student_headers)
    assert listing.status_code == 200
    assert all(item["id"] != str(draft.id) for item in listing.json()["items"])

    detail = client.get(f"/api/v1/algorithms/{draft.slug}", headers=student_headers)
    assert detail.status_code == 404

    admin_detail = client.get(f"/api/v1/admin/algorithms/{draft.id}", headers=admin_headers)
    assert admin_detail.status_code == 200
    assert admin_detail.json()["status"] == "draft"


def test_admin_publish_flow_and_audit(client, db):
    admin = create_user(db, role="admin")
    student = create_user(db, role="student")
    admin_headers = auth(login(client, admin.email))
    student_headers = auth(login(client, student.email))

    forbidden = client.post(
        "/api/v1/admin/algorithms",
        json={"title": "Рұқсатсыз", "summary": "", "body": ""},
        headers=student_headers,
    )
    assert forbidden.status_code == 403

    created = client.post(
        "/api/v1/admin/algorithms",
        json={"title": "Жаңа алгоритм", "summary": "", "body": "", "is_demo": True},
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    algorithm_id = created.json()["id"]
    slug = created.json()["slug"]
    assert created.json()["status"] == "draft"

    public_before = client.get("/api/v1/algorithms", headers=student_headers)
    assert all(item["slug"] != slug for item in public_before.json()["items"])

    incomplete = client.post(
        f"/api/v1/admin/algorithms/{algorithm_id}/publish", headers=admin_headers
    )
    assert incomplete.status_code == 422
    assert incomplete.json()["code"] == "incomplete_content"

    patched = client.patch(
        f"/api/v1/admin/algorithms/{algorithm_id}",
        json={
            "summary": "Қысқаша сипаттама",
            "body": "<p>Толық мазмұн</p><script>alert(1)</script>"
            '<a href="javascript:alert(1)">сілтеме</a>',
        },
        headers=admin_headers,
    )
    assert patched.status_code == 200, patched.text
    assert "<script" not in patched.json()["body"].lower()
    assert "javascript:" not in patched.json()["body"].lower()

    published = client.post(
        f"/api/v1/admin/algorithms/{algorithm_id}/publish", headers=admin_headers
    )
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "published"

    public_after = client.get(f"/api/v1/algorithms/{slug}", headers=student_headers)
    assert public_after.status_code == 200
    assert public_after.json()["id"] == algorithm_id

    audit = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert audit.status_code == 200
    text = str(audit.json())
    assert "content_published" in text


def test_upload_validation_and_download(client, db):
    student = create_user(db, role="student")
    headers = auth(login(client, student.email))

    bad_extension = client.post(
        "/api/v1/uploads",
        files={"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")},
        headers=headers,
    )
    assert bad_extension.status_code == 422
    assert bad_extension.json()["code"] == "invalid_file_type"

    mime_mismatch = client.post(
        "/api/v1/uploads",
        files={"file": ("fake.pdf", b"%PDF-1.4 test", "text/plain")},
        headers=headers,
    )
    assert mime_mismatch.status_code == 422
    assert mime_mismatch.json()["code"] == "mime_mismatch"

    content_mismatch = client.post(
        "/api/v1/uploads",
        files={"file": ("fake.pdf", b"this is not a pdf", "application/pdf")},
        headers=headers,
    )
    assert content_mismatch.status_code == 422
    assert content_mismatch.json()["code"] == "content_mismatch"

    valid = client.post(
        "/api/v1/uploads",
        files={"file": ("report.pdf", b"%PDF-1.4\n% test content\n", "application/pdf")},
        headers=headers,
    )
    assert valid.status_code == 201, valid.text
    resource_id = valid.json()["id"]
    assert valid.json()["mime"] == "application/pdf"

    download = client.get(f"/api/v1/uploads/{resource_id}/download", headers=headers)
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF")
    assert download.headers["cache-control"] == "private, no-store"

    other = create_user(db, role="student")
    other_headers = auth(login(client, other.email))
    assert (
        client.get(f"/api/v1/uploads/{resource_id}/download", headers=other_headers).status_code
        == 404
    )


def test_upload_size_limit(client, db, monkeypatch):
    from app.core.config import settings

    student = create_user(db, role="student")
    headers = auth(login(client, student.email))
    monkeypatch.setattr(settings, "max_upload_mb", 0)

    response = client.post(
        "/api/v1/uploads",
        files={"file": ("report.pdf", b"%PDF-1.4\n", "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 413
    assert response.json()["code"] == "file_too_large"


def test_student_cannot_use_admin_uploads(client, db):
    student = create_user(db, role="student")
    headers = auth(login(client, student.email))
    response = client.post(
        "/api/v1/admin/uploads",
        files={"file": ("report.pdf", b"%PDF-1.4\n", "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 403
