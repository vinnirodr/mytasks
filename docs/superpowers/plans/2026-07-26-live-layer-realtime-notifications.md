# Live Layer — Real-time & Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the live layer — a Django Channels WebSocket per environment that pushes board updates and activity events to connected members in real time, plus a persisted structured `ActivityEvent` feed ("sininho") with unread tracking. Every board action already built (complete / pick-up / postpone / one-off / agenda edits) now also records an activity and broadcasts it.

**Architecture:** One WebSocket per environment (`ws/environments/<env_id>/`) served by a Channels `AsyncJsonWebsocketConsumer`. The client authenticates by sending its Plan-1 JWT as a WebSocket **subprotocol** (`["jwt", "<token>"]`) — the token never appears in the URL. The consumer validates the JWT, verifies active membership, and joins the Channels group `env_<id>`. A `record_activity(...)` service creates a structured `ActivityEvent` and broadcasts it to that group; a `broadcast_board_update(...)` helper broadcasts occurrence changes. The DRF action endpoints call these. Tests use the in-memory channel layer (auto-selected under pytest); production uses Redis via `channels-redis`. Unread state reuses `Membership.notifications_last_read_at` from Plan 1.

**Tech Stack:** Python 3.14, Django 6.0, DRF 3.17, Django Channels 4.3, channels-redis 4.3 (Redis channel layer), daphne 4.2 (ASGI test/runserver support), cbor2 5.6.5, pytest-asyncio 1.4, PostgreSQL, Redis.

## Global Constraints

- Python **3.14**; Django **6.0.x**; DRF **3.17.x**; Channels **4.3.x**; PostgreSQL 15+; Redis 6+.
- **Dependency install caveat (verified):** `cbor2` must be pinned to **5.6.5** and installed with the env var `CBOR2_BUILD_C_EXTENSION=0`, because cbor2 ≥ 5.7 requires a Rust toolchain with no prebuilt Python-3.14 wheel. Always install this project's deps with `CBOR2_BUILD_C_EXTENSION=0 pip install -r requirements.txt`.
- All model PKs are **UUID**; user FKs use `settings.AUTH_USER_MODEL`.
- HTTP API routes under `/api/`; the WebSocket route is `ws/environments/<uuid:env_id>/`.
- WebSocket auth: JWT passed as the second WebSocket subprotocol (`["jwt", "<access-token>"]`); the consumer accepts with `subprotocol="jwt"`. No token in the URL/query string.
- Reuse `environments.permissions.get_membership` and the JWT machinery from `accounts` (simplejwt). Reuse `Membership.notifications_last_read_at` for unread tracking.
- `ActivityEvent` is **structured**: `verb` enum + `actor` + denormalized `actor_name` + optional `occurrence` + `created_at`. No server-rendered sentence.
- The channel layer is **InMemory under pytest** (auto-detected in settings) and **Redis otherwise**. Tests never require a running Redis.
- Run `ruff format` before each commit; `ruff check` clean (migrations excluded). Every task ends green with pristine test output and is committed. `line-length = 100`. `pytest-asyncio` runs in `asyncio_mode = auto`.
- Commit message bodies end with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Channels infra — deps, settings, channel layer, async test harness

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/pytest.ini`
- Modify: `backend/config/settings.py`
- Test: `backend/tests/test_channel_layer_smoke.py`

**Interfaces:**
- Consumes: existing project (Plan 1).
- Produces: `channels` (and `daphne`) installed and in `INSTALLED_APPS`; `CHANNEL_LAYERS` configured (InMemory under pytest, Redis otherwise, `REDIS_URL` from env); `pytest-asyncio` in `asyncio_mode = auto`. `get_channel_layer()` returns a working layer.

- [ ] **Step 1: Add deps to `backend/requirements.txt`**

Append:
```
channels==4.3.2
channels-redis==4.3.0
daphne==4.2.3
cbor2==5.6.5
pytest-asyncio==1.4.0
```

- [ ] **Step 2: Install (note the cbor2 env var)**

Run:
```bash
cd backend && CBOR2_BUILD_C_EXTENSION=0 pip install -r requirements.txt
```
Expected: installs without error. (Without `CBOR2_BUILD_C_EXTENSION=0`, cbor2 tries a Rust build and fails on Python 3.14.)

- [ ] **Step 3: Enable pytest-asyncio in `backend/pytest.ini`**

Add `asyncio_mode = auto` under `[pytest]`:
```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings
python_files = test_*.py
addopts = -v
asyncio_mode = auto
```

- [ ] **Step 4: Configure Channels in `backend/config/settings.py`**

At the very top of `INSTALLED_APPS`, add `"daphne",` as the FIRST entry (enables ASGI `runserver`), and add `"channels",` to the list. Then add this block after `INSTALLED_APPS` (near `REST_FRAMEWORK`):
```python
import sys

