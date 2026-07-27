# Push Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send push reminders ~15 minutes before a task's scheduled time via Expo Push, driven by Celery + Celery Beat, and schedule the already-built `materialize_occurrences` / `refresh_statuses` maintenance jobs on Beat.

**Architecture:** A Celery app (Redis broker/result backend — Redis is already running for Channels) runs a Beat schedule. A once-a-minute `send_reminders` sweep finds each PENDING, non-cancelled, not-yet-reminded occurrence whose reminder window (`scheduled − 15min ≤ now < scheduled`, in the environment's timezone) is open, resolves the recipients' Expo push tokens (the assignee, or all active members if the task is open), sends a best-effort HTTP push to the Expo API via `requests`, and sets a `reminder_sent` flag so each reminder fires once. Under pytest, Celery runs eagerly and the channel/broker are never contacted for real; the Expo HTTP call is mocked.

**Tech Stack:** Python 3.14, Django 6.0, Celery 5.6, requests 2.34, Redis, PostgreSQL. (Verified: celery/kombu/billiard/requests install and import on Python 3.14.3.)

## Global Constraints

- Python **3.14**; Django **6.0.x**; Celery **5.6.x**; requests **2.34.x**; Redis 6+.
- All model PKs are **UUID**; user FKs use `settings.AUTH_USER_MODEL`.
- HTTP API routes under `/api/`. Reuse `environments.permissions` and `Environment.timezone` (Plan 3) and `Membership` active filtering.
- Reminder rule (verbatim): a reminder is due for an occurrence that is **PENDING**, **not cancelled**, **has a `time`**, **`reminder_sent is False`**, and whose local-time now is in `[scheduled − 15min, scheduled)` computed in the occurrence's `environment.timezone`. On dispatch, set `reminder_sent = True` (once-only), regardless of whether the push HTTP call succeeded (best-effort).
- Recipients: the occurrence's `assignee` if set, else **all active members** of the environment. Only users with a registered `PushToken` receive anything.
- Expo push is sent via a plain HTTPS POST to `https://exp.host/--/api/v2/push/send` using `requests`; it is **best-effort** (network/HTTP errors are caught and logged, never raised into the sweep). Under pytest the HTTP call is mocked; no real network.
- Celery runs **eagerly under pytest** (`CELERY_TASK_ALWAYS_EAGER = _TESTING`), so tasks execute inline in tests and need no worker/broker. Beat schedule is a static `CELERY_BEAT_SCHEDULE` dict in settings (no `django-celery-beat`).
- Maintenance jobs reuse the existing management commands via `call_command` (DRY): `materialize_occurrences` (Plan 2) and `refresh_statuses` (Plan 3).
- Run `ruff format` before each commit; `ruff check` clean. Every task ends green with pristine test output and is committed. `line-length = 100`. `pytest -W error` must stay clean.
- Commit message bodies end with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Celery app + settings + eager test harness

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/config/celery.py`
- Modify: `backend/config/__init__.py`
- Modify: `backend/config/settings.py`
- Test: `backend/tests/test_celery_smoke.py`

**Interfaces:**
- Consumes: existing project + Redis.
- Produces: `config.celery.app` (a configured `Celery` instance, autodiscovering tasks); `config` package exports `celery_app`; `CELERY_*` settings (broker/result = `REDIS_URL`, `CELERY_TASK_ALWAYS_EAGER = _TESTING`), and an (initially empty-of-custom-tasks) `CELERY_BEAT_SCHEDULE`. A trivial `@shared_task` runs inline under pytest.

- [ ] **Step 1: Add deps to `backend/requirements.txt`**

Append:
```
celery==5.6.3
requests==2.34.2
```

- [ ] **Step 2: Install**

Run: `cd backend && pip install -r requirements.txt`
Expected: installs without error (celery/kombu/billiard/requests have Python 3.14 wheels).

- [ ] **Step 3: Create `backend/config/celery.py`**

```python
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("mytasks")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

- [ ] **Step 4: Update `backend/config/__init__.py`**

```python
from .celery import app as celery_app

__all__ = ("celery_app",)
```

- [ ] **Step 5: Add Celery settings to `backend/config/settings.py`**

Add near the `CHANNEL_LAYERS` block (which already defines `_TESTING`):
```python
CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_TASK_ALWAYS_EAGER = _TESTING
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BEAT_SCHEDULE = {}
```

- [ ] **Step 6: Write the smoke test `backend/tests/test_celery_smoke.py`**

```python
from celery import shared_task


@shared_task
def _ping():
    return "pong"


def test_task_runs_eagerly_under_pytest():
    result = _ping.delay()
    assert result.get() == "pong"
```

- [ ] **Step 7: Run the smoke test**

Run: `cd backend && pytest tests/test_celery_smoke.py -v`
Expected: PASS — confirms `CELERY_TASK_ALWAYS_EAGER` makes `.delay()` run inline.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "chore: Celery app, settings, eager test harness"
```

---

### Task 2: `push` app + `PushToken` model + register endpoint

**Files:**
- Create: `backend/push/__init__.py`, `backend/push/apps.py`, `backend/push/models.py`, `backend/push/serializers.py`, `backend/push/views.py`, `backend/push/urls.py`
- Modify: `backend/config/settings.py` (append `"push"` to `INSTALLED_APPS`)
- Modify: `backend/config/urls.py` (include `push.urls` under `api/`)
- Test: `backend/push/tests/__init__.py`, `backend/push/tests/test_push_token_api.py`

**Interfaces:**
- Consumes: `settings.AUTH_USER_MODEL`.
- Produces:
  - `push.models.PushToken` — `id` (UUID PK), `user` (FK, CASCADE, related_name `push_tokens`), `token` (CharField 255, **unique**), `device_name` (CharField 120, blank), `updated_at` (auto_now).
  - `POST /api/push-tokens/` — auth required, body `{token, device_name?}` → 200 `{token}`. Idempotent upsert keyed on `token` (`update_or_create(token=..., defaults={"user": request.user, "device_name": ...})`), so re-registering the same token re-points it to the caller.

- [ ] **Step 1: Create `backend/push/__init__.py`** (empty) and `backend/push/apps.py`

```python
from django.apps import AppConfig


class PushConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "push"
```

- [ ] **Step 2: Create `backend/push/tests/__init__.py`** (empty) and write the failing test `backend/push/tests/test_push_token_api.py`

```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient

from push.models import PushToken

User = get_user_model()


def _client(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


@pytest.mark.django_db
def test_register_push_token():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    resp = _client(ana).post(
        "/api/push-tokens/",
        {"token": "ExponentPushToken[abc]", "device_name": "iPhone"},
        format="json",
    )
    assert resp.status_code == 200
    token = PushToken.objects.get(token="ExponentPushToken[abc]")
    assert token.user_id == ana.id


@pytest.mark.django_db
def test_reregister_same_token_repoints_to_caller():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    _client(ana).post("/api/push-tokens/", {"token": "ExponentPushToken[t]"}, format="json")
    _client(bob).post("/api/push-tokens/", {"token": "ExponentPushToken[t]"}, format="json")
    assert PushToken.objects.get(token="ExponentPushToken[t]").user_id == bob.id
    assert PushToken.objects.filter(token="ExponentPushToken[t]").count() == 1


@pytest.mark.django_db
def test_register_requires_auth():
    resp = APIClient().post("/api/push-tokens/", {"token": "x"}, format="json")
    assert resp.status_code == 401
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && pytest push/tests/test_push_token_api.py -v`
Expected: FAIL — app/routes missing.

- [ ] **Step 4: Create `backend/push/models.py`**

```python
import uuid

from django.conf import settings
from django.db import models


class PushToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_tokens"
    )
    token = models.CharField(max_length=255, unique=True)
    device_name = models.CharField(max_length=120, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} · {self.token[:16]}"
```

- [ ] **Step 5: Create `backend/push/serializers.py`**

```python
from rest_framework import serializers

from push.models import PushToken


class PushTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushToken
        fields = ["token", "device_name"]
```

- [ ] **Step 6: Create `backend/push/views.py`**

```python
from rest_framework.response import Response
from rest_framework.views import APIView

from push.models import PushToken
from push.serializers import PushTokenSerializer


class RegisterPushTokenView(APIView):
    def post(self, request):
        serializer = PushTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        PushToken.objects.update_or_create(
            token=token,
            defaults={
                "user": request.user,
                "device_name": serializer.validated_data.get("device_name", ""),
            },
        )
        return Response({"token": token})
```

- [ ] **Step 7: Create `backend/push/urls.py`**

```python
from django.urls import path

from push.views import RegisterPushTokenView

urlpatterns = [
    path("push-tokens/", RegisterPushTokenView.as_view(), name="register-push-token"),
]
```

- [ ] **Step 8: Register the app and routes**

Append `"push"` to `INSTALLED_APPS` in `backend/config/settings.py`. Add to `backend/config/urls.py` `urlpatterns`:
```python
    path("api/", include("push.urls")),
```

- [ ] **Step 9: Create and run the migration**

Run: `cd backend && python manage.py makemigrations push && python manage.py migrate`
Expected: initial `push` migration created and applied.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `cd backend && pytest push/tests/test_push_token_api.py -v`
Expected: PASS — all three tests.

- [ ] **Step 11: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: push app with PushToken model and register endpoint"
```

---

### Task 3: `Occurrence.reminder_sent` flag

**Files:**
- Modify: `backend/tasks/models.py` (add `reminder_sent`)
- Test: `backend/tasks/tests/test_reminder_flag.py`

**Interfaces:**
- Consumes: `Occurrence` (Plan 2).
- Produces: `Occurrence.reminder_sent` — `BooleanField(default=False)`.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_reminder_flag.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from tasks.models import Occurrence

User = get_user_model()


@pytest.mark.django_db
def test_reminder_sent_defaults_false():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=datetime.date(2026, 7, 27)
    )
    assert occ.reminder_sent is False
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_reminder_flag.py -v`
Expected: FAIL — `reminder_sent` does not exist.

- [ ] **Step 3: Add the field to `Occurrence` in `backend/tasks/models.py`**

Add after `is_one_off`:
```python
    reminder_sent = models.BooleanField(default=False)
