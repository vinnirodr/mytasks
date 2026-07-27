import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from tasks.models import Occurrence
from tasks.services import refresh_statuses

User = get_user_model()

SP = "America/Sao_Paulo"


def _aware(y, mo, d, h, mi, tz=SP):
    from zoneinfo import ZoneInfo

    return datetime.datetime(y, mo, d, h, mi, tzinfo=ZoneInfo(tz))


@pytest.fixture
def env(db):
    owner = User.objects.create_user(email="ana@example.com", password="x")
    return Environment.create_with_admin(name="Casa", env_type=Environment.Type.HOUSE, owner=owner)


def _occ(env, date, time=None, status=Occurrence.Status.PENDING):
    return Occurrence.objects.create(
        environment=env, title="Louça", date=date, time=time, status=status
    )


def test_pending_past_time_today_becomes_late(env):
    occ = _occ(env, datetime.date(2026, 7, 27), datetime.time(20, 0))
    refresh_statuses(env, now_dt=_aware(2026, 7, 27, 20, 30))
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.LATE


def test_pending_before_time_today_stays_pending(env):
    occ = _occ(env, datetime.date(2026, 7, 27), datetime.time(20, 0))
    refresh_statuses(env, now_dt=_aware(2026, 7, 27, 19, 0))
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.PENDING


def test_yesterday_pending_becomes_missed(env):
    occ = _occ(env, datetime.date(2026, 7, 26), datetime.time(20, 0))
    refresh_statuses(env, now_dt=_aware(2026, 7, 27, 8, 0))
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.MISSED


def test_yesterday_postponed_becomes_missed(env):
    occ = _occ(
        env, datetime.date(2026, 7, 26), datetime.time(20, 0), status=Occurrence.Status.POSTPONED
    )
    refresh_statuses(env, now_dt=_aware(2026, 7, 27, 8, 0))
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.MISSED


def test_done_is_never_touched(env):
    occ = _occ(env, datetime.date(2026, 7, 26), datetime.time(20, 0), status=Occurrence.Status.DONE)
    refresh_statuses(env, now_dt=_aware(2026, 7, 27, 8, 0))
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.DONE


def test_is_idempotent(env):
    _occ(env, datetime.date(2026, 7, 27), datetime.time(20, 0))
    n1 = refresh_statuses(env, now_dt=_aware(2026, 7, 27, 20, 30))
    n2 = refresh_statuses(env, now_dt=_aware(2026, 7, 27, 20, 30))
    assert n1 == 1 and n2 == 0


def test_cancelled_is_ignored(env):
    occ = _occ(env, datetime.date(2026, 7, 26), datetime.time(20, 0))
    occ.is_cancelled = True
    occ.save(update_fields=["is_cancelled"])
    refresh_statuses(env, now_dt=_aware(2026, 7, 27, 8, 0))
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.PENDING


def test_late_yesterday_becomes_missed(env):
    occ = _occ(env, datetime.date(2026, 7, 26), datetime.time(20, 0), status=Occurrence.Status.LATE)
    refresh_statuses(env, now_dt=_aware(2026, 7, 27, 8, 0))
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.MISSED