_TESTING = "pytest" in sys.modules

if _TESTING:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [env("REDIS_URL", default="redis://localhost:6379/0")]},
        }
    }
```
(`ASGI_APPLICATION = "config.asgi.application"` is already set from Plan 1. Keep `import sys` at the top of the file with the other imports if the linter prefers; ruff will sort it.)

- [ ] **Step 5: Write the smoke test `backend/tests/test_channel_layer_smoke.py`**

```python
import pytest
from channels.layers import get_channel_layer


@pytest.mark.asyncio
async def test_channel_layer_group_send_receive():
    layer = get_channel_layer()
    await layer.group_add("smoke", "chan1")
    await layer.group_send("smoke", {"type": "broadcast", "payload": {"n": 1}})
    message = await layer.receive("chan1")
    assert message == {"type": "broadcast", "payload": {"n": 1}}
```

- [ ] **Step 6: Run the smoke test**

Run: `cd backend && pytest tests/test_channel_layer_smoke.py -v`
Expected: PASS — confirms the InMemory layer + pytest-asyncio wiring work.

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "chore: Channels infra (deps, channel layer, async test harness)"
```

---

### Task 2: `notifications` app + `ActivityEvent` model

**Files:**
- Create: `backend/notifications/__init__.py`, `backend/notifications/apps.py`, `backend/notifications/models.py`
- Modify: `backend/config/settings.py` (append `"notifications"` to `INSTALLED_APPS`)
- Test: `backend/notifications/tests/__init__.py`, `backend/notifications/tests/test_models.py`

**Interfaces:**
- Consumes: `Environment` (Plan 1), `Occurrence` (Plan 2), `settings.AUTH_USER_MODEL`.
- Produces: `notifications.models.ActivityEvent` with nested `Verb` choices `COMPLETED | PICKED_UP | POSTPONED | ADDED_TASK | AGENDA_CHANGED`. Fields: `id` (UUID PK), `environment` (FK, CASCADE, related_name `activity_events`), `actor` (FK user, SET_NULL, null, blank, related_name `activity_events`), `actor_name` (CharField 120, denormalized display name), `verb` (CharField, choices), `occurrence` (FK Occurrence, SET_NULL, null, blank, related_name `activity_events`), `created_at` (auto). `Meta.ordering = ["-created_at"]`.

- [ ] **Step 1: Create `backend/notifications/__init__.py`** (empty) and `backend/notifications/apps.py`

```python
from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"
```

- [ ] **Step 2: Create `backend/notifications/tests/__init__.py`** (empty) and write the failing test `backend/notifications/tests/test_models.py`

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from notifications.models import ActivityEvent

User = get_user_model()


@pytest.mark.django_db
def test_activity_event_defaults_and_ordering():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    first = ActivityEvent.objects.create(
        environment=env, actor=ana, actor_name="Ana", verb=ActivityEvent.Verb.COMPLETED
    )
    second = ActivityEvent.objects.create(
        environment=env, actor=ana, actor_name="Ana", verb=ActivityEvent.Verb.POSTPONED
    )
    assert first.occurrence is None
    # newest first
    assert list(env.activity_events.all()) == [second, first]
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && pytest notifications/tests/test_models.py -v`
Expected: FAIL — app/model missing.

- [ ] **Step 4: Create `backend/notifications/models.py`**

```python
import uuid

from django.conf import settings
from django.db import models

from environments.models import Environment
from tasks.models import Occurrence


class ActivityEvent(models.Model):
    class Verb(models.TextChoices):
        COMPLETED = "COMPLETED", "Concluiu"
        PICKED_UP = "PICKED_UP", "Pegou"
        POSTPONED = "POSTPONED", "Adiou"
        ADDED_TASK = "ADDED_TASK", "Adicionou tarefa"
        AGENDA_CHANGED = "AGENDA_CHANGED", "Mudou a agenda"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="activity_events"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_events",
    )
    actor_name = models.CharField(max_length=120)
    verb = models.CharField(max_length=20, choices=Verb.choices)
    occurrence = models.ForeignKey(
        Occurrence,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.actor_name} {self.verb}"
