"""Classroom membership, object-level isolation, auto-grading and review flow."""

from tests.helpers import (
    auth,
    create_assignment,
    create_classroom,
    create_competency,
    create_task,
    create_user,
    login,
)


def test_join_code_is_normalized_and_idempotent(client, db):
    teacher = create_user(db, role="teacher")
    student = create_user(db, role="student")
    classroom = create_classroom(db, teacher, code="JOIN01")
    headers = auth(login(client, student.email))

    first = client.post("/api/v1/classes/join", json={"code": " join01 "}, headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["already_member"] is False
    assert first.json()["classroom"]["join_code"] is None

    second = client.post("/api/v1/classes/join", json={"code": "JOIN01"}, headers=headers)
    assert second.status_code == 200
    assert second.json()["already_member"] is True

    listing = client.get("/api/v1/classes", headers=headers)
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["member_count"] == 1

    detail = client.get(f"/api/v1/classes/{classroom.id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["members"] == []


def test_invalid_join_code(client, db):
    student = create_user(db, role="student")
    headers = auth(login(client, student.email))
    response = client.post("/api/v1/classes/join", json={"code": "NOPE00"}, headers=headers)
    assert response.status_code == 404
    assert response.json()["code"] == "invalid_code"


def test_object_level_classroom_isolation(client, db):
    teacher_a = create_user(db, role="teacher")
    teacher_b = create_user(db, role="teacher")
    member = create_user(db, role="student")
    outsider = create_user(db, role="student")
    classroom_a = create_classroom(db, teacher_a, [member], code="CLASSA")
    classroom_b = create_classroom(db, teacher_b, [], code="CLASSB")
    task = create_task(db, competencies=[create_competency(db)])
    assignment_a = create_assignment(db, classroom_a, "task", task.id)

    headers_a = auth(login(client, teacher_a.email))
    headers_b = auth(login(client, teacher_b.email))
    member_headers = auth(login(client, member.email))
    outsider_headers = auth(login(client, outsider.email))

    assert client.get(f"/api/v1/classes/{classroom_a.id}", headers=headers_b).status_code == 404
    assert client.get(f"/api/v1/classes/{classroom_b.id}", headers=headers_a).status_code == 404
    assert (
        client.get(f"/api/v1/classes/{classroom_a.id}/members", headers=headers_b).status_code
        == 404
    )
    assert (
        client.get(f"/api/v1/assignments?classroom_id={classroom_a.id}", headers=headers_b).status_code
        == 404
    )
    assert client.get(f"/api/v1/classes/{classroom_a.id}", headers=outsider_headers).status_code == 404
    assert client.get(f"/api/v1/classes/{classroom_a.id}", headers=member_headers).status_code == 200

    forbidden_submit = client.post(
        f"/api/v1/assignments/{assignment_a.id}/submissions",
        json={"text": "Мен бұл сыныптың мүшесі емеспін"},
        headers=outsider_headers,
    )
    assert forbidden_submit.status_code == 404

    listing_b = client.get("/api/v1/assignments", headers=headers_b)
    assert listing_b.status_code == 200
    assert listing_b.json()["total"] == 0


def test_closed_task_auto_grading_and_attempt_limit(client, db):
    teacher = create_user(db, role="teacher")
    student = create_user(db, role="student")
    other = create_user(db, role="student")
    classroom = create_classroom(db, teacher, [student, other])
    task = create_task(
        db,
        options=[("Дұрыс жауап", True), ("Қате 1", False), ("Қате 2", False)],
        max_score=10,
        attempts_limit=2,
    )
    assignment = create_assignment(db, classroom, "task", task.id)
    headers = auth(login(client, student.email))
    other_headers = auth(login(client, other.email))
    correct = [str(option.id) for option in task.options if option.is_correct]
    wrong = [str(option.id) for option in task.options if not option.is_correct]

    response = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"answers": {"selected_option_ids": correct}},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["auto_checked"] is True
    assert body["grade"] == 10
    assert body["status"] == "reviewed"
    assert body["attempts_count"] == 1
    assert body["correct_option_ids"] == correct
    assert body["answers_json"]["selected_option_ids"] == correct

    repeated = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"answers": {"selected_option_ids": correct}},
        headers=headers,
    )
    assert repeated.status_code == 200
    assert repeated.json()["attempts_count"] == 1
    assert repeated.json()["grade"] == 10

    second = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"answers": {"selected_option_ids": wrong[:1]}},
        headers=headers,
    )
    assert second.status_code == 200
    assert second.json()["attempts_count"] == 2
    assert second.json()["grade"] == 0

    exhausted = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"answers": {"selected_option_ids": correct}},
        headers=headers,
    )
    assert exhausted.status_code == 409
    assert exhausted.json()["code"] == "attempts_exhausted"

    invalid = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"answers": {"selected_option_ids": ["not-an-option"]}},
        headers=other_headers,
    )
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "invalid_answer"

    empty = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"answers": {"selected_option_ids": []}},
        headers=other_headers,
    )
    assert empty.status_code == 422
    assert empty.json()["code"] == "empty_answer"

    wrong_type = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"answers": {"selected_option_ids": "abc"}},
        headers=other_headers,
    )
    assert wrong_type.status_code == 422


