import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_register_creates_user(client):
    resp = client.post(
        "/api/auth/register/",
        {"email": "ana@example.com", "password": "s3cret!!", "display_name": "Ana"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["email"] == "ana@example.com"
    assert "password" not in resp.data
    assert User.objects.filter(email="ana@example.com").exists()


@pytest.mark.django_db
def test_register_rejects_duplicate_email(client):
    User.objects.create_user(email="ana@example.com", password="x")
    resp = client.post(
        "/api/auth/register/",
        {"email": "ana@example.com", "password": "s3cret!!"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_token_and_me(client):
    User.objects.create_user(email="ana@example.com", password="s3cret!!", display_name="Ana")
    token_resp = client.post(
        "/api/auth/token/",
        {"email": "ana@example.com", "password": "s3cret!!"},
        format="json",
    )
    assert token_resp.status_code == 200
    access = token_resp.data["access"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    me_resp = client.get("/api/auth/me/")
    assert me_resp.status_code == 200
    assert me_resp.data["email"] == "ana@example.com"


@pytest.mark.django_db
def test_me_requires_auth(client):
    resp = client.get("/api/auth/me/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_token_refresh_returns_new_access(client):
    User.objects.create_user(email="ana@example.com", password="s3cret!!")
    token_resp = client.post(
        "/api/auth/token/",
        {"email": "ana@example.com", "password": "s3cret!!"},
        format="json",
    )
    refresh = token_resp.data["refresh"]
    resp = client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert resp.status_code == 200
    assert "access" in resp.data
