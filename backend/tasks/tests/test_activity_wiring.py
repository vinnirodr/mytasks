import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from notifications.models import ActivityEvent
from tasks.models import Occurrence, TaskDefinition

User = get_user_model()


def _setup():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    return env, ana, bob


@pytest.mark.django_db
def test_complete_records_activity():
    env, ana, bob = _setup()
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=datetime.date(2026, 7, 27), assignee=ana
    )
    auth_client(bob).post(f"/api/occurrences/{occ.id}/complete/")
    event = ActivityEvent.objects.get(environment=env, verb=ActivityEvent.Verb.COMPLETED)
    assert event.actor_id == bob.id
    assert event.occurrence_id == occ.id


@pytest.mark.django_db
def test_pickup_records_activity():
    env, ana, bob = _setup()
    occ = Occurrence.objects.create(
        environment=env, title="Lixo", date=datetime.date(2026, 7, 27), assignee=None
    )
    auth_client(bob).post(f"/api/occurrences/{occ.id}/pickup/")
    assert ActivityEvent.objects.filter(
        environment=env, verb=ActivityEvent.Verb.PICKED_UP, actor=bob
    ).exists()


@pytest.mark.django_db
def test_one_off_records_added_task_activity():
    env, ana, bob = _setup()
    auth_client(bob).post(
        f"/api/environments/{env.id}/occurrences/",
        {"title": "Regar", "date": "2026-07-27"},
        format="json",
    )
    assert ActivityEvent.objects.filter(
        environment=env, verb=ActivityEvent.Verb.ADDED_TASK, actor=bob
    ).exists()


@pytest.mark.django_db
def test_recurring_create_records_agenda_changed():
    env, ana, bob = _setup()
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    auth_client(ana).post(
        f"/api/environments/{env.id}/recurring-tasks/",
        {"task_definition": str(td.id), "weekday": 0, "time": "20:00"},
        format="json",
    )
    assert ActivityEvent.objects.filter(
        environment=env, verb=ActivityEvent.Verb.AGENDA_CHANGED, actor=ana
    ).exists()
