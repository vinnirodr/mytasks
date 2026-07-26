# Daily Board & Status Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the materialized occurrences into a working "daily board": time-driven status transitions (Pendente → Atrasada → Não feita) applied by an idempotent, timezone-aware service, plus the member actions that drive the board — mark done, pick up an open task, postpone — with Adiada sorted to the bottom of the day.

**Architecture:** Status transitions are computed and **persisted** by a pure idempotent service `refresh_statuses(environment, now_dt)` that mirrors Plan 2's materialization pattern — called on the daily-board read and by a management command (Celery Beat wires it later, in Plan 5). Member actions (complete / pick-up / postpone) are immediate REST endpoints on an `Occurrence`. "Today" and "late" are computed in each environment's own IANA timezone via a new `Environment.timezone` field. This plan is REST-only and fully testable without WebSockets; the real-time broadcast layer is a later plan.

**Tech Stack:** Python 3.14, Django 6.0, Django REST Framework 3.17, PostgreSQL, pytest. Timezones via stdlib `zoneinfo`.

## Global Constraints

- Python **3.14**; Django **6.0.x**; Django REST Framework **3.17.x**; PostgreSQL 15+ (tests included).
- All model PKs are **UUID**; user FKs use `settings.AUTH_USER_MODEL`.
- All API routes under `/api/`. Reuse `environments.permissions` (`get_membership`, `is_admin`) and `tasks.views.EnvironmentScopedView`. Do not reimplement role checks.
- Occurrence statuses (defined in Plan 2): `PENDING | LATE | DONE | POSTPONED | MISSED`.
- Status transition rules (verbatim — the service persists these; DONE and MISSED are terminal, never overwritten):
  - A non-cancelled, non-DONE, non-MISSED occurrence whose `date` is **before today** (in the environment's timezone) becomes **MISSED**.
  - A **PENDING** occurrence whose `date` **is today** and which has a `time` that is **already past** (local now > time) becomes **LATE**.
  - **POSTPONED** and **LATE** occurrences stay as they are until the day ends (then MISSED). **DONE** stays DONE.
- Member actions: **any active member** may mark **any** occurrence done (spec decision) and may **pick up** an open (unassigned) occurrence. **Postpone** is allowed only for the occurrence's `assignee` or an ADMIN.
- The daily board (day view) sorts **POSTPONED occurrences last**, everything else by `time`.
- "Today" and all transition math use the environment's `timezone` (IANA name), NOT the server timezone.
- Run `ruff format` before each commit; `ruff check` clean (migrations already excluded). Every task ends green with pristine test output and is committed. `line-length = 100`.
- Commit message bodies end with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `Environment.timezone` field

**Files:**
- Modify: `backend/environments/models.py` (add `timezone` field to `Environment`)
- Modify: `backend/environments/serializers.py` (expose + validate `timezone`)
- Test: `backend/environments/tests/test_timezone.py`

**Interfaces:**
- Consumes: `Environment` (Plan 1).
- Produces: `Environment.timezone` — `CharField(max_length=64, default="America/Sao_Paulo")`. `EnvironmentSerializer` now includes `timezone` (writable; validated as a real IANA zone via `zoneinfo.ZoneInfo`). Admin can set it via the existing `PATCH /api/environments/{id}/`. On create it defaults (create path unchanged).

- [ ] **Step 1: Write the failing test `backend/environments/tests/test_timezone.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from environments.tests.test_environment_api import auth_client

User = get_user_model()


@pytest.mark.django_db
def test_default_timezone_is_sao_paulo():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    assert env.timezone == "America/Sao_Paulo"


@pytest.mark.django_db
def test_admin_can_set_valid_timezone():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    resp = auth_client(ana).patch(
        f"/api/environments/{env.id}/", {"timezone": "America/New_York"}, format="json"
    )
    assert resp.status_code == 200
    env.refresh_from_db()
    assert env.timezone == "America/New_York"


@pytest.mark.django_db
def test_invalid_timezone_rejected():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    resp = auth_client(ana).patch(
        f"/api/environments/{env.id}/", {"timezone": "Mars/Phobos"}, format="json"
    )
    assert resp.status_code == 400
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest environments/tests/test_timezone.py -v`
Expected: FAIL — `timezone` attribute/field does not exist.

- [ ] **Step 3: Add the field to `Environment` in `backend/environments/models.py`**

Add this field to the `Environment` model (after `env_type`):
```python
    timezone = models.CharField(max_length=64, default="America/Sao_Paulo")
```

- [ ] **Step 4: Expose + validate it in `backend/environments/serializers.py`**

Add the import at the top:
```python
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
```
In `EnvironmentSerializer.Meta`, add `"timezone"` to `fields` (keep `read_only_fields = ["id", "role"]` unchanged). Add this method to the serializer:
```python
    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError("Fuso horário inválido.")
        return value
```

- [ ] **Step 5: Create and run the migration**

Run: `cd backend && python manage.py makemigrations environments && python manage.py migrate`
Expected: a migration adding `timezone` is created and applied.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && pytest environments/tests/test_timezone.py -v`
Expected: PASS — all three tests.

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: per-environment timezone field"
```

---

### Task 2: Occurrence completion fields

**Files:**
- Modify: `backend/tasks/models.py` (add `completed_by`, `completed_at` to `Occurrence`)
- Modify: `backend/tasks/serializers.py` (add the two fields to `OccurrenceSerializer`)
- Test: `backend/tasks/tests/test_occurrence_completion_fields.py`

**Interfaces:**
- Consumes: `Occurrence` (Plan 2).
- Produces: `Occurrence.completed_by` (FK user, SET_NULL, null, blank, related_name `completed_occurrences`) and `Occurrence.completed_at` (DateTimeField, null, blank). `OccurrenceSerializer` now also exposes `completed_by` and `completed_at` (read-only).

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_occurrence_completion_fields.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from environments.models import Environment
from tasks.models import Occurrence

User = get_user_model()


@pytest.mark.django_db
def test_completion_fields_default_null_and_settable():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=datetime.date(2026, 7, 27)
    )
    assert occ.completed_by is None
    assert occ.completed_at is None

    now = timezone.now()
    occ.completed_by = ana
    occ.completed_at = now
    occ.save()
    occ.refresh_from_db()
    assert occ.completed_by == ana
    assert occ.completed_at == now
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_occurrence_completion_fields.py -v`
Expected: FAIL — `completed_by`/`completed_at` do not exist.

- [ ] **Step 3: Add the fields to `Occurrence` in `backend/tasks/models.py`**

Add these fields (after `created_by`):
```python
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_occurrences",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
```

- [ ] **Step 4: Add them to `OccurrenceSerializer` in `backend/tasks/serializers.py`**

In `OccurrenceSerializer.Meta.fields`, append `"completed_by"` and `"completed_at"` to the list (keep `read_only_fields = fields`).

- [ ] **Step 5: Create and run the migration**

Run: `cd backend && python manage.py makemigrations tasks && python manage.py migrate`
Expected: a migration adding the two fields is created and applied.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_occurrence_completion_fields.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: occurrence completion fields (completed_by, completed_at)"
```

