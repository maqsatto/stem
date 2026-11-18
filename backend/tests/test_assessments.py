"""Diagnostics: answer-key hiding, server-side scoring, pre/post comparison and CSV."""

from tests.helpers import (
    auth,
    create_assessment,
    create_assignment,
    create_classroom,
    create_competency,
    create_task,
    create_user,
    login,
    question,
)


def build_pre_post(db):
    comp_logic = create_competency(db, "Логика")
    comp_data = create_competency(db, "Деректер")

    def question_set():
        return [
            question(
                "single_choice",
                comp_logic,
                correct=["Дұрыс логика"],
                wrong=["Қате 1", "Қате 2"],
                points=10,
                body="Логикалық сұрақ",
            ),
            question(
                "multiple_choice",
                comp_data,
                correct=["Дұрыс A", "Дұрыс B"],
                wrong=["Қате C", "Қате D"],
                points=10,
                body="Деректер сұрағы",
            ),
        ]

    pre = create_assessment(
        db, kind="pre", methodology_key="stem-test-v1", questions=question_set()
    )
    post = create_assessment(
        db, kind="post", methodology_key="stem-test-v1", questions=question_set()
    )
    return pre, post


def answer_payload(assessment, selected_by_index):
    answers = []
    for index, question_obj in enumerate(assessment.questions):
        answers.append(
            {
                "question_id": str(question_obj.id),
                "answer_json": {
                    "selected_option_ids": [
                        str(item) for item in selected_by_index.get(index, [])
                    ]
                },
            }
        )
    return {"answers": answers}


def correct_ids(assessment, index):
    question_obj = assessment.questions[index]
    return [str(item["id"]) for item in question_obj.options_json if item.get("is_correct")]


def test_pre_post_scoring_comparison_and_answer_key_hiding(client, db):
    pre, post = build_pre_post(db)
    pre.questions[0].competency.translation_en = {"title": "English competency"}
    db.commit()
    student = create_user(db, role="student")
    other = create_user(db, role="student")
    headers = auth(login(client, student.email))
    other_headers = auth(login(client, other.email))

    detail = client.get(f"/api/v1/assessments/{pre.id}", headers=headers)
    assert detail.status_code == 200
    assert all(
        option["is_correct"] is None
        for question_obj in detail.json()["questions"]
        for option in question_obj["options"]
    )
    assert detail.json()["show_correct_answers"] is True
    assert detail.json()["question_count"] == 2

    student_question_ids = [item["id"] for item in detail.json()["questions"]]
    assert student_question_ids == [str(item.id) for item in pre.questions]

    started = client.post(f"/api/v1/assessments/{pre.id}/attempts", headers=headers)
    assert started.status_code == 200, started.text
    pre_attempt_id = started.json()["id"]
    assert started.json()["status"] == "in_progress"

    # The student cannot see question answers before submitting.
    hidden = client.get(f"/api/v1/attempts/{pre_attempt_id}", headers=headers)
    assert hidden.status_code == 200
    assert hidden.json()["answers"] == []

    saved = client.patch(
        f"/api/v1/attempts/{pre_attempt_id}/answers",
        json=answer_payload(
            pre,
            {
                0: correct_ids(pre, 0),
                1: correct_ids(pre, 1)[:1],  # partial multiple choice is wrong
            },
        ),
        headers=headers,
    )
    assert saved.status_code == 200, saved.text
    assert all(answer["correct_option_ids"] is None for answer in saved.json()["answers"])

    assert (
        client.get(f"/api/v1/attempts/{pre_attempt_id}", headers=other_headers).status_code
        == 404
    )

    submitted = client.post(
        f"/api/v1/attempts/{pre_attempt_id}/submit", headers=headers
    )
    assert submitted.status_code == 200, submitted.text
    pre_attempt = submitted.json()
    assert pre_attempt["status"] == "submitted"
    assert pre_attempt["total_score"] == 10.0
    assert pre_attempt["max_score"] == 20.0
    assert pre_attempt["percent"] == 50.0
    assert len(pre_attempt["competency_scores"]) == 2
    assert all(
        answer["correct_option_ids"] is not None for answer in pre_attempt["answers"]
    )

    # A repeated submit is idempotent and does not rescore or duplicate scores.
    repeated = client.post(
        f"/api/v1/attempts/{pre_attempt_id}/submit", headers=headers
    )
    assert repeated.status_code == 200
    assert repeated.json()["total_score"] == 10.0
    assert len(repeated.json()["competency_scores"]) == 2

    post_started = client.post(f"/api/v1/assessments/{post.id}/attempts", headers=headers)
    assert post_started.status_code == 200
    post_attempt_id = post_started.json()["id"]
    post_answers = answer_payload(
        post,
        {0: correct_ids(post, 0), 1: correct_ids(post, 1)},
    )
    assert (
        client.patch(
            f"/api/v1/attempts/{post_attempt_id}/answers",
            json=post_answers,
            headers=headers,
        ).status_code
        == 200
    )
    post_submitted = client.post(
        f"/api/v1/attempts/{post_attempt_id}/submit", headers=headers
    )
    assert post_submitted.status_code == 200
    assert post_submitted.json()["total_score"] == 20.0
    assert post_submitted.json()["percent"] == 100.0

    results = client.get("/api/v1/me/results", headers=headers)
    assert results.status_code == 200, results.text
    body = results.json()
    assert body["progress"]["lessons_total"] >= 0
    assert len(body["comparisons"]) == 1
    comparison = body["comparisons"][0]
    assert comparison["methodology_key"] == "stem-test-v1"
    assert comparison["pre_overall"] == 50.0
    assert comparison["post_overall"] == 100.0
    assert comparison["overall_delta_pp"] == 50.0
    assert len(comparison["rows"]) == 2
    assert "English competency" in [row["title_en"] for row in comparison["rows"]]
    assert "English competency" in [row["title_en"] for row in body["competency_summary"]]
    assert {row["delta_pp"] for row in comparison["rows"]} == {0.0, 100.0}
    assert any(item["delta_pp"] is not None for item in body["competency_summary"])
    assert len(body["competency_summary"]) == 2

    other_results = client.get("/api/v1/me/results", headers=other_headers)
    assert other_results.status_code == 200
    assert other_results.json()["comparisons"] == []
    assert other_results.json()["message"]


