import datetime

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from environments.models import Environment
from tasks.models import Occurrence, RecurringTask, TaskDefinition

User = get_user_model()


@pytest.fixture
def env_task_recurring(db):
    owner = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type=Environment.Type.HOUSE, owner=owner)
    td = TaskDefinition.objects.create(environment=env, name="Lavar louça")
    rt = RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=0, time=datetime.time(20, 0)
    )
    return env, td, rt


def test_occurrence_defaults(env_task_recurring):
    env, td, rt = env_task_recurring
    occ = Occurrence.objects.create(
        environment=env,
        recurring_task=rt,
        task_definition=td,
        title="Lavar louça",
        date=datetime.date(2026, 7, 27),
        time=datetime.time(20, 0),
    )
    assert occ.status == Occurrence.Status.PENDING
    assert occ.is_cancelled is False
    assert occ.is_one_off is False
    assert occ.assignee is None


def test_recurring_occurrence_is_unique_per_date(env_task_recurring):
    env, td, rt = env_task_recurring
    Occurrence.objects.create(
        environment=env,
        recurring_task=rt,
        title="Lavar louça",
        date=datetime.date(2026, 7, 27),
    )
    with pytest.raises(IntegrityError):
        Occurrence.objects.create(
            environment=env,
            recurring_task=rt,
            title="Lavar louça",
            date=datetime.date(2026, 7, 27),
        )


def test_multiple_one_off_occurrences_allowed_same_date(env_task_recurring):
    env, td, rt = env_task_recurring
    o1 = Occurrence.objects.create(
        environment=env,
        recurring_task=None,
        title="Regar plantas",
        date=datetime.date(2026, 7, 27),
        is_one_off=True,
    )
    o2 = Occurrence.objects.create(
        environment=env,
        recurring_task=None,
        title="Passear com o cão",
        date=datetime.date(2026, 7, 27),
        is_one_off=True,
    )
    assert o1.pk != o2.pk  # NULL recurring_task rows are not constrained
