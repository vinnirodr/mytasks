import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence

User = get_user_model()


def _setup(status=Occurrence.Status.PENDING, assignee_is_bob=True):
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    carol = User.objects.create_user(email="carol@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    Membership.objects.create(environment=env, user=carol, role="MEMBER")
    occ = Occurrence.objects.create(
        environment=env,
        title="Louça",
        date=datetime.date(2026, 7, 27),
        time=datetime.time(20, 0),
        assignee=bob if assignee_is_bob else None,
        status=status,
    )
    return env, ana, bob, carol, occ


@pytest.mark.django_db
def test_assignee_can_postpone():
    env, ana, bob, carol, occ = _setup()
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/postpone/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.POSTPONED


@pytest.mark.django_db
def test_admin_can_postpone():
    env, ana, bob, carol, occ = _setup()
    resp = auth_client(ana).post(f"/api/occurrences/{occ.id}/postpone/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.POSTPONED


@pytest.mark.django_db
def test_other_member_cannot_postpone():
    env, ana, bob, carol, occ = _setup()  # assigned to bob; carol is a plain member
    resp = auth_client(carol).post(f"/api/occurrences/{occ.id}/postpone/")
    assert resp.status_code == 403
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.PENDING


@pytest.mark.django_db
def test_cannot_postpone_done_occurrence():
    env, ana, bob, carol, occ = _setup(status=Occurrence.Status.DONE)
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/postpone/")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_cannot_postpone_cancelled_occurrence():
    env, ana, bob, carol, occ = _setup()
    occ.is_cancelled = True
    occ.save(update_fields=["is_cancelled"])
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/postpone/")
    assert resp.status_code == 400