def test_attempt_limit(client, db):
    competency = create_competency(db)
    assessment = create_assessment(
        db,
        kind="quiz",
        methodology_key="limit-test",
        questions=[
            question("single_choice", competency, correct=["Дұрыс"], wrong=["Қате"])
        ],
        attempts_limit=1,
    )
    student = create_user(db, role="student")
    headers = auth(login(client, student.email))

    started = client.post(
        f"/api/v1/assessments/{assessment.id}/attempts", headers=headers
    )
    assert started.status_code == 200
    attempt_id = started.json()["id"]
    submitted = client.post(f"/api/v1/attempts/{attempt_id}/submit", headers=headers)
    assert submitted.status_code == 200

    exhausted = client.post(
        f"/api/v1/assessments/{assessment.id}/attempts", headers=headers
    )
    assert exhausted.status_code == 409
    assert exhausted.json()["code"] == "attempts_exhausted"


def test_question_can_score_multiple_competencies(client, db):
    first = create_competency(db, "First")
    second = create_competency(db, "Second")
    admin = create_user(db, role="admin")
    student = create_user(db, role="student")
    admin_headers = auth(login(client, admin.email))
    created = client.post("/api/v1/admin/assessments", headers=admin_headers, json={
        "name": "Multiple competencies", "kind": "pre", "methodology_key": "multi",
        "questions": [{"type": "single_choice", "body": "Question", "points": 2,
                       "competency_ids": [str(first.id), str(second.id)],
                       "competency_weights": {str(first.id): 1, str(second.id): 3},
                       "options": [{"label": "Yes", "is_correct": True}, {"label": "No", "is_correct": False}]}],
    })
    assert created.status_code == 201, created.text
    assessment_id = created.json()["id"]
    assert client.post(f"/api/v1/admin/assessments/{assessment_id}/publish", headers=admin_headers).status_code == 200
    headers = auth(login(client, student.email))
    detail = client.get(f"/api/v1/assessments/{assessment_id}", headers=headers).json()
    question_obj = detail["questions"][0]
    assert set(question_obj["competency_ids"]) == {str(first.id), str(second.id)}
    attempt = client.post(f"/api/v1/assessments/{assessment_id}/attempts", headers=headers).json()
    client.patch(f"/api/v1/attempts/{attempt['id']}/answers", headers=headers, json={"answers": [
        {"question_id": question_obj["id"], "answer_json": {"selected_option_ids": [question_obj["options"][0]["id"]]}}
    ]})
    result = client.post(f"/api/v1/attempts/{attempt['id']}/submit", headers=headers).json()
    assert result["total_score"] == 2
    assert {score["competency_id"] for score in result["competency_scores"]} == {str(first.id), str(second.id)}
    scores = {score["competency_id"]: score for score in result["competency_scores"]}
    assert scores[str(first.id)]["maximum"] == 2
    assert scores[str(second.id)]["maximum"] == 6
    cloned = client.post(f"/api/v1/admin/assessments/{assessment_id}/new-version", headers=admin_headers)
    assert cloned.status_code == 201
    cloned_question = cloned.json()["questions"][0]
    assert cloned_question["competency_weights"] == {str(first.id): 1, str(second.id): 3}