```

- [ ] **Step 4: Create and run the migration**

Run: `cd backend && python manage.py makemigrations tasks && python manage.py migrate`
Expected: migration adding `reminder_sent` created and applied.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && pytest tasks/tests/test_reminder_flag.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: Occurrence.reminder_sent flag"
```

---

### Task 4: Expo push client (best-effort HTTP)

**Files:**
- Create: `backend/push/expo.py`
- Test: `backend/push/tests/test_expo.py`

**Interfaces:**
- Consumes: `requests`.
- Produces: `push.expo.send_push(tokens, title, body, data=None)` — POSTs one message per token to `https://exp.host/--/api/v2/push/send` (a single JSON list body). Returns `True` if the POST returned 2xx, `False` on any error (network, non-2xx). Never raises. No-op returning `False` for an empty `tokens` list.

- [ ] **Step 1: Write the failing test `backend/push/tests/test_expo.py`**

```python
import requests

from push.expo import EXPO_PUSH_URL, send_push


class _FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code


def test_send_push_posts_one_message_per_token(monkeypatch):
    captured = {}

    def fake_post(url, json, headers, timeout):
        captured["url"] = url
        captured["json"] = json
        return _FakeResponse(200)

    monkeypatch.setattr(requests, "post", fake_post)
    ok = send_push(["ExponentPushToken[a]", "ExponentPushToken[b]"], "T", "B", {"x": 1})
    assert ok is True
    assert captured["url"] == EXPO_PUSH_URL
    assert [m["to"] for m in captured["json"]] == [
        "ExponentPushToken[a]",
        "ExponentPushToken[b]",
    ]
    assert captured["json"][0]["title"] == "T"
    assert captured["json"][0]["body"] == "B"
    assert captured["json"][0]["data"] == {"x": 1}


def test_send_push_empty_tokens_is_noop():
    assert send_push([], "T", "B") is False


def test_send_push_swallows_errors(monkeypatch):
    def boom(*args, **kwargs):
        raise requests.RequestException("network down")

    monkeypatch.setattr(requests, "post", boom)
    assert send_push(["ExponentPushToken[a]"], "T", "B") is False
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest push/tests/test_expo.py -v`
Expected: FAIL — `push.expo` does not exist.

