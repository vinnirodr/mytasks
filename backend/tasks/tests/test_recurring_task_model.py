import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from tasks.models import RecurringTask, TaskDefinition

User = get_user_model()


@pytest.fixture
def env_and_task(db):
    owner = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type=Environment.Type.HOUSE, owner=owner)
    td = TaskDefinition.objects.create(environment=env, name="Lavar louça")
    return env, td, owner


def test_recurring_task_defaults(env_and_task):
    env, td, owner = env_and_task
    rt = RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=0, time=datetime.time(20, 0)
    )
    assert rt.active is True
    assert rt.assignee is None
    assert rt.weekday == 0
    assert list(env.recurring_tasks.all()) == [rt]


def test_recurring_task_can_have_assignee(env_and_task):
    env, td, owner = env_and_task
    rt = RecurringTask.objects.create(
        environment=env,
        task_definition=td,
        weekday=2,
        time=datetime.time(8, 0),
        assignee=owner,
    )
    assert rt.assignee == owner
