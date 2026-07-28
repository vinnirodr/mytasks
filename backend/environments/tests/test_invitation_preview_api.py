import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from environments.models import Environment, Invitation, Membership

User = get_user_model()


@pytest.mark.django_db
def test_preview_returns_environment_and_members():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    bob = User.objects.create_user(email="bob@example.com", password="x", display_name="Bob")
    env = Environment.create_with_admin(name="Casa da Ana", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    inv = Invitation.objects.create(environment=env, email="carol@example.com", invited_by=ana)
    resp = APIClient().get(f"/api/invitations/{inv.token}/preview/")
    assert resp.status_code == 200
    assert resp.data["environment_name"] == "Casa da Ana"
    assert resp.data["member_count"] == 2
    assert resp.data["invited_by_name"] == "Ana"
    assert resp.data["email"] == "carol@example.com"
    assert {"display_name": "Bob", "initials": "BO"} in resp.data["members"]


@pytest.mark.django_db
def test_preview_unknown_token_404():
    resp = APIClient().get("/api/invitations/00000000-0000-0000-0000-000000000000/preview/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_preview_is_public_no_auth_required():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    inv = Invitation.objects.create(environment=env, email="c@example.com", invited_by=ana)
    resp = APIClient().get(f"/api/invitations/{inv.token}/preview/")
    assert resp.status_code == 200  # no Authorization header