```

- [ ] **Step 5: Register the app**

Append `"notifications"` to `INSTALLED_APPS` in `backend/config/settings.py`.

- [ ] **Step 6: Create and run the migration**

Run: `cd backend && python manage.py makemigrations notifications && python manage.py migrate`
Expected: initial `notifications` migration created and applied.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && pytest notifications/tests/test_models.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: notifications app and structured ActivityEvent model"
```

---

### Task 3: JWT WebSocket authentication helper

**Files:**
- Create: `backend/notifications/auth.py`
- Test: `backend/notifications/tests/test_ws_auth.py`

**Interfaces:**
- Consumes: simplejwt (`accounts`), the user model.
- Produces: `notifications.auth.get_user_from_token(token)` — an async callable (wrapped with `channels.db.database_sync_to_async`) returning the `User` for a valid simplejwt **access** token, or `None` for a missing/invalid/expired token or unknown user.

- [ ] **Step 1: Write the failing test `backend/notifications/tests/test_ws_auth.py`**

```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.auth import get_user_from_token

User = get_user_model()


@pytest.mark.django_db(transaction=True)
async def test_valid_token_returns_user():
    ana = await _create_user("ana@example.com")
    token = str(RefreshToken.for_user(ana).access_token)
    resolved = await get_user_from_token(token)
    assert resolved == ana


@pytest.mark.django_db(transaction=True)
async def test_invalid_token_returns_none():
    assert await get_user_from_token("not-a-real-token") is None


@pytest.mark.django_db(transaction=True)
async def test_empty_token_returns_none():
    assert await get_user_from_token("") is None


from channels.db import database_sync_to_async


@database_sync_to_async
def _create_user(email):
    return User.objects.create_user(email=email, password="x")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest notifications/tests/test_ws_auth.py -v`
Expected: FAIL — `notifications.auth` does not exist.

- [ ] **Step 3: Create `backend/notifications/auth.py`**

```python
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token):
    """Return the User for a valid simplejwt access token, else None."""
    if not token:
        return None
    try:
        access = AccessToken(token)
    except TokenError:
        return None
    try:
        return User.objects.get(id=access["user_id"])
    except (User.DoesNotExist, KeyError):
        return None
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest notifications/tests/test_ws_auth.py -v`
Expected: PASS — all three tests.

- [ ] **Step 5: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: JWT websocket authentication helper"
```

---

### Task 4: `EnvironmentConsumer` + routing + ASGI wiring

**Files:**
- Create: `backend/notifications/consumers.py`
- Create: `backend/notifications/routing.py`
- Modify: `backend/config/asgi.py`
- Test: `backend/notifications/tests/test_consumer.py`

**Interfaces:**
- Consumes: `get_user_from_token` (Task 3), `Environment`, `get_membership`.
- Produces:
  - `notifications.consumers.EnvironmentConsumer` (`AsyncJsonWebsocketConsumer`): on connect, reads the JWT from `scope["subprotocols"]` (expects `["jwt", "<token>"]`), authenticates, verifies active membership in the URL's `env_id`, joins group `env_<env_id>`, and accepts with `subprotocol="jwt"`. Missing/invalid token or non-member → `close()`. A `broadcast(event)` handler forwards `event["payload"]` to the client via `send_json`. On disconnect, discards the group.
  - `notifications.routing.websocket_urlpatterns` → `ws/environments/<uuid:env_id>/`.
  - `config.asgi.application` becomes a `ProtocolTypeRouter` routing http → the Django ASGI app and websocket → the URLRouter.

- [ ] **Step 1: Write the failing test `backend/notifications/tests/test_consumer.py`**

```python
import pytest
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from config.asgi import application
from environments.models import Environment, Membership

User = get_user_model()


