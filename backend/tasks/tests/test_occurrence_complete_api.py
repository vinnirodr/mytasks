import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence

User = get_user_model()


def _setup():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    occ = Occurrence.objects.create(
        environment=env,
        title="Louça",
        date=datetime.date(2026, 7, 27),
        time=datetime.time(20, 0),
        assignee=ana,
    )
    return env, ana, bob, occ


@pytest.mark.django_db
def test_member_can_complete_any_occurrence():
    env, ana, bob, occ = _setup()  # occ is assigned to ana; bob completes it
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/complete/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.DONE
    assert occ.completed_by_id == bob.id
    assert occ.completed_at is not None


@pytest.mark.django_db
def test_outsider_cannot_complete():
    env, ana, bob, occ = _setup()
    out = User.objects.create_user(email="out@example.com", password="x")
    resp = auth_client(out).post(f"/api/occurrences/{occ.id}/complete/")
    assert resp.status_code == 404
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.PENDING