def test_invalid_question_competency_weight_is_rejected(client, db):
    comp = create_competency(db)
    other = create_competency(db)
    headers = auth(login(client, create_user(db, role="admin").email))
    payload = {"name": "Invalid weights", "kind": "pre", "questions": [
        {"type": "single_choice", "body": "Question", "competency_ids": [str(comp.id)],
         "competency_weights": {str(other.id): 2}, "options": []}
    ]}
    result = client.post("/api/v1/admin/assessments", headers=headers, json=payload)
    assert result.status_code == 422
    assert result.json()["code"] == "invalid_competency_weight"
    payload["questions"][0]["competency_weights"] = {str(comp.id): 0}
    result = client.post("/api/v1/admin/assessments", headers=headers, json=payload)
    assert result.status_code == 422
    assert result.json()["code"] == "invalid_competency_weight"


def test_in_progress_attempt_is_linked_to_authorized_assignment_and_counted(client, db):
    comp = create_competency(db)
    assessment = create_assessment(
        db, questions=[question("single_choice", comp, correct=["Дұрыс"], wrong=["Қате"])],
    )
    teacher = create_user(db, role="teacher")
    student = create_user(db, role="student")
    other_teacher = create_user(db, role="teacher")
    classroom = create_classroom(db, teacher, [student])
    other_class = create_classroom(db, other_teacher)
    assignment = create_assignment(db, classroom, "assessment", assessment.id)
    other_assignment = create_assignment(db, other_class, "assessment", assessment.id)
    headers = auth(login(client, student.email))
    teacher_headers = auth(login(client, teacher.email))

    started = client.post(f"/api/v1/assessments/{assessment.id}/attempts", headers=headers)
    assert started.status_code == 200
    attempt_id = started.json()["id"]
    forbidden = client.post(
        f"/api/v1/assessments/{assessment.id}/attempts",
        json={"assignment_id": str(other_assignment.id)}, headers=headers,
    )
    assert forbidden.status_code == 404
    resumed = client.post(
        f"/api/v1/assessments/{assessment.id}/attempts",
        json={"assignment_id": str(assignment.id)}, headers=headers,
    )
    assert resumed.status_code == 200
    assert resumed.json()["id"] == attempt_id
    assert client.get(f"/api/v1/attempts/{attempt_id}", headers=teacher_headers).status_code == 200
    roster = client.get(f"/api/v1/assignments/{assignment.id}/submissions", headers=teacher_headers)
    assert roster.json()["students"][0]["status"] == "in_progress"
    assert client.post(f"/api/v1/attempts/{attempt_id}/submit", headers=headers).status_code == 200
    roster = client.get(f"/api/v1/assignments/{assignment.id}/submissions", headers=teacher_headers)
    assert roster.json()["students"][0]["status"] == "submitted"
    assert roster.json()["submitted_count"] == 1
    assignments = client.get("/api/v1/assignments", headers=teacher_headers).json()["items"]
    assert assignments[0]["submitted_count"] == 1