- [ ] **Step 3: Create `backend/push/expo.py`**

```python
import logging

import requests

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push(tokens, title, body, data=None):
    """Best-effort Expo push. Returns True on a 2xx POST, False otherwise. Never raises."""
    if not tokens:
        return False
    messages = [
        {"to": token, "title": title, "body": body, "data": data or {}}
        for token in tokens
    ]
    try:
        response = requests.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=10,
        )
    except requests.RequestException:
        logger.warning("Expo push request failed", exc_info=True)
        return False
    if not 200 <= response.status_code < 300:
        logger.warning("Expo push returned %s", response.status_code)
        return False
    return True
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest push/tests/test_expo.py -v`
Expected: PASS — all three tests.

- [ ] **Step 5: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: best-effort Expo push client"
```

---

### Task 5: Reminder sweep service

**Files:**
- Create: `backend/push/services.py`
- Test: `backend/push/tests/test_reminders.py`

**Interfaces:**
- Consumes: `Occurrence`, `Environment.timezone`, `Membership`, `PushToken`, `send_push` (Task 4).
- Produces:
  - `push.services.send_reminders(now_dt=None)` — sweeps all environments; for each due occurrence (per the Global Constraints reminder rule, in `environment.timezone`), resolves recipient tokens (assignee's, else all active members'), calls `send_push(...)` with a Portuguese reminder, and sets `reminder_sent = True`. `now_dt` (aware datetime) defaults to `django.utils.timezone.now()`. Returns the number of occurrences reminded.
  - `push.services._recipient_tokens(occurrence)` — list of Expo token strings for the occurrence's recipients.

- [ ] **Step 1: Write the failing test `backend/push/tests/test_reminders.py`**

```python
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
        environment=env, title="Louça", date=datetime.date(2026, 7, 27),
        time=time, assignee=assignee, reminder_sent=reminder_sent, status=status,
    )