def test_open_submission_and_teacher_review(client, db):
    teacher = create_user(db, role="teacher")
    other_teacher = create_user(db, role="teacher")
    student = create_user(db, role="student")
    classroom = create_classroom(db, teacher, [student])
    task = create_task(db, task_type="open_text", max_score=20, attempts_limit=2)
    assignment = create_assignment(db, classroom, "task", task.id)

    student_headers = auth(login(client, student.email))
    teacher_headers = auth(login(client, teacher.email))
    other_headers = auth(login(client, other_teacher.email))

    submitted = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"text": "Менің жауабым", "link": "https://example.com/work"},
        headers=student_headers,
    )
    assert submitted.status_code == 200, submitted.text
    submission_id = submitted.json()["id"]
    assert submitted.json()["status"] == "submitted"

    listing = client.get(
        f"/api/v1/assignments/{assignment.id}/submissions", headers=teacher_headers
    )
    assert listing.status_code == 200
    assert listing.json()["total_students"] == 1
    assert listing.json()["submitted_count"] == 1
    assert len(listing.json()["items"]) == 1

    assert (
        client.get(f"/api/v1/submissions/{submission_id}", headers=other_headers).status_code
        == 404
    )
    assert (
        client.get(f"/api/v1/assignments/{assignment.id}/submissions", headers=other_headers).status_code
        == 404
    )

    too_high = client.patch(
        f"/api/v1/submissions/{submission_id}/review",
        json={"grade": 21, "feedback": "Тым жоғары"},
        headers=teacher_headers,
    )
    assert too_high.status_code == 422
    assert too_high.json()["code"] == "grade_too_high"

    no_feedback = client.patch(
        f"/api/v1/submissions/{submission_id}/review",
        json={"grade": 10, "return_for_revision": True},
        headers=teacher_headers,
    )
    assert no_feedback.status_code == 422
    assert no_feedback.json()["code"] == "feedback_required"

    reviewed = client.patch(
        f"/api/v1/submissions/{submission_id}/review",
        json={"grade": 15, "feedback": "Жақсы жұмыс"},
        headers=teacher_headers,
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "reviewed"
    assert reviewed.json()["grade"] == 15

    resubmit = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"text": "Қайта тапсыру"},
        headers=student_headers,
    )
    assert resubmit.status_code == 409
    assert resubmit.json()["code"] == "already_reviewed"

    returned = client.patch(
        f"/api/v1/submissions/{submission_id}/review",
        json={"grade": 10, "feedback": "Түзетіңіз", "return_for_revision": True},
        headers=teacher_headers,
    )
    assert returned.status_code == 200
    assert returned.json()["status"] == "returned"

    resubmitted = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"text": "Түзетілген жауап"},
        headers=student_headers,
    )
    assert resubmitted.status_code == 200
    assert resubmitted.json()["status"] == "submitted"
    assert resubmitted.json()["attempts_count"] == 2


def test_empty_submission_is_rejected(client, db):
    teacher = create_user(db, role="teacher")
    student = create_user(db, role="student")
    classroom = create_classroom(db, teacher, [student])
    task = create_task(db, task_type="file_upload")
    assignment = create_assignment(db, classroom, "task", task.id)
    headers = auth(login(client, student.email))

    response = client.post(
        f"/api/v1/assignments/{assignment.id}/submissions", json={}, headers=headers
    )
    assert response.status_code == 422
    assert response.json()["code"] == "empty_submission"