def test_teacher_csv_is_scoped_and_has_bom(client, db):
    comp = create_competency(db, "CSV құзыреттілігі")
    pre = create_assessment(
        db,
        kind="pre",
        methodology_key="csv-test-v1",
        questions=[question("single_choice", comp, correct=["Дұрыс"], wrong=["Қате"])],
    )
    post = create_assessment(
        db,
        kind="post",
        methodology_key="csv-test-v1",
        questions=[question("single_choice", comp, correct=["Дұрыс"], wrong=["Қате"])],
    )
    teacher = create_user(db, role="teacher")
    other_teacher = create_user(db, role="teacher")
    student = create_user(db, role="student", display_name="CSV Оқушы")
    other_student = create_user(db, role="student", display_name="Басқа оқушы")
    classroom = create_classroom(db, teacher, [student])
    other_class = create_classroom(db, other_teacher, [other_student])
    for assessment in (pre, post):
        create_assignment(db, classroom, "assessment", assessment.id)
        create_assignment(db, other_class, "assessment", assessment.id)

    headers = auth(login(client, student.email))
    for assessment in (pre, post):
        started = client.post(
            f"/api/v1/assessments/{assessment.id}/attempts", headers=headers
        )
        assert started.status_code == 200
        client.post(f"/api/v1/attempts/{started.json()['id']}/submit", headers=headers)

    teacher_headers = auth(login(client, teacher.email))
    response = client.get(
        f"/api/v1/teacher/classes/{classroom.id}/results.csv", headers=teacher_headers
    )
    assert response.status_code == 200, response.text
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert "text/csv" in response.headers["content-type"]
    text = response.content.decode("utf-8-sig")
    assert "Оқушы" in text
    assert "Delta" in text
    assert "CSV Оқушы" in text
    assert "Басқа оқушы" not in text

    other_headers = auth(login(client, other_teacher.email))
    forbidden = client.get(
        f"/api/v1/teacher/classes/{classroom.id}/results.csv", headers=other_headers
    )
    assert forbidden.status_code == 404

    student_csv = client.get(
        f"/api/v1/teacher/classes/{classroom.id}/results.csv", headers=headers
    )
    assert student_csv.status_code == 403


def test_teacher_dashboard_counts(client, db):
    teacher = create_user(db, role="teacher")
    student = create_user(db, role="student")
    classroom = create_classroom(db, teacher, [student])
    task = create_task(db, task_type="open_text", max_score=20)
    assignment = create_assignment(db, classroom, "task", task.id)
    headers = auth(login(client, student.email))
    client.post(
        f"/api/v1/assignments/{assignment.id}/submissions",
        json={"text": "Тексеруді күтіп тұр"},
        headers=headers,
    )

    teacher_headers = auth(login(client, teacher.email))
    dashboard = client.get("/api/v1/teacher/dashboard", headers=teacher_headers)
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["classrooms"] == 1
    assert body["students"] == 1
    assert body["assignments"] == 1
    assert body["pending_reviews"] == 1


