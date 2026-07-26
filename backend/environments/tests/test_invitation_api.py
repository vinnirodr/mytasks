import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Invitation, Membership
from environments.tests.test_environment_api import auth_client

User = get_user_model()


@pytest.mark.django_db
def test_admin_can_invite():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)

    resp = auth_client(ana).post(
        f"/api/environments/{env.id}/invitations/",
        {"email": "bob@example.com"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["status"] == "PENDING"
    assert Invitation.objects.filter(environment=env, email="bob@example.com").exists()


@pytest.mark.django_db
def test_member_cannot_invite():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")

    resp = auth_client(bob).post(
        f"/api/environments/{env.id}/invitations/",
        {"email": "carol@example.com"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_cannot_invite_existing_member():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")

    resp = auth_client(ana).post(
        f"/api/environments/{env.id}/invitations/",
        {"email": "bob@example.com"},
        format="json",
    )
    assert resp.status_code == 400