---

### Task 3: Timezone-aware status transition service

**Files:**
- Modify: `backend/tasks/services.py` (add `refresh_statuses` + `_target_status`)
- Test: `backend/tasks/tests/test_refresh_statuses.py`

**Interfaces:**
- Consumes: `Occurrence` (Plan 2), `Environment.timezone` (Task 1).
- Produces:
  - `tasks.services.refresh_statuses(environment, now_dt=None)` → idempotently persists LATE/MISSED per the Global Constraints rules, computing "today"/"now" in `environment.timezone`. `now_dt` (an aware datetime) defaults to `django.utils.timezone.now()`. Returns the count of occurrences updated. Never touches DONE/MISSED (terminal) or cancelled occurrences.
  - `tasks.services._target_status(occurrence, today, now_time)` → the status an occurrence should have given the local `today` (a `date`) and `now_time` (a `time`).

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_refresh_statuses.py`**

```python
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
    return Environment.create_with_admin(
        name="Casa", env_type=Environment.Type.HOUSE, owner=owner
    )


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
    occ = _occ(env, datetime.date(2026, 7, 26), datetime.time(20, 0),
               status=Occurrence.Status.POSTPONED)
    refresh_statuses(env, now_dt=_aware(2026, 7, 27, 8, 0))
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.MISSED


def test_done_is_never_touched(env):
    occ = _occ(env, datetime.date(2026, 7, 26), datetime.time(20, 0),
               status=Occurrence.Status.DONE)
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_refresh_statuses.py -v`
Expected: FAIL — `refresh_statuses` does not exist.

- [ ] **Step 3: Add the service to `backend/tasks/services.py`**

Add the imports at the top (extend existing):
```python
from zoneinfo import ZoneInfo

