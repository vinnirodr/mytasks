import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from environments.models import Environment, Membership

User = get_user_model()


def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_create_environment_makes_requester_admin():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    client = auth_client(ana)
    resp = client.post(
        "/api/environments/",
        {"name": "Casa da Ana", "env_type": "HOUSE"},
        format="json",
    )
    assert resp.status_code == 201
    env = Environment.objects.get(id=resp.data["id"])
    assert Membership.objects.get(environment=env, user=ana).role == "ADMIN"
    assert resp.data["role"] == "ADMIN"


@pytest.mark.django_db
def test_list_only_returns_my_environments():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    Environment.create_with_admin(name="Casa da Ana", env_type="HOUSE", owner=ana)
    Environment.create_with_admin(name="Casa do Bob", env_type="HOUSE", owner=bob)

    resp = auth_client(ana).get("/api/environments/")
    assert resp.status_code == 200
    names = [e["name"] for e in resp.data]
    assert names == ["Casa da Ana"]


@pytest.mark.django_db
def test_member_cannot_patch_environment():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")

    resp = auth_client(bob).patch(
        f"/api/environments/{env.id}/", {"name": "Novo nome"}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_outsider_cannot_read_environment():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    out = User.objects.create_user(email="out@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)

    resp = auth_client(out).get(f"/api/environments/{env.id}/")
    assert resp.status_code in (403, 404)