@database_sync_to_async
def _make_env_with_member():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    outsider = User.objects.create_user(email="out@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role=Membership.Role.MEMBER)
    return env, ana, bob, outsider


def _token(user):
    return str(RefreshToken.for_user(user).access_token)


async def _connect(env_id, user):
    communicator = WebsocketCommunicator(
        application, f"/ws/environments/{env_id}/", subprotocols=["jwt", _token(user)]
    )
    connected, _ = await communicator.connect()
    return communicator, connected


@pytest.mark.django_db(transaction=True)
async def test_member_connects_and_receives_group_broadcast():
    env, ana, bob, outsider = await _make_env_with_member()
    communicator, connected = await _connect(env.id, bob)
    assert connected is True
    layer = get_channel_layer()
    await layer.group_send(
        f"env_{env.id}", {"type": "broadcast", "payload": {"kind": "ping"}}
    )
    message = await communicator.receive_json_from()
    assert message == {"kind": "ping"}
    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_outsider_is_rejected():
    env, ana, bob, outsider = await _make_env_with_member()
    communicator, connected = await _connect(env.id, outsider)
    assert connected is False
    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_missing_token_is_rejected():
    env, ana, bob, outsider = await _make_env_with_member()
    communicator = WebsocketCommunicator(application, f"/ws/environments/{env.id}/")
    connected, _ = await communicator.connect()
    assert connected is False
    await communicator.disconnect()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest notifications/tests/test_consumer.py -v`
Expected: FAIL — consumer/routing/asgi not defined (import error).

- [ ] **Step 3: Create `backend/notifications/consumers.py`**

```python
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from environments.models import Environment
from environments.permissions import get_membership
from notifications.auth import get_user_from_token


class EnvironmentConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        token = self._token_from_subprotocols()
        user = await get_user_from_token(token)
        if user is None:
            await self.close()
            return
        env_id = self.scope["url_route"]["kwargs"]["env_id"]
        if await self._get_membership(user, env_id) is None:
            await self.close()
            return
        self.group_name = f"env_{env_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept(subprotocol="jwt")

    async def disconnect(self, code):
        group_name = getattr(self, "group_name", None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def broadcast(self, event):
        await self.send_json(event["payload"])

    def _token_from_subprotocols(self):
        subprotocols = self.scope.get("subprotocols", [])
        if len(subprotocols) >= 2 and subprotocols[0] == "jwt":
            return subprotocols[1]
        return None

    @database_sync_to_async
    def _get_membership(self, user, env_id):
        try:
            environment = Environment.objects.get(id=env_id)
        except Environment.DoesNotExist:
            return None
        return get_membership(user, environment)
```

- [ ] **Step 4: Create `backend/notifications/routing.py`**

```python
from django.urls import path

from notifications.consumers import EnvironmentConsumer

websocket_urlpatterns = [
    path("ws/environments/<uuid:env_id>/", EnvironmentConsumer.as_asgi()),
]
```

- [ ] **Step 5: Replace `backend/config/asgi.py`**

```python
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.asgi import get_asgi_application  # noqa: E402

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from notifications.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": URLRouter(websocket_urlpatterns),
    }
)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && pytest notifications/tests/test_consumer.py -v`
Expected: PASS — all three tests (member connects + receives broadcast, outsider rejected, missing token rejected).

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: EnvironmentConsumer with subprotocol JWT auth and ASGI routing"
```

---

### Task 5: Broadcasting service (`record_activity`, `broadcast_board_update`)

**Files:**
- Create: `backend/notifications/services.py`
- Test: `backend/notifications/tests/test_broadcasting.py`

**Interfaces:**
- Consumes: `ActivityEvent` (Task 2), the channel layer, `Occurrence`.
- Produces:
  - `notifications.services.broadcast_to_environment(environment_id, payload)` — sync; sends `{"type": "broadcast", "payload": payload}` to group `env_<environment_id>` via `async_to_sync(channel_layer.group_send)`.
  - `notifications.services.record_activity(environment, actor, verb, occurrence=None)` — creates an `ActivityEvent` (`actor_name` = `actor.display_name or actor.email`), then broadcasts `{"kind": "activity", "event": <serialized>}`; returns the created `ActivityEvent`.
  - `notifications.services.broadcast_board_update(occurrence)` — broadcasts `{"kind": "board_update", "occurrence_id": str(occurrence.id), "status": occurrence.status}` to the occurrence's environment.

- [ ] **Step 1: Write the failing test `backend/notifications/tests/test_broadcasting.py`**

```python
import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from config.asgi import application
from environments.models import Environment
from notifications.models import ActivityEvent
from notifications.services import record_activity

User = get_user_model()


@database_sync_to_async
def _make_env():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    return env, ana


@database_sync_to_async
def _record(env, ana):
    return record_activity(env, ana, ActivityEvent.Verb.COMPLETED)


@pytest.mark.django_db(transaction=True)
async def test_record_activity_creates_event_and_broadcasts():
    env, ana = await _make_env()
    communicator = WebsocketCommunicator(
        application,
        f"/ws/environments/{env.id}/",
        subprotocols=["jwt", str(RefreshToken.for_user(ana).access_token)],
    )
    connected, _ = await communicator.connect()
    assert connected

    event = await _record(env, ana)
    assert event.actor_name == "Ana"
    assert await database_sync_to_async(ActivityEvent.objects.count)() == 1

    message = await communicator.receive_json_from()
    assert message["kind"] == "activity"
    assert message["event"]["verb"] == "COMPLETED"
    assert message["event"]["actor_name"] == "Ana"
    await communicator.disconnect()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest notifications/tests/test_broadcasting.py -v`