from django.utils import timezone
```
Append:
```python
_TERMINAL_STATUSES = {Occurrence.Status.DONE, Occurrence.Status.MISSED}


def _target_status(occurrence, today, now_time):
    """The status this occurrence should have, given local `today` and `now_time`."""
    if occurrence.date < today:
        return Occurrence.Status.MISSED
    if (
        occurrence.status == Occurrence.Status.PENDING
        and occurrence.date == today
        and occurrence.time is not None
        and now_time > occurrence.time
    ):
        return Occurrence.Status.LATE
    return occurrence.status


def refresh_statuses(environment, now_dt=None):
    """Idempotently persist LATE/MISSED transitions using the environment's timezone.

    Returns the number of occurrences whose status changed. DONE/MISSED are
    terminal and never touched; cancelled occurrences are ignored.
    """
    now_dt = now_dt or timezone.now()
    local_now = now_dt.astimezone(ZoneInfo(environment.timezone))
    today = local_now.date()
    now_time = local_now.time()

    qs = environment.occurrences.filter(is_cancelled=False).exclude(
        status__in=_TERMINAL_STATUSES
    )
    updated = 0
    for occ in qs:
        target = _target_status(occ, today, now_time)
        if target != occ.status:
            occ.status = target
            occ.save(update_fields=["status"])
            updated += 1
    return updated
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_refresh_statuses.py -v`
Expected: PASS — all seven tests.

- [ ] **Step 5: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: timezone-aware status transition service"
```

---

### Task 4: Complete-occurrence endpoint

**Files:**
- Modify: `backend/tasks/views.py` (add `OccurrenceCompleteView`)
- Modify: `backend/tasks/urls.py` (add route)
- Test: `backend/tasks/tests/test_occurrence_complete_api.py`

**Interfaces:**
- Consumes: `Occurrence`, `OccurrenceSerializer`, permission helpers.
- Produces: `POST /api/occurrences/{pk}/complete/` — any active member → 200 (returns `OccurrenceSerializer`). Sets `status=DONE`, `completed_by=request.user`, `completed_at=timezone.now()`. Idempotent-ish: completing an already-DONE occurrence just re-stamps and returns 200. Outsider → 404.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_occurrence_complete_api.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence

User = get_user_model()


def _setup():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=datetime.date(2026, 7, 27),
        time=datetime.time(20, 0), assignee=ana,
    )
    return env, ana, bob, occ


@pytest.mark.django_db
def test_member_can_complete_any_occurrence():
    env, ana, bob, occ = _setup()  # occ is assigned to ana; bob completes it
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/complete/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.DONE
    assert occ.completed_by_id == bob.id
    assert occ.completed_at is not None


@pytest.mark.django_db
def test_outsider_cannot_complete():
    env, ana, bob, occ = _setup()
    out = User.objects.create_user(email="out@example.com", password="x")
    resp = auth_client(out).post(f"/api/occurrences/{occ.id}/complete/")
    assert resp.status_code == 404
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.PENDING
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_occurrence_complete_api.py -v`
Expected: FAIL — route not defined.

- [ ] **Step 3: Add the view to `backend/tasks/views.py`**

Add the import (extend existing):
```python
from django.utils import timezone
```
Append:
```python
class OccurrenceCompleteView(APIView):
    def post(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        occ.status = Occurrence.Status.DONE
        occ.completed_by = request.user
        occ.completed_at = timezone.now()
        occ.save(update_fields=["status", "completed_by", "completed_at"])
        return Response(OccurrenceSerializer(occ).data)
```

- [ ] **Step 4: Add the route to `backend/tasks/urls.py`**

Add `OccurrenceCompleteView` to the imports and append to `urlpatterns`:
```python
    path(
        "occurrences/<uuid:pk>/complete/",
        OccurrenceCompleteView.as_view(),
        name="occurrence-complete",
    ),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_occurrence_complete_api.py -v`
Expected: PASS — both tests.

- [ ] **Step 6: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: complete-occurrence endpoint"
```

---

### Task 5: Pick-up (self-assign) endpoint

**Files:**
- Modify: `backend/tasks/views.py` (add `OccurrencePickupView`)
- Modify: `backend/tasks/urls.py` (add route)
- Test: `backend/tasks/tests/test_occurrence_pickup_api.py`

**Interfaces:**
- Consumes: `Occurrence`, `OccurrenceSerializer`, permission helpers.
- Produces: `POST /api/occurrences/{pk}/pickup/` — any active member → 200. If the occurrence is **open** (`assignee is None`), sets `assignee=request.user`. If it already has an assignee → 400 `{"detail": ...}`. Outsider → 404.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_occurrence_pickup_api.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence

User = get_user_model()


def _open_occ():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=datetime.date(2026, 7, 27), assignee=None
    )
    return env, ana, bob, occ


