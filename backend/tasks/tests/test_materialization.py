import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from tasks.models import Occurrence, RecurringTask, TaskDefinition
from tasks.services import ensure_occurrences_for, ensure_occurrences_for_range

User = get_user_model()

MONDAY = datetime.date(2026, 7, 27)  # a Monday (weekday()==0)
TUESDAY = datetime.date(2026, 7, 28)


@pytest.fixture
def env(db):
    owner = User.objects.create_user(email="ana@example.com", password="x")
    return Environment.create_with_admin(name="Casa", env_type=Environment.Type.HOUSE, owner=owner)


def _recurring(env, weekday, name="Lavar louça", active=True, assignee=None):
    td = TaskDefinition.objects.create(environment=env, name=name)
    return RecurringTask.objects.create(
        environment=env,
        task_definition=td,
        weekday=weekday,
        time=datetime.time(20, 0),
        active=active,
        assignee=assignee,
    )


def test_materializes_matching_weekday_only(env):
    _recurring(env, weekday=0, name="Louça")  # Monday
    _recurring(env, weekday=1, name="Lixo")  # Tuesday
    result = ensure_occurrences_for(env, MONDAY)
    assert len(result) == 1
    assert result[0].title == "Louça"
    assert result[0].date == MONDAY
    assert result[0].time == datetime.time(20, 0)


def test_is_idempotent(env):
    _recurring(env, weekday=0)
    ensure_occurrences_for(env, MONDAY)
    ensure_occurrences_for(env, MONDAY)
    assert Occurrence.objects.filter(environment=env, date=MONDAY).count() == 1


def test_inactive_recurring_task_not_materialized(env):
    _recurring(env, weekday=0, active=False)
    result = ensure_occurrences_for(env, MONDAY)
    assert result == []


def test_copies_assignee(env):
    owner = env.created_by
    _recurring(env, weekday=0, assignee=owner)
    occ = ensure_occurrences_for(env, MONDAY)[0]
    assert occ.assignee_id == owner.id


def test_cancelled_occurrence_is_not_recreated(env):
    rt = _recurring(env, weekday=0)
    occ = ensure_occurrences_for(env, MONDAY)[0]
    occ.is_cancelled = True
    occ.save(update_fields=["is_cancelled"])
    # Re-materialize: the cancelled row must survive, not be replaced.
    again = ensure_occurrences_for(env, MONDAY)
    assert len(again) == 1
    assert again[0].id == occ.id
    assert again[0].is_cancelled is True
    assert Occurrence.objects.filter(recurring_task=rt, date=MONDAY).count() == 1


def test_range_creates_for_each_matching_day(env):
    _recurring(env, weekday=0, name="Louça")  # Monday
    _recurring(env, weekday=1, name="Lixo")  # Tuesday
    created = ensure_occurrences_for_range(env, MONDAY, TUESDAY)
    assert created == 2