def test_class_report_shows_pre_results_before_post_is_completed(client, db):
    comp = create_competency(db, "Логика")
    pre = create_assessment(
        db, kind="pre", methodology_key="baseline",
        questions=[question("single_choice", comp, correct=["Дұрыс"], wrong=["Қате"])],
    )
    teacher = create_user(db, role="teacher")
    student = create_user(db, role="student")
    classroom = create_classroom(db, teacher, [student])
    assignment = create_assignment(db, classroom, "assessment", pre.id)
    headers = auth(login(client, student.email))
    started = client.post(
        f"/api/v1/assessments/{pre.id}/attempts",
        json={"assignment_id": str(assignment.id)}, headers=headers,
    )
    attempt_id = started.json()["id"]
    assert client.patch(
        f"/api/v1/attempts/{attempt_id}/answers",
        json=answer_payload(pre, {0: correct_ids(pre, 0)}), headers=headers,
    ).status_code == 200
    assert client.post(f"/api/v1/attempts/{attempt_id}/submit", headers=headers).status_code == 200
    teacher_headers = auth(login(client, teacher.email))
    response = client.get(f"/api/v1/teacher/classes/{classroom.id}/results", headers=teacher_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["students"][0]["pre_overall"] == 100
    assert body["students"][0]["post_overall"] is None
    assert body["students"][0]["delta_pp"] == {}
    assert body["competency_averages"][0]["students_with_pre"] == 1
    assert body["competency_averages"][0]["pre_average"] == 100

    second = create_user(db, role="student")
    second_headers = auth(login(client, second.email))
    assert client.post(
        "/api/v1/classes/join", json={"code": classroom.join_code}, headers=second_headers,
    ).status_code == 200
    post = create_assessment(
        db, kind="post", methodology_key="baseline",
        questions=[question("single_choice", comp, correct=["Дұрыс"], wrong=["Қате"])],
    )
    post_assignment = create_assignment(db, classroom, "assessment", post.id)
    for assessment, assigned, correct in [(pre, assignment, False), (post, post_assignment, True)]:
        started = client.post(
            f"/api/v1/assessments/{assessment.id}/attempts",
            json={"assignment_id": str(assigned.id)}, headers=second_headers,
        )
        current_id = started.json()["id"]
        if correct:
            client.patch(
                f"/api/v1/attempts/{current_id}/answers",
                json=answer_payload(assessment, {0: correct_ids(assessment, 0)}),
                headers=second_headers,
            )
        assert client.post(f"/api/v1/attempts/{current_id}/submit", headers=second_headers).status_code == 200
    row = client.get(
        f"/api/v1/teacher/classes/{classroom.id}/results", headers=teacher_headers,
    ).json()["competency_averages"][0]
    assert row["pre_average"] == 50
    assert row["paired_pre_average"] == 0
    assert row["paired_post_average"] == 100
    assert row["delta_average_pp"] == 100


def test_class_report_does_not_include_attempts_from_another_class(client, db):
    pre, post = build_pre_post(db)
    student = create_user(db, role="student")
    teacher = create_user(db, role="teacher")
    other_teacher = create_user(db, role="teacher")
    classroom = create_classroom(db, teacher, [student])
    other_class = create_classroom(db, other_teacher, [student])
    student_headers = auth(login(client, student.email))
    task = create_task(db, task_type="open_text")
    other_task = create_assignment(db, other_class, "task", task.id)
    assert client.post(
        f"/api/v1/assignments/{other_task.id}/submissions",
        json={"text": "Другая работа"}, headers=student_headers,
    ).status_code == 200
    for assessment in (pre, post):
        assignment = create_assignment(db, other_class, "assessment", assessment.id)
        started = client.post(
            f"/api/v1/assessments/{assessment.id}/attempts",
            json={"assignment_id": str(assignment.id)}, headers=student_headers,
        )
        assert client.post(
            f"/api/v1/attempts/{started.json()['id']}/submit", headers=student_headers,
        ).status_code == 200
    response = client.get(
        f"/api/v1/teacher/classes/{classroom.id}/results",
        headers=auth(login(client, teacher.email)),
    )
    assert response.status_code == 200
    assert response.json()["students"][0]["pre_overall"] is None
    assert response.json()["students"][0]["post_overall"] is None
    assert response.json()["students"][0]["tasks_submitted"] == 0


def test_assessment_metadata_remains_editable_but_questions_stay_locked_after_attempt(client, db):
    competency = create_competency(db)
    assessment = create_assessment(db, questions=[question("single_choice", competency, correct=["Yes"], wrong=["No"])])
    student_headers = auth(login(client, create_user(db, role="student").email))
    admin_headers = auth(login(client, create_user(db, role="admin").email))
    assert client.post(f"/api/v1/assessments/{assessment.id}/attempts", headers=student_headers).status_code == 200
    original_question = str(assessment.questions[0].id)
    metadata = client.patch(f"/api/v1/admin/assessments/{assessment.id}", headers=admin_headers, json={"description": "Updated", "translation_en": {"name": "Assessment"}})
    assert metadata.status_code == 200
    assert metadata.json()["questions"][0]["id"] == original_question
    assert metadata.json()["translation_en"]["name"] == "Assessment"
    changed = client.patch(f"/api/v1/admin/assessments/{assessment.id}", headers=admin_headers, json={"questions": []})
    assert changed.status_code == 409
    assert changed.json()["code"] == "assessment_has_attempts"