Expected: FAIL — `notifications.services` does not exist.

- [ ] **Step 3: Create `backend/notifications/services.py`**

```python
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from notifications.models import ActivityEvent


def broadcast_to_environment(environment_id, payload):
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        f"env_{environment_id}", {"type": "broadcast", "payload": payload}
    )


def _serialize_event(event):
    return {
        "id": str(event.id),
        "verb": event.verb,
        "actor_name": event.actor_name,
        "occurrence_id": str(event.occurrence_id) if event.occurrence_id else None,
        "created_at": event.created_at.isoformat(),
    }


def record_activity(environment, actor, verb, occurrence=None):
    actor_name = (actor.display_name or actor.email) if actor else ""
    event = ActivityEvent.objects.create(
        environment=environment,
        actor=actor,
        actor_name=actor_name,
        verb=verb,
        occurrence=occurrence,
    )
    broadcast_to_environment(
        environment.id, {"kind": "activity", "event": _serialize_event(event)}
    )
    return event


def broadcast_board_update(occurrence):
    broadcast_to_environment(
        occurrence.environment_id,
        {
            "kind": "board_update",
            "occurrence_id": str(occurrence.id),
            "status": occurrence.status,
        },
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest notifications/tests/test_broadcasting.py -v`
Expected: PASS — the connected WebSocket receives the `activity` message and the `ActivityEvent` is persisted.

- [ ] **Step 5: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: activity recording and broadcasting service"
```

---

### Task 6: Wire activity + board broadcasts into the action endpoints

**Files:**
- Modify: `backend/tasks/views.py` (complete / pickup / postpone / one-off create / recurring create-update-delete / occurrence patch-cancel)
- Test: `backend/tasks/tests/test_activity_wiring.py`

**Interfaces:**
- Consumes: `record_activity`, `broadcast_board_update` (Task 5), `ActivityEvent.Verb`.
- Produces: each write endpoint records an `ActivityEvent` and (for occurrence-state changes) broadcasts a board update:
  - `OccurrenceCompleteView` → `record_activity(env, user, COMPLETED, occ)` + `broadcast_board_update(occ)`
  - `OccurrencePickupView` → `record_activity(env, user, PICKED_UP, occ)` + `broadcast_board_update(occ)`
  - `OccurrencePostponeView` → `record_activity(env, user, POSTPONED, occ)` + `broadcast_board_update(occ)`
  - `OccurrenceListCreateView.post` (one-off) → `record_activity(env, user, ADDED_TASK, occ)` + `broadcast_board_update(occ)`
  - `RecurringTaskListCreateView.post`, `RecurringTaskDetailView.patch`/`delete`, `OccurrenceDetailView.patch`, `OccurrenceCancelView.post` → `record_activity(env, user, AGENDA_CHANGED)` (no board_update needed for pure agenda edits except the occurrence ones, which may also `broadcast_board_update`).

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_activity_wiring.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from notifications.models import ActivityEvent
from tasks.models import Occurrence, RecurringTask, TaskDefinition

User = get_user_model()


def _setup():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    return env, ana, bob


@pytest.mark.django_db
def test_complete_records_activity():
    env, ana, bob = _setup()
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=datetime.date(2026, 7, 27), assignee=ana
    )
    auth_client(bob).post(f"/api/occurrences/{occ.id}/complete/")
    event = ActivityEvent.objects.get(environment=env, verb=ActivityEvent.Verb.COMPLETED)
    assert event.actor_id == bob.id
    assert event.occurrence_id == occ.id


@pytest.mark.django_db
def test_pickup_records_activity():
    env, ana, bob = _setup()
    occ = Occurrence.objects.create(
        environment=env, title="Lixo", date=datetime.date(2026, 7, 27), assignee=None
    )
    auth_client(bob).post(f"/api/occurrences/{occ.id}/pickup/")
    assert ActivityEvent.objects.filter(
        environment=env, verb=ActivityEvent.Verb.PICKED_UP, actor=bob
    ).exists()


@pytest.mark.django_db
def test_one_off_records_added_task_activity():
    env, ana, bob = _setup()
    auth_client(bob).post(
        f"/api/environments/{env.id}/occurrences/",
        {"title": "Regar", "date": "2026-07-27"},
        format="json",
    )
    assert ActivityEvent.objects.filter(
        environment=env, verb=ActivityEvent.Verb.ADDED_TASK, actor=bob
    ).exists()


@pytest.mark.django_db
def test_recurring_create_records_agenda_changed():
    env, ana, bob = _setup()
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    auth_client(ana).post(
        f"/api/environments/{env.id}/recurring-tasks/",
        {"task_definition": str(td.id), "weekday": 0, "time": "20:00"},
        format="json",
    )
    assert ActivityEvent.objects.filter(
        environment=env, verb=ActivityEvent.Verb.AGENDA_CHANGED, actor=ana
    ).exists()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_activity_wiring.py -v`
