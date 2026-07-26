import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from environments.models import Environment, Membership

User = get_user_model()


@pytest.mark.django_db
def test_create_with_admin_makes_owner_admin():
    owner = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(
        name="Casa da Ana", env_type=Environment.Type.HOUSE, owner=owner
    )
    assert env.created_by == owner
    membership = Membership.objects.get(environment=env, user=owner)
    assert membership.role == Membership.Role.ADMIN
    assert membership.status == Membership.Status.ACTIVE


@pytest.mark.django_db
def test_membership_is_unique_per_user_and_environment():
    owner = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type=Environment.Type.HOUSE, owner=owner)
    with pytest.raises(IntegrityError):
        Membership.objects.create(environment=env, user=owner, role=Membership.Role.MEMBER)
