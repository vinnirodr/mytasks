import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from push import tasks
from tasks.models import Occurrence, RecurringTask, TaskDefinition

User = get_user_model()


@pytest.mark.django_db
def test_send_reminders_task_runs_eagerly(monkeypatch):
    called = {}
    monkeypatch.setattr(tasks, "send_reminders", lambda: called.setdefault("ran", True) and 0)
    result = tasks.send_reminders_task.delay()
    assert result.get() == 0
    assert called["ran"] is True


@pytest.mark.django_db
def test_refresh_statuses_task_marks_missed():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=datetime.date(2020, 1, 1),
        time=datetime.time(20, 0),
    )
    tasks.refresh_statuses_task.delay().get()
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.MISSED


@pytest.mark.django_db
def test_materialize_task_creates_today_occurrence():
    from django.utils import timezone

    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    today = timezone.localdate()
    RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=today.weekday(),
        time=datetime.time(20, 0),
    )
    tasks.materialize_occurrences_task.delay().get()
    assert Occurrence.objects.filter(environment=env, date=today).exists()