@pytest.mark.django_db
def test_member_picks_up_open_occurrence():
    env, ana, bob, occ = _open_occ()
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/pickup/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.assignee_id == bob.id


@pytest.mark.django_db
def test_cannot_pick_up_already_assigned():
    env, ana, bob, occ = _open_occ()
    occ.assignee = ana
    occ.save(update_fields=["assignee"])
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/pickup/")
    assert resp.status_code == 400
    occ.refresh_from_db()
    assert occ.assignee_id == ana.id


@pytest.mark.django_db
def test_outsider_cannot_pick_up():
    env, ana, bob, occ = _open_occ()
    out = User.objects.create_user(email="out@example.com", password="x")
    resp = auth_client(out).post(f"/api/occurrences/{occ.id}/pickup/")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_occurrence_pickup_api.py -v`
Expected: FAIL — route not defined.

- [ ] **Step 3: Add the view to `backend/tasks/views.py`**

Append:
```python
class OccurrencePickupView(APIView):
    def post(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        if occ.assignee_id is not None:
            return Response(
                {"detail": "Esta tarefa já tem um responsável."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        occ.assignee = request.user
        occ.save(update_fields=["assignee"])
        return Response(OccurrenceSerializer(occ).data)
```

- [ ] **Step 4: Add the route to `backend/tasks/urls.py`**

Add `OccurrencePickupView` to the imports and append:
```python
    path(
        "occurrences/<uuid:pk>/pickup/",
        OccurrencePickupView.as_view(),
        name="occurrence-pickup",
    ),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_occurrence_pickup_api.py -v`
Expected: PASS — all three tests.

- [ ] **Step 6: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: pick-up (self-assign) endpoint"
```

---

### Task 6: Postpone endpoint

**Files:**
- Modify: `backend/tasks/views.py` (add `OccurrencePostponeView`)
- Modify: `backend/tasks/urls.py` (add route)
- Test: `backend/tasks/tests/test_occurrence_postpone_api.py`

**Interfaces:**
- Consumes: `Occurrence`, `OccurrenceSerializer`, `get_membership`, `is_admin`.
- Produces: `POST /api/occurrences/{pk}/postpone/` — allowed for the occurrence's `assignee` OR an ADMIN → 200; sets `status=POSTPONED`. Only allowed when current status is `PENDING` or `LATE` (else 400). A member who is neither the assignee nor admin → 403. Outsider → 404.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_occurrence_postpone_api.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence

User = get_user_model()


def _setup(status=Occurrence.Status.PENDING, assignee_is_bob=True):
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    carol = User.objects.create_user(email="carol@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    Membership.objects.create(environment=env, user=carol, role="MEMBER")
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=datetime.date(2026, 7, 27),
        time=datetime.time(20, 0), assignee=bob if assignee_is_bob else None, status=status,
    )
    return env, ana, bob, carol, occ


@pytest.mark.django_db
def test_assignee_can_postpone():
    env, ana, bob, carol, occ = _setup()
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/postpone/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.POSTPONED


@pytest.mark.django_db
def test_admin_can_postpone():
    env, ana, bob, carol, occ = _setup()
    resp = auth_client(ana).post(f"/api/occurrences/{occ.id}/postpone/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.POSTPONED


@pytest.mark.django_db
def test_other_member_cannot_postpone():
    env, ana, bob, carol, occ = _setup()  # assigned to bob; carol is a plain member
    resp = auth_client(carol).post(f"/api/occurrences/{occ.id}/postpone/")
    assert resp.status_code == 403
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.PENDING


@pytest.mark.django_db
def test_cannot_postpone_done_occurrence():
    env, ana, bob, carol, occ = _setup(status=Occurrence.Status.DONE)
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/postpone/")
    assert resp.status_code == 400
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_occurrence_postpone_api.py -v`
Expected: FAIL — route not defined.

- [ ] **Step 3: Add the view to `backend/tasks/views.py`**

Append:
```python
class OccurrencePostponeView(APIView):
    def post(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        if occ.assignee_id != request.user.id and not is_admin(request.user, occ.environment):
            raise PermissionDenied("Só o responsável ou o ADM podem adiar.")
        if occ.status not in (Occurrence.Status.PENDING, Occurrence.Status.LATE):
            return Response(
                {"detail": "Só é possível adiar uma tarefa pendente ou atrasada."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        occ.status = Occurrence.Status.POSTPONED
        occ.save(update_fields=["status"])
        return Response(OccurrenceSerializer(occ).data)
```

- [ ] **Step 4: Add the route to `backend/tasks/urls.py`**

Add `OccurrencePostponeView` to the imports and append:
```python
    path(
        "occurrences/<uuid:pk>/postpone/",
        OccurrencePostponeView.as_view(),
        name="occurrence-postpone",
    ),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_occurrence_postpone_api.py -v`
Expected: PASS — all four tests.

- [ ] **Step 6: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: postpone endpoint"
```

---

### Task 7: Daily board — refresh statuses on read + POSTPONED sorts last

**Files:**
- Modify: `backend/tasks/views.py` (`OccurrenceListCreateView.get`)
- Test: `backend/tasks/tests/test_daily_board_api.py`

**Interfaces:**
- Consumes: `refresh_statuses` (Task 3), the existing `OccurrenceListCreateView` (Plan 2).
- Produces: the day view (`?date=`) now calls `refresh_statuses(environment, timezone.now())` after materialization and before querying, and orders results so **POSTPONED occurrences come last**, everything else by `time`. The week view (`?week_of=`) also calls `refresh_statuses` once but keeps its `date, time` ordering.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_daily_board_api.py`**

```python
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
    Occurrence.objects.create(
        environment=env, title="Louça", date=today, time=datetime.time(0, 1)
    )
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={today.isoformat()}")
    assert resp.status_code == 200
    statuses = {o["title"]: o["status"] for o in resp.data}
    assert statuses["Louça"] == "LATE"


@pytest.mark.django_db
def test_postponed_sorts_last(env):
    ana = env.created_by
    today = timezone.localtime(timezone.now()).date()
    Occurrence.objects.create(
        environment=env, title="Adiada", date=today, time=datetime.time(6, 0),
        status=Occurrence.Status.POSTPONED,
    )
    Occurrence.objects.create(
        environment=env, title="Depois", date=today, time=datetime.time(23, 0),
    )
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={today.isoformat()}")
    titles = [o["title"] for o in resp.data]
    assert titles[-1] == "Adiada"  # postponed goes last despite its earlier time
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_daily_board_api.py -v`
Expected: FAIL — overdue task is still PENDING / postponed is not sorted last.

- [ ] **Step 3: Update `OccurrenceListCreateView.get` in `backend/tasks/views.py`**

Add imports (extend existing):
```python
from django.db.models import Case, IntegerField, Value, When

from tasks.services import ensure_occurrences_for, ensure_occurrences_for_range, refresh_statuses
```
Replace the body of `OccurrenceListCreateView.get` with:
```python
    def get(self, request, env_id):
        environment = self.get_environment()
        week_of = request.query_params.get("week_of")
        if week_of:
            anchor = _parse_date(week_of)
            monday = anchor - datetime.timedelta(days=anchor.weekday())
            sunday = monday + datetime.timedelta(days=6)
            ensure_occurrences_for_range(environment, monday, sunday)
            refresh_statuses(environment)
            qs = environment.occurrences.filter(
                date__gte=monday, date__lte=sunday, is_cancelled=False
            ).order_by("date", "time")
        else:
            day = _parse_date(request.query_params.get("date"))
            ensure_occurrences_for(environment, day)
            refresh_statuses(environment)
            qs = (
                environment.occurrences.filter(date=day, is_cancelled=False)
                .annotate(
                    _postponed_last=Case(
                        When(status=Occurrence.Status.POSTPONED, then=Value(1)),
                        default=Value(0),
                        output_field=IntegerField(),
                    )
                )
                .order_by("_postponed_last", "time")
            )
        return Response(OccurrenceSerializer(qs, many=True).data)
```
(The existing `from tasks.services import ensure_occurrences_for, ensure_occurrences_for_range` import line is replaced by the combined import above; remove the old one to avoid a duplicate. Ensure `Occurrence` is imported in `views.py` — it is used by the annotation; if it is not already imported, add `from tasks.models import Occurrence`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_daily_board_api.py -v`
Expected: PASS — both tests.

- [ ] **Step 5: Run the occurrence-listing regression test from Plan 2**

Run: `cd backend && pytest tasks/tests/test_occurrence_list_api.py -v`
Expected: PASS — the Plan 2 listing tests still pass (materialization + cancelled-hidden + 400 + week view).

- [ ] **Step 6: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: daily board refreshes statuses on read and sorts postponed last"
```

---

### Task 8: `refresh_statuses` management command

**Files:**
- Create: `backend/tasks/management/commands/refresh_statuses.py`
- Test: `backend/tasks/tests/test_refresh_statuses_command.py`

**Interfaces:**
- Consumes: `refresh_statuses` (Task 3), `Environment`.
- Produces: a management command `refresh_statuses` that runs `refresh_statuses(env)` for every environment at the current time and prints a one-line summary. (Celery Beat wires this in Plan 5.)

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_refresh_statuses_command.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from environments.models import Environment
from tasks.models import Occurrence

User = get_user_model()


@pytest.mark.django_db
def test_command_marks_yesterday_pending_as_missed():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    yesterday = datetime.date(2020, 1, 1)  # safely in the past for any timezone
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=yesterday, time=datetime.time(20, 0)
    )
    call_command("refresh_statuses")
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.MISSED
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_refresh_statuses_command.py -v`
Expected: FAIL — Unknown command `refresh_statuses`.

- [ ] **Step 3: Create `backend/tasks/management/commands/refresh_statuses.py`**

```python
from django.core.management.base import BaseCommand

from environments.models import Environment
from tasks.services import refresh_statuses


class Command(BaseCommand):
    help = "Apply time-based status transitions (LATE/MISSED) across all environments."

    def handle(self, *args, **options):
        total = 0
        for env in Environment.objects.all():
            total += refresh_statuses(env)
        self.stdout.write(f"Updated {total} occurrence status(es).")
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_refresh_statuses_command.py -v`
Expected: PASS.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `cd backend && pytest -v`
Expected: PASS — every test across `accounts`, `environments`, and `tasks`, pristine (0 warnings). Then `ruff check .` — clean.

- [ ] **Step 6: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: refresh_statuses management command"
```

---

## Self-Review

**Spec coverage (against the MVP spec — daily-board / status-lifecycle portion):**
- Quadro do dia com os 5 estados → Tasks 3 (LATE/MISSED transitions), 4 (DONE), 6 (POSTPONED); PENDING is the created default. ✅
- Transições automáticas Atrasada / Não feita → Task 3 (service) + Task 8 (command) + Task 7 (on read). ✅
- Adiada não some, vai pro fim da lista → Task 6 (sets POSTPONED) + Task 7 (POSTPONED sorts last, still returned). ✅
- Feita registra quem e quando → Task 2 (fields) + Task 4 (sets completed_by/at). ✅
- Pegar tarefa aberta (self-assign) → Task 5. ✅
- Membro pode marcar qualquer tarefa como Feita → Task 4 (any active member). ✅
- Fuso horário por ambiente → Task 1; used by Task 3. ✅
- Correctly deferred to later plans: real-time broadcast + notifications/bell (next plan, the "live layer"), push + Celery Beat scheduling of `refresh_statuses`/materialization (Plan 5), RN client (Plan 6), scoring/ranking (future). Plan 3's Plan-2 carry-over — preserving DONE history on RecurringTask delete — is NOT addressed here and remains an open follow-up flagged for whoever changes that delete behavior.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step contains complete code. ✅

**Type consistency:** `refresh_statuses(environment, now_dt=None)` and `_target_status(occurrence, today, now_time)` defined in Task 3 and used in Tasks 7, 8. `Occurrence.Status.{PENDING,LATE,DONE,POSTPONED,MISSED}` used consistently. `completed_by`/`completed_at` defined in Task 2, set in Task 4, exposed by `OccurrenceSerializer`. Action endpoints all key on `pk` and reuse `get_membership`/`is_admin`/`Http404`/`http_status` already imported in `views.py` from Plan 2. `EnvironmentSerializer` gains `timezone` (Task 1) used by `refresh_statuses`. ✅

---

## Execution Handoff

This plan (Plan 3 of 6, REST-only) delivers the daily board and status lifecycle as working, testable software. The next plan is the **live layer** (Django Channels real-time broadcasts + the notification bell), followed by push (Celery + Expo) and the React Native client.
