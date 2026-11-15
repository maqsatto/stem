"""Authentication, token rotation, RBAC and admin password reset."""

from tests.helpers import PASSWORD, auth, create_user, login


def test_register_login_and_duplicate_email(client):
    payload = {
        "email": "new.student@test.kz",
        "password": "Passw0rd!",
        "display_name": "Жаңа оқушы",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user"]["role"] == "student"
    assert body["access_token"]

    me = client.get("/api/v1/me", headers=auth(body))
    assert me.status_code == 200
    assert me.json()["email"] == payload["email"]

    duplicate = client.post("/api/v1/auth/register", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "email_taken"

    weak = client.post(
        "/api/v1/auth/register",
        json={**payload, "email": "weak@test.kz", "password": "abcdefgh"},
    )
    assert weak.status_code == 422
    assert weak.json()["code"] == "validation_error"


def test_login_errors_and_unauthorized(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@test.kz", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"

    me = client.get("/api/v1/me")
    assert me.status_code == 401
    assert me.json()["code"] == "unauthorized"


def test_refresh_rotation_and_logout(client, db):
    user = create_user(db, role="student")
    pair = login(client, user.email)
    old_refresh = pair["refresh_token"]

    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert refreshed.status_code == 200, refreshed.text
    new_pair = refreshed.json()
    assert new_pair["refresh_token"] != old_refresh

    reused = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert reused.status_code == 401
    assert reused.json()["code"] == "invalid_refresh"

    logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": new_pair["refresh_token"]},
        headers=auth(new_pair),
    )
    assert logout.status_code == 200

    revoked = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_pair["refresh_token"]}
    )
    assert revoked.status_code == 401


def test_role_based_access(client, db):
    student = create_user(db, role="student")
    teacher = create_user(db, role="teacher")
    admin = create_user(db, role="admin")
    student_headers = auth(login(client, student.email))
    teacher_headers = auth(login(client, teacher.email))
    admin_headers = auth(login(client, admin.email))

    assert client.get("/api/v1/admin/overview", headers=student_headers).status_code == 403
    assert client.get("/api/v1/admin/overview", headers=teacher_headers).status_code == 403
    assert client.get("/api/v1/admin/overview", headers=admin_headers).status_code == 200
    assert client.get("/api/v1/teacher/dashboard", headers=student_headers).status_code == 403
    assert client.get("/api/v1/teacher/dashboard", headers=teacher_headers).status_code == 200
    assert client.get("/api/v1/teacher/dashboard", headers=admin_headers).status_code == 200


def test_admin_password_reset_and_change_password(client, db):
    admin = create_user(db, role="admin")
    student = create_user(db, role="student", email="reset.me@test.kz")
    admin_headers = auth(login(client, admin.email))

    reset = client.post(
        f"/api/v1/admin/users/{student.id}/reset-password", headers=admin_headers
    )
    assert reset.status_code == 200, reset.text
    temporary = reset.json()["temporary_password"]
    assert reset.json()["must_change_password"] is True

    old_login = client.post(
        "/api/v1/auth/login", json={"email": student.email, "password": PASSWORD}
    )
    assert old_login.status_code == 401

    new_pair = login(client, student.email, temporary)
    assert new_pair["user"]["must_change_password"] is True
    assert new_pair["user"]["role"] == "student"

    changed = client.post(
        "/api/v1/change-password",
        json={"current_password": temporary, "new_password": "N3wPassw0rd!"},
        headers=auth(new_pair),
    )
    assert changed.status_code == 200, changed.text

    final_pair = login(client, student.email, "N3wPassw0rd!")
    assert final_pair["user"]["must_change_password"] is False


def test_inactive_user_cannot_login(client, db):
    user = create_user(db, role="student")
    user.status = "disabled"
    db.commit()

    response = client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": PASSWORD}
    )
    assert response.status_code == 403
    assert response.json()["code"] == "account_disabled"
