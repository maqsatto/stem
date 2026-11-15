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