Expected: FAIL — no ActivityEvents recorded yet.

- [ ] **Step 3: Import the services in `backend/tasks/views.py`**

Add at the top (with the other imports):
```python
from notifications.models import ActivityEvent
from notifications.services import broadcast_board_update, record_activity
```

- [ ] **Step 4: Record activity in the occurrence-state endpoints**

In `OccurrenceCompleteView.post`, after `occ.save(update_fields=[...])` and before the `return`, add:
```python
        record_activity(occ.environment, request.user, ActivityEvent.Verb.COMPLETED, occ)
        broadcast_board_update(occ)
```
In `OccurrencePickupView.post`, after `occ.save(update_fields=["assignee"])` and before `return`:
```python
        record_activity(occ.environment, request.user, ActivityEvent.Verb.PICKED_UP, occ)
        broadcast_board_update(occ)
```
In `OccurrencePostponeView.post`, after `occ.save(update_fields=["status"])` and before `return`:
```python
        record_activity(occ.environment, request.user, ActivityEvent.Verb.POSTPONED, occ)
        broadcast_board_update(occ)
```

- [ ] **Step 5: Record activity for one-off creation**

In `OccurrenceListCreateView.post`, after `serializer.save(...)` (which returns the instance via `serializer.instance`), add before the `return`:
```python
        occ = serializer.instance
        record_activity(occ.environment, request.user, ActivityEvent.Verb.ADDED_TASK, occ)
        broadcast_board_update(occ)
```

- [ ] **Step 6: Record AGENDA_CHANGED for agenda edits**

In each of these, after the successful mutation and before the `return`, add `record_activity(<environment>, request.user, ActivityEvent.Verb.AGENDA_CHANGED)`:
- `RecurringTaskListCreateView.post` → environment is the resolved `environment`: `record_activity(environment, request.user, ActivityEvent.Verb.AGENDA_CHANGED)`
- `RecurringTaskDetailView.patch` and `.delete` → use `rt.environment` (capture it before delete): in `delete`, read `environment = rt.environment` before `rt.delete()`, then `record_activity(environment, request.user, ActivityEvent.Verb.AGENDA_CHANGED)`.
- `OccurrenceDetailView.patch` → `record_activity(occ.environment, request.user, ActivityEvent.Verb.AGENDA_CHANGED)` and also `broadcast_board_update(occ)`.
- `OccurrenceCancelView.post` → `record_activity(occ.environment, request.user, ActivityEvent.Verb.AGENDA_CHANGED)` and `broadcast_board_update(occ)`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_activity_wiring.py -v`
Expected: PASS — all four tests.

- [ ] **Step 8: Run the tasks regression tests**

Run: `cd backend && pytest tasks/ -v`
Expected: PASS — all existing tasks tests still green (the added calls don't change status codes).

- [ ] **Step 9: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: record and broadcast activity on board and agenda actions"
```

---

### Task 7: Bell REST API (feed, unread count, mark-read)

**Files:**
- Create: `backend/notifications/serializers.py`
- Create: `backend/notifications/views.py`
- Create: `backend/notifications/urls.py`
- Modify: `backend/config/urls.py` (include `notifications.urls` under `api/`)
- Test: `backend/notifications/tests/test_bell_api.py`

