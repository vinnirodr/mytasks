import datetime
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from push import services
from push.models import PushToken
from tasks.models import Occurrence

User = get_user_model()
SP = "America/Sao_Paulo"


def _now():
    return datetime.datetime(2026, 7, 27, 12, 0, tzinfo=ZoneInfo(SP))


@pytest.fixture
def env(db):
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    return env, ana


def _occ(env, time, assignee=None, reminder_sent=False, status=Occurrence.Status.PENDING):
    return Occurrence.objects.create(
        environment=env,
        title="Louça",
        date=datetime.date(2026, 7, 27),
        time=time,
        assignee=assignee,
        reminder_sent=reminder_sent,
        status=status,
    )


def test_sends_reminder_in_window_and_marks_flag(env, monkeypatch):
    environment, ana = env
    PushToken.objects.create(user=ana, token="ExponentPushToken[a]")
    occ = _occ(
        environment, datetime.time(12, 10), assignee=ana
    )  # 10 min away → in [scheduled-15, scheduled)
    calls = {}
    monkeypatch.setattr(
        services,
        "send_push",
        lambda tokens, title, body, data=None: calls.update(tokens=tokens) or True,
    )
    reminded = services.send_reminders(now_dt=_now())
    occ.refresh_from_db()
    assert reminded == 1
    assert calls["tokens"] == ["ExponentPushToken[a]"]
    assert occ.reminder_sent is True


def test_not_due_when_more_than_15_min_away(env, monkeypatch):
    environment, ana = env
    PushToken.objects.create(user=ana, token="ExponentPushToken[a]")
    _occ(environment, datetime.time(13, 0), assignee=ana)  # 60 min away
    monkeypatch.setattr(services, "send_push", lambda *a, **k: True)
    assert services.send_reminders(now_dt=_now()) == 0


def test_already_reminded_is_skipped(env, monkeypatch):
    environment, ana = env
    PushToken.objects.create(user=ana, token="ExponentPushToken[a]")
    _occ(environment, datetime.time(12, 10), assignee=ana, reminder_sent=True)
    monkeypatch.setattr(services, "send_push", lambda *a, **k: True)
    assert services.send_reminders(now_dt=_now()) == 0


def test_open_task_reminds_all_active_members(env, monkeypatch):
    environment, ana = env
    bob = User.objects.create_user(email="bob@example.com", password="x")
    Membership.objects.create(environment=environment, user=bob, role="MEMBER")
    PushToken.objects.create(user=ana, token="ExponentPushToken[ana]")
    PushToken.objects.create(user=bob, token="ExponentPushToken[bob]")
    _occ(environment, datetime.time(12, 10), assignee=None)
    seen = {}
    monkeypatch.setattr(
        services,
        "send_push",
        lambda tokens, *a, **k: seen.update(tokens=set(tokens)) or True,
    )
    services.send_reminders(now_dt=_now())
    assert seen["tokens"] == {"ExponentPushToken[ana]", "ExponentPushToken[bob]"}


def test_reminder_window_crosses_midnight(env, monkeypatch):
    environment, ana = env
    PushToken.objects.create(user=ana, token="ExponentPushToken[a]")
    # Occurrence tomorrow at 00:05; sweep at 23:52 today (13 min before → in window).
    Occurrence.objects.create(
        environment=environment,
        title="Madrugada",
        date=datetime.date(2026, 7, 28),
        time=datetime.time(0, 5),
        assignee=ana,
    )
    now = datetime.datetime(2026, 7, 27, 23, 52, tzinfo=ZoneInfo(SP))
    monkeypatch.setattr(services, "send_push", lambda *a, **k: True)
    assert services.send_reminders(now_dt=now) == 1
