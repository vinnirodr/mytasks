import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Invitation, Membership
from environments.tests.test_environment_api import auth_client

User = get_user_model()


def make_invitation(env, admin, email):
    return Invitation.objects.create(environment=env, email=email, invited_by=admin)


@pytest.mark.django_db
def test_accept_creates_member_membership():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    inv = make_invitation(env, ana, "bob@example.com")

    resp = auth_client(bob).post(
        "/api/invitations/accept/", {"token": str(inv.token)}, format="json"
    )
    assert resp.status_code == 200
    assert resp.data["role"] == "MEMBER"
    membership = Membership.objects.get(environment=env, user=bob)
    assert membership.role == "MEMBER"
    inv.refresh_from_db()
    assert inv.status == "ACCEPTED"


@pytest.mark.django_db
def test_accept_rejects_email_mismatch():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    carol = User.objects.create_user(email="carol@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    inv = make_invitation(env, ana, "bob@example.com")

    resp = auth_client(carol).post(
        "/api/invitations/accept/", {"token": str(inv.token)}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_accept_rejects_already_accepted():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    inv = make_invitation(env, ana, "bob@example.com")
    inv.status = "ACCEPTED"
    inv.save()

    resp = auth_client(bob).post(
        "/api/invitations/accept/", {"token": str(inv.token)}, format="json"
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_accept_unknown_token_is_404():
    bob = User.objects.create_user(email="bob@example.com", password="x")
    resp = auth_client(bob).post(
        "/api/invitations/accept/",
        {"token": "00000000-0000-0000-0000-000000000000"},
        format="json",
    )
    assert resp.status_code == 404


@pytest.mark.django_db
def test_accept_malformed_token_is_404():
    bob = User.objects.create_user(email="bob@example.com", password="x")
    resp = auth_client(bob).post("/api/invitations/accept/", {"token": "not-a-uuid"}, format="json")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_email_mismatch_takes_priority_over_already_accepted():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    carol = User.objects.create_user(email="carol@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    inv = make_invitation(env, ana, "bob@example.com")
    inv.status = "ACCEPTED"
    inv.save()
    resp = auth_client(carol).post(
        "/api/invitations/accept/", {"token": str(inv.token)}, format="json"
    )
    assert resp.status_code == 403
