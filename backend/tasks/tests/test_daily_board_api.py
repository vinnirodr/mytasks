import datetime

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from environments.models import Environment
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence

User = get_user_model()


@pytest.fixture
def env(db):
    ana = User.objects.create_user(email="ana@example.com", password="x")
    return Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)


@pytest.mark.django_db
def test_board_marks_overdue_as_late_on_read(env):
    ana = env.created_by
    # An occurrence earlier today with a time already past.
    today = timezone.localtime(timezone.now()).date()
    Occurrence.objects.create(environment=env, title="Louça", date=today, time=datetime.time(0, 1))
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={today.isoformat()}")
    assert resp.status_code == 200
    statuses = {o["title"]: o["status"] for o in resp.data}
    assert statuses["Louça"] == "LATE"


@pytest.mark.django_db
def test_postponed_sorts_last(env):
    ana = env.created_by
    today = timezone.localtime(timezone.now()).date()
    Occurrence.objects.create(
        environment=env,
        title="Adiada",
        date=today,
        time=datetime.time(6, 0),
        status=Occurrence.Status.POSTPONED,
    )
    Occurrence.objects.create(
        environment=env,
        title="Depois",
        date=today,
        time=datetime.time(23, 0),
    )
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={today.isoformat()}")
    titles = [o["title"] for o in resp.data]
    assert titles[-1] == "Adiada"  # postponed goes last despite its earlier time
