import datetime

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from environments.models import Environment
from tasks.models import Occurrence, RecurringTask, TaskDefinition

User = get_user_model()


@pytest.mark.django_db
def test_command_materializes_upcoming_days():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    today = timezone.localdate()
    RecurringTask.objects.create(
        environment=env,
        task_definition=td,
        weekday=today.weekday(),
        time=datetime.time(20, 0),
    )
    call_command("materialize_occurrences", "--days", "7")
    # Today matches the recurring weekday, so at least one occurrence exists for today.
    assert Occurrence.objects.filter(environment=env, date=today).count() == 1


@pytest.mark.django_db
def test_command_is_idempotent():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    today = timezone.localdate()
    RecurringTask.objects.create(
        environment=env,
        task_definition=td,
        weekday=today.weekday(),
        time=datetime.time(20, 0),
    )
    call_command("materialize_occurrences", "--days", "7")
    call_command("materialize_occurrences", "--days", "7")
    assert Occurrence.objects.filter(environment=env, date=today).count() == 1
