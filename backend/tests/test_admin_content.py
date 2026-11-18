"""CMS publishing, content privacy, sanitization and upload validation."""

from tests.helpers import (
    auth,
    create_algorithm,
    create_competency,
    create_lesson,
    create_resource,
    create_task,
    create_user,
    login,
)


def test_admin_can_add_english_lesson_translation_without_overwriting_kazakh(client, db):
    admin = create_user(db, role="admin")
    headers = auth(login(client, admin.email))
    response = client.post("/api/v1/admin/lessons", headers=headers, json={
        "title": "Қазақша сабақ", "summary": "Қазақша", "body": "<p>Мәтін</p>",
        "competency_ids": [str(create_competency(db).id)],
        "translation_en": {"title": "English lesson", "summary": "English summary", "body": "<p>English</p><script>bad()</script>"},
    })
    assert response.status_code == 201
    lesson_id = response.json()["id"]
    assert response.json()["title"] == "Қазақша сабақ"
    assert response.json()["translation_en"]["title"] == "English lesson"
    assert "<script>" not in response.json()["translation_en"]["body"]
    assert client.post(f"/api/v1/admin/lessons/{lesson_id}/publish", headers=headers).status_code == 200
    public = client.get(f"/api/v1/lessons/{lesson_id}")
    assert public.status_code == 200
    assert public.json()["translation_en"]["summary"] == "English summary"
    assert public.json()["summary"] == "Қазақша"


def test_admin_can_add_english_algorithm_content(client, db):
    headers = auth(login(client, create_user(db, role="admin").email))
    created = client.post("/api/v1/admin/algorithms", headers=headers, json={
        "title": "Жіктеу", "title_en": "Classification", "summary": "Сипаттама", "body": "<p>Мәтін</p>",
        "translation_en": {"summary": "English summary", "body": "<p>English content</p><script>bad()</script>"},
    })
    assert created.status_code == 201
    algorithm_id = created.json()["id"]
    assert created.json()["translation_en"]["summary"] == "English summary"
    assert "<script>" not in created.json()["translation_en"]["body"]
    assert client.post(f"/api/v1/admin/algorithms/{algorithm_id}/publish", headers=headers).status_code == 200
    public = client.get(f"/api/v1/algorithms/{created.json()['slug']}").json()
    assert public["summary"] == "Сипаттама"
    assert public["translation_en"]["body"].startswith("<p>English content</p>")


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


def test_project_english_translation_preserves_original_and_sanitizes_html(client, db):
    admin = create_user(db, role="admin")
    headers = auth(login(client, admin.email))
    response = client.post(
        "/api/v1/admin/projects",
        headers=headers,
        json={"title": "Жоба", "translation_en": {"title": "Project", "body": "<p>English</p><script>alert(1)</script>", "steps_json": ["Build"]}},
    )
    assert response.status_code == 201, response.text
    project = response.json()
    assert project["title"] == "Жоба"
    assert project["translation_en"]["title"] == "Project"
    assert "<script" not in project["translation_en"]["body"]
    assert project["translation_en"]["steps_json"] == ["Build"]
    saved = client.get(f"/api/v1/admin/projects/{project['id']}", headers=headers).json()
    assert saved["translation_en"] == project["translation_en"]


def test_task_english_translation_keeps_answer_keys_private(client, db):
    admin = create_user(db, role="admin")
    student = create_user(db, role="student")
    admin_headers = auth(login(client, admin.email))
    student_headers = auth(login(client, student.email))
    response = client.post("/api/v1/admin/tasks", headers=admin_headers, json={
        "title": "Тапсырма", "type": "single_choice", "status": "published",
        "body": "Сұрақ", "instructions": "Жауап", "competency_ids": [str(create_competency(db).id)], "translation_en": {"title": "Task", "body": "Question", "rubric_labels": ["Clarity"]},
        "options": [{"label": "Иә", "label_en": "Yes", "is_correct": True}, {"label": "Жоқ", "label_en": "No"}],
    })
    assert response.status_code == 201, response.text
    task = client.get(f"/api/v1/tasks/{response.json()['id']}", headers=student_headers).json()
    assert task["translation_en"]["title"] == "Task"
    assert task["translation_en"]["rubric_labels"] == ["Clarity"]
    assert task["options"][0]["label_en"] == "Yes"
    assert all(option.get("is_correct") is None for option in task["options"])


def test_assessment_english_translation_is_copied_to_new_version_and_hides_answers(client, db):
    admin_headers = auth(login(client, create_user(db, role="admin").email))
    student_headers = auth(login(client, create_user(db, role="student").email))
    competency = create_competency(db)
    created = client.post("/api/v1/admin/assessments", headers=admin_headers, json={
        "name": "Тест", "kind": "quiz", "description": "Сипаттама", "instructions": "Нұсқау",
        "translation_en": {"name": "Test", "instructions": "Instructions"},
        "questions": [{"type": "single_choice", "body": "Сұрақ", "body_en": "Question", "competency_id": str(competency.id),
                       "options": [{"label": "Иә", "label_en": "Yes", "is_correct": True}, {"label": "Жоқ", "label_en": "No"}]}],
    })
    assert created.status_code == 201, created.text
    assessment_id = created.json()["id"]
    assert created.json()["translation_en"]["name"] == "Test"
    assert client.post(f"/api/v1/admin/assessments/{assessment_id}/publish", headers=admin_headers).status_code == 200
    detail = client.get(f"/api/v1/assessments/{assessment_id}", headers=student_headers).json()
    assert detail["questions"][0]["body_en"] == "Question"
    assert detail["questions"][0]["options"][0]["label_en"] == "Yes"
    assert detail["questions"][0]["options"][0]["is_correct"] is None
    clone = client.post(f"/api/v1/admin/assessments/{assessment_id}/new-version", headers=admin_headers).json()
    assert clone["translation_en"]["name"] == "Test"
    assert clone["questions"][0]["body_en"] == "Question"


def test_editing_task_preserves_existing_option_ids(client, db):
    headers = auth(login(client, create_user(db, role="admin").email))
    created = client.post("/api/v1/admin/tasks", headers=headers, json={
        "title": "Тапсырма", "type": "single_choice",
        "options": [{"label": "Иә", "is_correct": True}, {"label": "Жоқ"}],
    }).json()
    options = created["options"]
    updated = client.patch(f"/api/v1/admin/tasks/{created['id']}", headers=headers, json={
        "options": [{"id": str(o["id"]), "label": o["label"], "label_en": "Translation", "is_correct": o["is_correct"], "order_no": o["order_no"]} for o in options]
    })
    assert updated.status_code == 200, updated.text
    assert [o["id"] for o in updated.json()["options"]] == [o["id"] for o in options]


def test_competency_english_fields_can_be_published(client, db):
    headers = auth(login(client, create_user(db, role="admin").email))
    created = client.post("/api/v1/admin/competencies", headers=headers, json={
        "title": "Ойлау", "description": "Сипаттама", "indicators_json": ["Белгі"],
        "translation_en": {"title": "Thinking", "description": "<p>Description</p><script>bad()</script>", "indicators_json": ["Indicator"]},
    })
    assert created.status_code == 201, created.text
    assert created.json()["translation_en"]["title"] == "Thinking"
    assert "<script" not in created.json()["translation_en"]["description"]
    assert client.post(f"/api/v1/admin/competencies/{created.json()['id']}/publish", headers=headers).status_code == 200
    detail = client.get(f"/api/v1/competencies/{created.json()['slug']}").json()
    assert detail["translation_en"]["indicators_json"] == ["Indicator"]
