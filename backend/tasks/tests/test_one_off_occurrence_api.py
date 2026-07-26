import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence

User = get_user_model()


def _env_with_member():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    return env, ana, bob


@pytest.mark.django_db
def test_member_creates_one_off_assigned_to_self():
    env, ana, bob = _env_with_member()
    resp = auth_client(bob).post(
        f"/api/environments/{env.id}/occurrences/",
        {"title": "Regar plantas", "date": "2026-07-27", "time": "18:00"},
        format="json",
    )
    assert resp.status_code == 201
    occ = Occurrence.objects.get(id=resp.data["id"])
    assert occ.is_one_off is True
    assert occ.created_by_id == bob.id
    assert occ.assignee_id == bob.id
    assert occ.recurring_task_id is None
    assert occ.status == Occurrence.Status.PENDING


@pytest.mark.django_db
def test_one_off_visible_to_all_members():
    env, ana, bob = _env_with_member()
    auth_client(bob).post(
        f"/api/environments/{env.id}/occurrences/",
        {"title": "Regar plantas", "date": "2026-07-27"},
        format="json",
    )
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date=2026-07-27")
    assert [o["title"] for o in resp.data] == ["Regar plantas"]


@pytest.mark.django_db
def test_outsider_cannot_create_one_off():
    env, ana, bob = _env_with_member()
    out = User.objects.create_user(email="out@example.com", password="x")
    resp = auth_client(out).post(
        f"/api/environments/{env.id}/occurrences/",
        {"title": "Xereta", "date": "2026-07-27"},
        format="json",
    )
    assert resp.status_code == 404
    assert not Occurrence.objects.filter(title="Xereta").exists()