**Interfaces:**
- Consumes: `ActivityEvent`, `Membership.notifications_last_read_at`, `EnvironmentScopedView` pattern (reuse `environments.permissions`).
- Produces:
  - `notifications.serializers.ActivityEventSerializer` — fields `["id", "verb", "actor_name", "occurrence", "created_at"]` (read-only).
  - `GET /api/environments/{env_id}/activity/` — active member → 200 list of the environment's events (newest first, capped at 50), each with an `unread` boolean derived from the requester's `notifications_last_read_at`, plus a top-level `unread_count`. Response shape: `{"unread_count": int, "results": [ {..event.., "unread": bool} ]}`.
  - `POST /api/environments/{env_id}/activity/read/` — active member → 200 `{"unread_count": 0}`; sets the requester's membership `notifications_last_read_at = now`.

- [ ] **Step 1: Write the failing test `backend/notifications/tests/test_bell_api.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from notifications.models import ActivityEvent

User = get_user_model()


def _setup():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    bob = User.objects.create_user(email="bob@example.com", password="x", display_name="Bob")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    return env, ana, bob


@pytest.mark.django_db
def test_feed_lists_events_with_unread_count():
    env, ana, bob = _setup()
    ActivityEvent.objects.create(
        environment=env, actor=ana, actor_name="Ana", verb=ActivityEvent.Verb.COMPLETED
    )
    ActivityEvent.objects.create(
        environment=env, actor=bob, actor_name="Bob", verb=ActivityEvent.Verb.PICKED_UP
    )
    resp = auth_client(bob).get(f"/api/environments/{env.id}/activity/")
    assert resp.status_code == 200
    assert resp.data["unread_count"] == 2
    assert len(resp.data["results"]) == 2
    assert resp.data["results"][0]["unread"] is True


@pytest.mark.django_db
def test_mark_read_zeroes_unread_count():
    env, ana, bob = _setup()
    ActivityEvent.objects.create(
        environment=env, actor=ana, actor_name="Ana", verb=ActivityEvent.Verb.COMPLETED
    )
    mark = auth_client(bob).post(f"/api/environments/{env.id}/activity/read/")
    assert mark.status_code == 200
    assert mark.data["unread_count"] == 0

    feed = auth_client(bob).get(f"/api/environments/{env.id}/activity/")
    assert feed.data["unread_count"] == 0
    assert feed.data["results"][0]["unread"] is False


@pytest.mark.django_db
def test_outsider_cannot_read_feed():
    env, ana, bob = _setup()
    out = User.objects.create_user(email="out@example.com", password="x")
    resp = auth_client(out).get(f"/api/environments/{env.id}/activity/")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest notifications/tests/test_bell_api.py -v`
Expected: FAIL — routes not defined.

- [ ] **Step 3: Create `backend/notifications/serializers.py`**

```python
from rest_framework import serializers

from notifications.models import ActivityEvent


class ActivityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityEvent
        fields = ["id", "verb", "actor_name", "occurrence", "created_at"]
        read_only_fields = fields
```

- [ ] **Step 4: Create `backend/notifications/views.py`**

```python
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from environments.models import Environment
from environments.permissions import get_membership
from notifications.serializers import ActivityEventSerializer

FEED_LIMIT = 50


class ActivityFeedView(APIView):
    def get(self, request, env_id):
        environment = get_object_or_404(Environment, pk=env_id)
        membership = get_membership(request.user, environment)
        if membership is None:
            raise Http404
        events = list(environment.activity_events.all()[:FEED_LIMIT])
        last_read = membership.notifications_last_read_at
        unread_count = sum(
            1 for e in events if last_read is None or e.created_at > last_read
        )
        results = []
        for e in events:
            data = ActivityEventSerializer(e).data
            data["unread"] = last_read is None or e.created_at > last_read
            results.append(data)
        return Response({"unread_count": unread_count, "results": results})


class ActivityMarkReadView(APIView):
    def post(self, request, env_id):
        environment = get_object_or_404(Environment, pk=env_id)
        membership = get_membership(request.user, environment)
        if membership is None:
            raise Http404
        membership.notifications_last_read_at = timezone.now()
        membership.save(update_fields=["notifications_last_read_at"])
        return Response({"unread_count": 0}, status=http_status.HTTP_200_OK)
```

- [ ] **Step 5: Create `backend/notifications/urls.py`**

```python
from django.urls import path

from notifications.views import ActivityFeedView, ActivityMarkReadView

urlpatterns = [
    path(
        "environments/<uuid:env_id>/activity/",
        ActivityFeedView.as_view(),
        name="activity-feed",
    ),
    path(
        "environments/<uuid:env_id>/activity/read/",
        ActivityMarkReadView.as_view(),
        name="activity-mark-read",
    ),
]
```