def test_sends_reminder_in_window_and_marks_flag(env, monkeypatch):
    environment, ana = env
    PushToken.objects.create(user=ana, token="ExponentPushToken[a]")
    occ = _occ(environment, datetime.time(12, 10), assignee=ana)  # 10 min away → in [scheduled-15, scheduled)
    calls = {}
    monkeypatch.setattr(
        services, "send_push",
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
        services, "send_push",
        lambda tokens, *a, **k: seen.update(tokens=set(tokens)) or True,
    )
    services.send_reminders(now_dt=_now())
    assert seen["tokens"] == {"ExponentPushToken[ana]", "ExponentPushToken[bob]"}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest push/tests/test_reminders.py -v`
Expected: FAIL — `push.services` does not exist.

- [ ] **Step 3: Create `backend/push/services.py`**

```python
import datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

from environments.models import Membership
from environments.models import Environment
from push.expo import send_push
from push.models import PushToken
from tasks.models import Occurrence

REMINDER_LEAD = datetime.timedelta(minutes=15)


def _recipient_tokens(occurrence):
    if occurrence.assignee_id:
        user_ids = [occurrence.assignee_id]
    else:
        user_ids = list(
            occurrence.environment.memberships.filter(
                status=Membership.Status.ACTIVE
            ).values_list("user_id", flat=True)
        )
    return list(
        PushToken.objects.filter(user_id__in=user_ids).values_list("token", flat=True)
    )


def _due_occurrences(environment, local_now):
    tz = local_now.tzinfo
    candidates = environment.occurrences.filter(
        is_cancelled=False,
        reminder_sent=False,
        status=Occurrence.Status.PENDING,
        time__isnull=False,
        date=local_now.date(),
    )
    due = []
    for occ in candidates:
        scheduled = datetime.datetime.combine(occ.date, occ.time, tzinfo=tz)
        if scheduled - REMINDER_LEAD <= local_now < scheduled:
            due.append(occ)
    return due


def send_reminders(now_dt=None):
    now_dt = now_dt or timezone.now()
    reminded = 0
    for environment in Environment.objects.all():
        local_now = now_dt.astimezone(ZoneInfo(environment.timezone))
        for occ in _due_occurrences(environment, local_now):
            tokens = _recipient_tokens(occ)
            if tokens:
                send_push(
                    tokens,
                    "Lembrete de tarefa",
                    f"'{occ.title}' é às {occ.time.strftime('%H:%M')}.",
                    {"occurrence_id": str(occ.id)},
                )
            occ.reminder_sent = True
            occ.save(update_fields=["reminder_sent"])
            reminded += 1
    return reminded
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest push/tests/test_reminders.py -v`
Expected: PASS — all four tests.

- [ ] **Step 5: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: 15-minute reminder sweep service"
```

---

### Task 6: Celery tasks + Beat schedule + full-suite

**Files:**
- Create: `backend/push/tasks.py`
- Modify: `backend/config/settings.py` (`CELERY_BEAT_SCHEDULE`)
- Modify: `backend/README-realtime.md` (add a Celery run note)
- Test: `backend/push/tests/test_tasks.py`

**Interfaces:**
- Consumes: `send_reminders` (Task 5), the `materialize_occurrences` / `refresh_statuses` management commands.
- Produces:
  - `push.tasks.send_reminders_task()` — Celery task calling `send_reminders()`.
  - `push.tasks.materialize_occurrences_task()` — calls `call_command("materialize_occurrences")`.
  - `push.tasks.refresh_statuses_task()` — calls `call_command("refresh_statuses")`.
  - `CELERY_BEAT_SCHEDULE` with: `send-reminders` every 60s, `refresh-statuses` every 300s, `materialize-occurrences` daily at 00:05.

