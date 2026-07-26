import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence, RecurringTask, TaskDefinition

User = get_user_model()

MONDAY = datetime.date(2026, 7, 27)


def _setup_occurrence():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    rt = RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=0, time=datetime.time(20, 0)
    )
    occ = Occurrence.objects.create(
        environment=env,
        recurring_task=rt,
        task_definition=td,
        title="Louça",
        date=MONDAY,
        time=datetime.time(20, 0),
    )
    return env, ana, bob, rt, occ


@pytest.mark.django_db
def test_admin_reassigns_single_occurrence_without_touching_pattern():
    env, ana, bob, rt, occ = _setup_occurrence()
    resp = auth_client(ana).patch(
        f"/api/occurrences/{occ.id}/",
        {"assignee": str(bob.id), "time": "21:30"},
        format="json",
    )
    assert resp.status_code == 200
    occ.refresh_from_db()
    rt.refresh_from_db()
    assert occ.assignee_id == bob.id and occ.time == datetime.time(21, 30)
    assert rt.assignee is None and rt.time == datetime.time(20, 0)  # pattern untouched


@pytest.mark.django_db
def test_member_cannot_edit_occurrence():
    env, ana, bob, rt, occ = _setup_occurrence()
    resp = auth_client(bob).patch(f"/api/occurrences/{occ.id}/", {"time": "22:00"}, format="json")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_admin_cancels_occurrence():
    env, ana, bob, rt, occ = _setup_occurrence()
    resp = auth_client(ana).post(f"/api/occurrences/{occ.id}/cancel/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.is_cancelled is True


@pytest.mark.django_db
def test_member_cannot_cancel_occurrence():
    env, ana, bob, rt, occ = _setup_occurrence()
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/cancel/")
    assert resp.status_code == 403
    occ.refresh_from_db()
    assert occ.is_cancelled is False
