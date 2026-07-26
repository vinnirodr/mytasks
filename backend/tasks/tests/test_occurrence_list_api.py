import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence, RecurringTask, TaskDefinition

User = get_user_model()

MONDAY = "2026-07-27"


@pytest.fixture
def env_with_recurring(db):
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=0, time=datetime.time(20, 0)
    )
    return env, ana


@pytest.mark.django_db
def test_list_by_date_materializes(env_with_recurring):
    env, ana = env_with_recurring
    assert Occurrence.objects.count() == 0
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={MONDAY}")
    assert resp.status_code == 200
    assert [o["title"] for o in resp.data] == ["Louça"]
    assert Occurrence.objects.filter(environment=env).count() == 1


@pytest.mark.django_db
def test_cancelled_occurrences_are_hidden(env_with_recurring):
    env, ana = env_with_recurring
    auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={MONDAY}")
    occ = Occurrence.objects.get()
    occ.is_cancelled = True
    occ.save(update_fields=["is_cancelled"])
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={MONDAY}")
    assert resp.data == []


@pytest.mark.django_db
def test_missing_date_is_400(env_with_recurring):
    env, ana = env_with_recurring
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_week_view_materializes_whole_week(env_with_recurring):
    env, ana = env_with_recurring
    # week_of a Wednesday in the same week as MONDAY 2026-07-27
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?week_of=2026-07-29")
    assert resp.status_code == 200
    assert [o["title"] for o in resp.data] == ["Louça"]  # only Monday matches
