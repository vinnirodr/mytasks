import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.permissions import get_membership, is_admin

User = get_user_model()


@pytest.fixture
def env_with_users(db):
    admin = User.objects.create_user(email="admin@example.com", password="x")
    member = User.objects.create_user(email="member@example.com", password="x")
    outsider = User.objects.create_user(email="out@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type=Environment.Type.HOUSE, owner=admin)
    Membership.objects.create(environment=env, user=member, role=Membership.Role.MEMBER)
    return env, admin, member, outsider


def test_get_membership_returns_membership_for_member(env_with_users):
    env, admin, member, outsider = env_with_users
    assert get_membership(member, env).role == Membership.Role.MEMBER


def test_get_membership_returns_none_for_outsider(env_with_users):
    env, admin, member, outsider = env_with_users
    assert get_membership(outsider, env) is None


def test_is_admin_true_only_for_admin(env_with_users):
    env, admin, member, outsider = env_with_users
    assert is_admin(admin, env) is True
    assert is_admin(member, env) is False
    assert is_admin(outsider, env) is False