- [ ] **Step 1: Write the failing test `backend/push/tests/test_tasks.py`**

```python
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
    monkeypatch.setattr(tasks, "send_reminders", lambda: called.setdefault("ran", True) or 0)
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest push/tests/test_tasks.py -v`
Expected: FAIL — `push.tasks` does not exist.

- [ ] **Step 3: Create `backend/push/tasks.py`**

```python
from celery import shared_task
from django.core.management import call_command

from push.services import send_reminders


@shared_task
def send_reminders_task():
    return send_reminders()


@shared_task
def materialize_occurrences_task():
    call_command("materialize_occurrences")


@shared_task
def refresh_statuses_task():
    call_command("refresh_statuses")
```

- [ ] **Step 4: Set `CELERY_BEAT_SCHEDULE` in `backend/config/settings.py`**

Add the import at the top of the file (with other imports):
```python
from celery.schedules import crontab
```
Replace `CELERY_BEAT_SCHEDULE = {}` with:
```python
CELERY_BEAT_SCHEDULE = {
    "send-reminders": {"task": "push.tasks.send_reminders_task", "schedule": 60.0},
    "refresh-statuses": {"task": "push.tasks.refresh_statuses_task", "schedule": 300.0},
    "materialize-occurrences": {
        "task": "push.tasks.materialize_occurrences_task",
        "schedule": crontab(hour=0, minute=5),
    },
}
```

- [ ] **Step 5: Add a Celery run note to `backend/README-realtime.md`**

Append:
```markdown

## Background jobs (Celery)

Push reminders and the maintenance sweeps run under Celery (Redis broker):

    celery -A config worker -l info
    celery -A config beat -l info

Beat schedules: reminders every minute, status refresh every 5 minutes,
materialization daily at 00:05. Under pytest, Celery runs eagerly (no worker
or broker needed). Devices register their Expo token via `POST /api/push-tokens/`.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && pytest push/tests/test_tasks.py -v`
Expected: PASS — all three tests (they run eagerly).

- [ ] **Step 7: Run the full suite**

Run: `cd backend && pytest -v`
Expected: PASS — every test across all apps, pristine (0 warnings). Then `ruff check .` — clean.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: Celery tasks and Beat schedule for reminders and maintenance"
```

---

## Self-Review

**Spec coverage (against the MVP spec — push portion):**
- Lembrete por push 15 min antes → Tasks 3 (flag), 4 (Expo client), 5 (sweep), 6 (Beat every minute). ✅
- Vai pro responsável, ou todos se aberta → Task 5 (`_recipient_tokens`). ✅
- Registro do token do dispositivo → Task 2 (`PushToken` + endpoint). ✅
- Celery Beat agenda os jobs de manutenção já existentes → Task 6 (`materialize_occurrences_task`, `refresh_statuses_task`). ✅
- Antecedência fixa 15 min no MVP → `REMINDER_LEAD` (Task 5). ✅
- Correctly deferred: push de avisos de atividade (spec marked future); RN client is Plan 6.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step contains complete code. ✅

**Type consistency:** `send_push(tokens, title, body, data=None)` (Task 4) called by `send_reminders` (Task 5). `send_reminders(now_dt=None)` (Task 5) called by `send_reminders_task` (Task 6). `PushToken` fields (`user`, `token`, `device_name`) consistent across Tasks 2, 5. `Occurrence.reminder_sent` defined Task 3, used Task 5. `Membership.Status.ACTIVE`, `Occurrence.Status.PENDING`, `Environment.timezone` reused correctly. `CELERY_TASK_ALWAYS_EAGER = _TESTING` (Task 1) is what makes every Task-6 `.delay().get()` run inline. Beat task paths (`push.tasks.*`) match the created task names. ✅

**Best-effort discipline:** `send_push` never raises (Task 4), and the sweep marks `reminder_sent=True` regardless of push success (Task 5), so a down Expo endpoint neither crashes the Beat task nor causes infinite retry.

---

## Execution Handoff

This plan (Plan 5 of 6) delivers push reminders and moves the maintenance sweeps onto Celery Beat. The final plan is the **React Native (Expo) client** (Plan 6), which consumes all of this backend: auth, environments, the weekly agenda, the daily board with live updates, the bell, and push-token registration.