- [ ] **Step 6: Wire into `backend/config/urls.py`**

Add to `urlpatterns`:
```python
    path("api/", include("notifications.urls")),
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && pytest notifications/tests/test_bell_api.py -v`
Expected: PASS — all three tests.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: activity feed and mark-read (bell) REST API"
```

---

### Task 8: Full-suite verification & ASGI run note

**Files:**
- Create: `backend/README-realtime.md`
- Test: (whole suite)

**Interfaces:**
- Consumes: everything above.
- Produces: a short note on how to run the ASGI server (so WebSockets work) and confirmation the full suite is green.

- [ ] **Step 1: Create `backend/README-realtime.md`**

```markdown
# Real-time (WebSocket) — running locally

The app is ASGI (Django Channels). To serve WebSockets you must run an ASGI
server, not plain WSGI:

    # dev (Channels' daphne, via runserver — "daphne" is first in INSTALLED_APPS)
    python manage.py runserver

    # or explicitly with daphne
    daphne config.asgi:application

Requires Redis running (the production channel layer). Install deps with:

    CBOR2_BUILD_C_EXTENSION=0 pip install -r requirements.txt

(cbor2 is pinned to 5.6.5 and built pure-Python; cbor2 >= 5.7 needs a Rust
toolchain with no Python 3.14 wheel.)

WebSocket endpoint: `ws/environments/<env_id>/`. Authenticate by sending the
JWT access token as the second WebSocket subprotocol: `["jwt", "<token>"]`.
Under pytest the channel layer is in-memory, so tests need no Redis.
```

- [ ] **Step 2: Run the full suite**

Run: `cd backend && pytest -v`
Expected: PASS — every test across `accounts`, `environments`, `tasks`, `notifications`, pristine (0 warnings).

- [ ] **Step 3: Run ruff**

Run: `cd backend && ruff check .`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "docs: real-time run notes; full-suite green"
```

---

## Self-Review

**Spec coverage (against the MVP spec — real-time + notifications portion):**
- Tempo real do quadro do dia (todos veem ações ao vivo) → Tasks 4 (consumer), 5 (broadcast), 6 (board_update on complete/pickup/postpone/one-off). ✅
- Sininho / feed de atividades com contador de não-lidas ao vivo → Tasks 2 (model), 5 (activity broadcast), 7 (feed + unread + mark-read). Live increment is delivered as `activity` WS messages (Task 5/6); the initial/unread count comes from Task 7. ✅
- "ADM mudou a agenda" no feed → Task 6 (AGENDA_CHANGED on recurring/occurrence edits). ✅
- Unread reuses `Membership.notifications_last_read_at` (Plan 1) → Task 7. ✅
- WebSocket JWT auth without token in URL (subprotocol) → Tasks 3, 4. ✅
- Correctly deferred: push (Celery + Expo) is Plan 5; RN client is Plan 6; presence/"who's online" is intentionally out of scope.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step contains complete code. ✅

**Type consistency:** `get_user_from_token(token)` (Task 3) used by the consumer (Task 4). `EnvironmentConsumer` group `env_<id>` and the `broadcast` handler (`event["payload"]`) match `broadcast_to_environment`'s `{"type": "broadcast", "payload": ...}` (Task 5). `record_activity(environment, actor, verb, occurrence=None)` and `broadcast_board_update(occurrence)` (Task 5) called consistently in Task 6. `ActivityEvent.Verb.*` values consistent across Tasks 2, 5, 6. `ActivityEventSerializer` fields align with `_serialize_event` semantics (both structured, verb/actor_name). `auth_client` reused from `environments/tests/test_environment_api.py`. Channel layer is InMemory under pytest per Task 1 settings, which every async test relies on. ✅

**Cross-plan integration note:** Task 6 edits Plan 2/3 endpoints only to append `record_activity`/`broadcast_board_update` after the existing mutation+save; status codes and response bodies are unchanged, so Plan 2/3 tests remain valid (Step 8 re-runs them).

---

## Execution Handoff

This plan (Plan 4 of 6) delivers the live layer — real-time board/broadcast over WebSockets plus the structured activity feed with unread tracking. The remaining plans are push reminders (Celery + Celery Beat + Expo; also the natural home to schedule `materialize_occurrences` and `refresh_statuses`) and the React Native (Expo) client.
