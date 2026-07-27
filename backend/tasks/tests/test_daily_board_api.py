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
def test_board_refreshes_statuses_on_read(env):
    ana = env.created_by
    # A long-past PENDING occurrence must be flipped by refresh_statuses when the
    # board is read. A far-past date is MISSED in every timezone and at any hour,
    # so this deterministically proves the view refreshes on GET. (The specific
    # PENDING->LATE transition is covered by test_refresh_statuses with an injected now.)
    past = datetime.date(2020, 1, 1)
    Occurrence.objects.create(environment=env, title="Louça", date=past, time=datetime.time(20, 0))
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={past.isoformat()}")
    assert resp.status_code == 200
    statuses = {o["title"]: o["status"] for o in resp.data}
    assert statuses["Louça"] == "MISSED"


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
