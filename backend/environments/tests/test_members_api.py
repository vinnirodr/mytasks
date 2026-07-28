import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from environments.models import Environment, Invitation, Membership

User = get_user_model()


def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_member_lists_active_members_with_exact_shape():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    bob = User.objects.create_user(email="bob@example.com", password="x", display_name="Bob")
    env = Environment.create_with_admin(name="Casa da Ana", env_type="HOUSE", owner=ana)
    bob_membership = Membership.objects.create(environment=env, user=bob, role="MEMBER")
    ana_membership = Membership.objects.get(environment=env, user=ana)

    resp = auth_client(ana).get(f"/api/environments/{env.id}/members/")

    assert resp.status_code == 200
    assert resp.data == [
        {
            "id": str(ana_membership.id),
            "user_id": str(ana.id),
            "display_name": "Ana",
            "initials": "AN",
            "role": "ADMIN",
            "is_me": True,
        },
        {
            "id": str(bob_membership.id),
            "user_id": str(bob.id),
            "display_name": "Bob",
            "initials": "BO",
            "role": "MEMBER",
            "is_me": False,
        },
    ]


@pytest.mark.django_db
def test_member_display_name_falls_back_to_email():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    env = Environment.objects.get(name="Casa")
    carol = User.objects.create_user(email="carol@example.com", password="x", display_name="")
    Membership.objects.create(environment=env, user=carol, role="MEMBER")

    resp = auth_client(ana).get(f"/api/environments/{env.id}/members/")

    carol_entry = next(m for m in resp.data if m["user_id"] == str(carol.id))
    assert carol_entry["display_name"] == "carol@example.com"
    assert carol_entry["initials"] == "CA"


@pytest.mark.django_db
def test_non_member_gets_404():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    outsider = User.objects.create_user(email="out@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)

    resp = auth_client(outsider).get(f"/api/environments/{env.id}/members/")

    assert resp.status_code == 404


@pytest.mark.django_db
def test_nonexistent_environment_gets_404():
    ana = User.objects.create_user(email="ana@example.com", password="x")

    resp = auth_client(ana).get(
        "/api/environments/00000000-0000-0000-0000-000000000000/members/"
    )

    assert resp.status_code == 404


@pytest.mark.django_db
def test_unauthenticated_gets_401():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)

    resp = APIClient().get(f"/api/environments/{env.id}/members/")

    assert resp.status_code == 401


@pytest.mark.django_db
def test_inactive_membership_and_pending_invitation_do_not_leak():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    dave = User.objects.create_user(email="dave@example.com", password="x", display_name="Dave")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(
        environment=env, user=dave, role="MEMBER", status="INACTIVE"
    )
    Invitation.objects.create(environment=env, email="pending@example.com", invited_by=ana)

    resp = auth_client(ana).get(f"/api/environments/{env.id}/members/")

    assert resp.status_code == 200
    user_ids = [m["user_id"] for m in resp.data]
    assert str(dave.id) not in user_ids
    assert len(resp.data) == 1


@pytest.mark.django_db
def test_ordering_admin_before_member_case_insensitive():
    zack = User.objects.create_user(email="zack@example.com", password="x", display_name="Zack")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=zack)
    alice = User.objects.create_user(email="alice@example.com", password="x", display_name="alice")
    bob = User.objects.create_user(email="bob@example.com", password="x", display_name="Bob")
    Membership.objects.create(environment=env, user=alice, role="MEMBER")
    Membership.objects.create(environment=env, user=bob, role="MEMBER")

    resp = auth_client(zack).get(f"/api/environments/{env.id}/members/")

    names_in_order = [m["display_name"] for m in resp.data]
    assert names_in_order == ["Zack", "alice", "Bob"]
