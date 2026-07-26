# Recurring Agenda & Occurrences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the task catalog, the recurring weekly agenda (a day×hour template), and an idempotent on-demand materialization service that turns those recurring patterns into concrete per-day `Occurrence`s — including per-week exception edits (reassign / retime / skip) and member-created one-off tasks.

**Architecture:** A new Django app `tasks` with three models (`TaskDefinition`, `RecurringTask`, `Occurrence`). Recurrence is materialized on demand by a pure, idempotent service `ensure_occurrences_for(environment, date)` — no scheduler dependency (Celery Beat is added in a later plan and will simply call this same service). Per-week exceptions are edits to a specific `Occurrence` row (reassign, retime, or `is_cancelled`), which never touch the `RecurringTask` pattern. All write access to the shared agenda/catalog is ADMIN-only; members read, create one-off tasks, and (in the daily-board plan) act on occurrences. Reuses the auth, environment, and permission foundations from Plan 1.

**Tech Stack:** Python 3.14, Django 6.0, Django REST Framework 3.17, PostgreSQL, pytest.

## Global Constraints

- Python **3.14**; Django **6.0.x**; Django REST Framework **3.17.x**.
- Database: **PostgreSQL 15+** (tests included).
- All model primary keys are **UUID** (`UUIDField`, `default=uuid.uuid4`, `editable=False`).
- FKs to the user reference `settings.AUTH_USER_MODEL`; FKs across apps import the model class from `environments.models` / `tasks.models`.
- All API routes are namespaced under `/api/`.
- Reuse `environments.permissions`: `get_membership(user, environment)`, `is_admin(user, environment)`. Do not reimplement role checks.
- Permission rule (verbatim from the spec): **ADM** manages the environment structure — catalog (`TaskDefinition`), recurring agenda (`RecurringTask`), and per-week occurrence edits. **Members** may read everything and create a **one-off** occurrence (a single day, assigned to themselves, visible to all). Members may NOT create/edit the catalog or the recurring agenda.
- Materialization is an **idempotent on-demand service**; the same `(recurring_task, date)` never yields two occurrences. No Celery in this plan.
- Weekday convention: Python's `date.weekday()` — **Monday=0 … Sunday=6**. `RecurringTask.weekday` uses the same.
- Occurrence lifecycle statuses are defined now as `PENDING | LATE | DONE | POSTPONED | MISSED` (default `PENDING`); the automatic transitions (late/missed/done/postponed) belong to the daily-board plan, NOT this one. This plan only ever creates occurrences as `PENDING`.
- "Skip this week" is modeled as `Occurrence.is_cancelled = True` (a separate boolean), NOT a status — so it is orthogonal to the lifecycle and survives re-materialization.
- Run `ruff format` before each commit; `ruff check` is expected clean (generated migrations are already excluded via `pyproject.toml` per-file-ignores). Every task ends green with pristine test output and is committed. `line-length = 100`.
- Commit message bodies end with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `tasks` app scaffold + `TaskDefinition` model

**Files:**
- Create: `backend/tasks/__init__.py`, `backend/tasks/apps.py`, `backend/tasks/models.py`
- Modify: `backend/config/settings.py` (append `"tasks"` to `INSTALLED_APPS`)
- Test: `backend/tasks/tests/__init__.py`, `backend/tasks/tests/test_models.py`

**Interfaces:**
- Consumes: `environments.models.Environment` (Plan 1).
- Produces: `tasks.models.TaskDefinition` — `id` (UUID PK), `environment` (FK Environment, CASCADE, related_name `task_definitions`), `name` (CharField 120), `icon` (CharField 40, blank), `created_at` (auto). `__str__` returns `name`.

- [ ] **Step 1: Create `backend/tasks/__init__.py`** (empty) and `backend/tasks/apps.py`

```python
from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "tasks"
```

- [ ] **Step 2: Create `backend/tasks/tests/__init__.py`** (empty) and write the failing test `backend/tasks/tests/test_models.py`

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from tasks.models import TaskDefinition

User = get_user_model()


@pytest.fixture
def environment(db):
    owner = User.objects.create_user(email="ana@example.com", password="x")
    return Environment.create_with_admin(
        name="Casa", env_type=Environment.Type.HOUSE, owner=owner
    )


def test_task_definition_belongs_to_environment(environment):
    td = TaskDefinition.objects.create(environment=environment, name="Lavar louça")
    assert td.name == "Lavar louça"
    assert td.icon == ""
    assert td.environment == environment
    assert list(environment.task_definitions.all()) == [td]
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_models.py -v`
Expected: FAIL — `tasks.models` / app not installed.

- [ ] **Step 4: Create `backend/tasks/models.py`**

```python
import uuid

from django.db import models

from environments.models import Environment


class TaskDefinition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="task_definitions"
    )
    name = models.CharField(max_length=120)
    icon = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
```

- [ ] **Step 5: Register the app in `backend/config/settings.py`**

Append `"tasks"` to the end of `INSTALLED_APPS`.

- [ ] **Step 6: Create and run the migration**

Run: `cd backend && python manage.py makemigrations tasks && python manage.py migrate`
Expected: initial `tasks` migration created and applied.

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd backend && pytest tasks/tests/test_models.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: tasks app scaffold and TaskDefinition model"
```

---

### Task 2: `RecurringTask` model

**Files:**
- Modify: `backend/tasks/models.py` (add `RecurringTask`)
- Test: `backend/tasks/tests/test_recurring_task_model.py`

**Interfaces:**
- Consumes: `TaskDefinition` (Task 1), `Environment` (Plan 1), `settings.AUTH_USER_MODEL`.
- Produces: `tasks.models.RecurringTask` — `id` (UUID PK), `environment` (FK Environment, CASCADE, related_name `recurring_tasks`), `task_definition` (FK TaskDefinition, PROTECT, related_name `recurring_tasks`), `weekday` (PositiveSmallIntegerField, 0–6 Mon–Sun), `time` (TimeField), `assignee` (FK user, SET_NULL, null=True, blank=True, related_name `recurring_tasks`), `active` (BooleanField default True), `created_at`.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_recurring_task_model.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from tasks.models import RecurringTask, TaskDefinition

User = get_user_model()


@pytest.fixture
def env_and_task(db):
    owner = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(
        name="Casa", env_type=Environment.Type.HOUSE, owner=owner
    )
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_recurring_task_model.py -v`
Expected: FAIL — `RecurringTask` does not exist.

- [ ] **Step 3: Add `RecurringTask` to `backend/tasks/models.py`**

Add the import for settings at the top (below the existing imports):
```python
from django.conf import settings
```
Append the model:
```python
class RecurringTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="recurring_tasks"
    )
    task_definition = models.ForeignKey(
        TaskDefinition, on_delete=models.PROTECT, related_name="recurring_tasks"
    )
    weekday = models.PositiveSmallIntegerField()  # 0=Monday ... 6=Sunday
    time = models.TimeField()
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recurring_tasks",
    )
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.task_definition} · weekday {self.weekday} @ {self.time}"
```

- [ ] **Step 4: Create and run the migration**

Run: `cd backend && python manage.py makemigrations tasks && python manage.py migrate`
Expected: migration for `RecurringTask` created and applied.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_recurring_task_model.py -v`
Expected: PASS — both tests.

- [ ] **Step 6: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: RecurringTask model"
```

---

### Task 3: `Occurrence` model

**Files:**
- Modify: `backend/tasks/models.py` (add `Occurrence`)
- Test: `backend/tasks/tests/test_occurrence_model.py`

**Interfaces:**
- Consumes: `RecurringTask`, `TaskDefinition`, `Environment`, `settings.AUTH_USER_MODEL`.
- Produces: `tasks.models.Occurrence` with nested `Status` choices `PENDING|LATE|DONE|POSTPONED|MISSED`. Fields: `id` (UUID PK), `environment` (FK, CASCADE, related_name `occurrences`), `recurring_task` (FK RecurringTask, CASCADE, null=True, blank=True, related_name `occurrences`), `task_definition` (FK TaskDefinition, PROTECT, null=True, blank=True, related_name `occurrences`), `title` (CharField 120), `date` (DateField), `time` (TimeField null=True blank=True), `assignee` (FK user, SET_NULL, null=True, blank=True, related_name `occurrences`), `status` (CharField, choices, default PENDING), `is_cancelled` (BooleanField default False), `is_one_off` (BooleanField default False), `created_by` (FK user, SET_NULL, null=True, blank=True, related_name `created_occurrences`), `created_at`. `Meta.constraints`: a `UniqueConstraint(fields=["recurring_task", "date"], name="uniq_recurring_occurrence_per_date")`.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_occurrence_model.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from environments.models import Environment
from tasks.models import Occurrence, RecurringTask, TaskDefinition

User = get_user_model()


@pytest.fixture
def env_task_recurring(db):
    owner = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(
        name="Casa", env_type=Environment.Type.HOUSE, owner=owner
    )
    td = TaskDefinition.objects.create(environment=env, name="Lavar louça")
    rt = RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=0, time=datetime.time(20, 0)
    )
    return env, td, rt


def test_occurrence_defaults(env_task_recurring):
    env, td, rt = env_task_recurring
    occ = Occurrence.objects.create(
        environment=env,
        recurring_task=rt,
        task_definition=td,
        title="Lavar louça",
        date=datetime.date(2026, 7, 27),
        time=datetime.time(20, 0),
    )
    assert occ.status == Occurrence.Status.PENDING
    assert occ.is_cancelled is False
    assert occ.is_one_off is False
    assert occ.assignee is None


def test_recurring_occurrence_is_unique_per_date(env_task_recurring):
    env, td, rt = env_task_recurring
    Occurrence.objects.create(
        environment=env, recurring_task=rt, title="Lavar louça",
        date=datetime.date(2026, 7, 27),
    )
    with pytest.raises(IntegrityError):
        Occurrence.objects.create(
            environment=env, recurring_task=rt, title="Lavar louça",
            date=datetime.date(2026, 7, 27),
        )


def test_multiple_one_off_occurrences_allowed_same_date(env_task_recurring):
    env, td, rt = env_task_recurring
    o1 = Occurrence.objects.create(
        environment=env, recurring_task=None, title="Regar plantas",
        date=datetime.date(2026, 7, 27), is_one_off=True,
    )
    o2 = Occurrence.objects.create(
        environment=env, recurring_task=None, title="Passear com o cão",
        date=datetime.date(2026, 7, 27), is_one_off=True,
    )
    assert o1.pk != o2.pk  # NULL recurring_task rows are not constrained
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_occurrence_model.py -v`
Expected: FAIL — `Occurrence` does not exist.

- [ ] **Step 3: Add `Occurrence` to `backend/tasks/models.py`**

Append:
```python
class Occurrence(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        LATE = "LATE", "Atrasada"
        DONE = "DONE", "Feita"
        POSTPONED = "POSTPONED", "Adiada"
        MISSED = "MISSED", "Não feita"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="occurrences"
    )
    recurring_task = models.ForeignKey(
        RecurringTask,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="occurrences",
    )
    task_definition = models.ForeignKey(
        TaskDefinition,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="occurrences",
    )
    title = models.CharField(max_length=120)
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="occurrences",
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    is_cancelled = models.BooleanField(default=False)
    is_one_off = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_occurrences",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recurring_task", "date"],
                name="uniq_recurring_occurrence_per_date",
            )
        ]

    def __str__(self):
        return f"{self.title} @ {self.date}"
```

- [ ] **Step 4: Create and run the migration**

Run: `cd backend && python manage.py makemigrations tasks && python manage.py migrate`
Expected: migration for `Occurrence` created and applied.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_occurrence_model.py -v`
Expected: PASS — all three tests. (Postgres treats NULL `recurring_task` values as distinct, so the one-off test passes while the recurring uniqueness holds.)

- [ ] **Step 6: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: Occurrence model with per-date uniqueness for recurring tasks"
```

---

### Task 4: Recommended-task presets + presets endpoint

**Files:**
- Create: `backend/tasks/presets.py`
- Create: `backend/tasks/views.py`
- Create: `backend/tasks/urls.py`
- Modify: `backend/config/urls.py` (add `path("api/", include("tasks.urls"))`)
- Test: `backend/tasks/tests/test_presets_api.py`

**Interfaces:**
- Consumes: `Environment` (Plan 1), `environments.permissions.get_membership`.
- Produces:
  - `tasks.presets.RECOMMENDED_TASKS` — a dict keyed by `Environment.Type` value → list of `{"name": str, "icon": str}`.
  - `tasks.presets.get_recommended_tasks(env_type)` → list of dicts (empty list if the type is unknown).
  - `GET /api/environments/{env_id}/task-presets/` — active member only → 200 JSON list of `{name, icon}` for that environment's `env_type`. Non-member → 404.
  - `tasks.views.EnvironmentScopedView` — a base `APIView` with `get_environment()` (404 for non-members) and `require_admin(env)` helpers, reused by later tasks.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_presets_api.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client

User = get_user_model()


@pytest.mark.django_db
def test_member_gets_presets_for_house():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    resp = auth_client(ana).get(f"/api/environments/{env.id}/task-presets/")
    assert resp.status_code == 200
    names = [item["name"] for item in resp.data]
    assert "Lavar louça" in names
    assert all(set(item.keys()) == {"name", "icon"} for item in resp.data)


@pytest.mark.django_db
def test_outsider_cannot_read_presets():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    out = User.objects.create_user(email="out@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    resp = auth_client(out).get(f"/api/environments/{env.id}/task-presets/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_office_presets_differ_from_house():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    house = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    office = Environment.create_with_admin(name="Sala", env_type="OFFICE", owner=ana)
    house_names = {i["name"] for i in auth_client(ana).get(
        f"/api/environments/{house.id}/task-presets/").data}
    office_names = {i["name"] for i in auth_client(ana).get(
        f"/api/environments/{office.id}/task-presets/").data}
    assert house_names != office_names
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_presets_api.py -v`
Expected: FAIL — route not defined.

- [ ] **Step 3: Create `backend/tasks/presets.py`**

```python
from environments.models import Environment

RECOMMENDED_TASKS = {
    Environment.Type.HOUSE: [
        {"name": "Lavar louça", "icon": "dishes"},
        {"name": "Tirar o lixo", "icon": "trash"},
        {"name": "Limpar o banheiro", "icon": "bathroom"},
        {"name": "Varrer a casa", "icon": "broom"},
        {"name": "Arrumar o quarto", "icon": "bed"},
        {"name": "Lavar roupa", "icon": "laundry"},
        {"name": "Passar pano no chão", "icon": "mop"},
        {"name": "Cozinhar", "icon": "cooking"},
    ],
    Environment.Type.OFFICE: [
        {"name": "Organizar a mesa", "icon": "desk"},
        {"name": "Limpar a copa", "icon": "kitchen"},
        {"name": "Repor material", "icon": "supplies"},
        {"name": "Tirar o lixo", "icon": "trash"},
        {"name": "Regar as plantas", "icon": "plant"},
    ],
    Environment.Type.WORK: [
        {"name": "Limpar a bancada", "icon": "counter"},
        {"name": "Organizar ferramentas", "icon": "tools"},
        {"name": "Tirar o lixo", "icon": "trash"},
        {"name": "Repor estoque", "icon": "stock"},
    ],
    Environment.Type.OTHER: [
        {"name": "Tarefa geral", "icon": "task"},
    ],
}


def get_recommended_tasks(env_type):
    return RECOMMENDED_TASKS.get(env_type, [])
```

- [ ] **Step 4: Create `backend/tasks/views.py`**

```python
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from environments.models import Environment
from environments.permissions import get_membership, is_admin
from tasks.presets import get_recommended_tasks


class EnvironmentScopedView(APIView):
    """Base view that resolves an environment from the URL and enforces membership."""

    def get_environment(self):
        env = get_object_or_404(Environment, pk=self.kwargs["env_id"])
        if get_membership(self.request.user, env) is None:
            # Hide existence from non-members.
            from django.http import Http404

            raise Http404
        return env

    def require_admin(self, environment):
        if not is_admin(self.request.user, environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")


class TaskPresetsView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        return Response(get_recommended_tasks(environment.env_type))
```

- [ ] **Step 5: Create `backend/tasks/urls.py`**

```python
from django.urls import path

from tasks.views import TaskPresetsView

urlpatterns = [
    path(
        "environments/<uuid:env_id>/task-presets/",
        TaskPresetsView.as_view(),
        name="task-presets",
    ),
]
```

- [ ] **Step 6: Wire into `backend/config/urls.py`**

Add to `urlpatterns` (after the existing `environments` include):
```python
    path("api/", include("tasks.urls")),
```
(The `include` import is already present from Plan 1.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_presets_api.py -v`
Expected: PASS — all three tests.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: recommended task presets and presets endpoint"
```

---

### Task 5: TaskDefinition catalog API (member reads, ADMIN writes)

**Files:**
- Create: `backend/tasks/serializers.py`
- Modify: `backend/tasks/views.py` (add catalog views)
- Modify: `backend/tasks/urls.py` (add catalog routes)
- Test: `backend/tasks/tests/test_task_definition_api.py`

**Interfaces:**
- Consumes: `TaskDefinition` (Task 1), `EnvironmentScopedView` (Task 4).
- Produces:
  - `tasks.serializers.TaskDefinitionSerializer` — fields `["id", "name", "icon"]`, `id` read-only.
  - `GET /api/environments/{env_id}/task-definitions/` — member → 200 list of the environment's task definitions.
  - `POST /api/environments/{env_id}/task-definitions/` — ADMIN only, body `{name, icon?}` → 201; creates a `TaskDefinition` in that environment. Non-admin member → 403.
  - `DELETE /api/task-definitions/{pk}/` — ADMIN only → 204. Member/outsider → 403/404.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_task_definition_api.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import TaskDefinition

User = get_user_model()


def _env_with_member():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    return env, ana, bob


@pytest.mark.django_db
def test_admin_can_create_task_definition():
    env, ana, bob = _env_with_member()
    resp = auth_client(ana).post(
        f"/api/environments/{env.id}/task-definitions/",
        {"name": "Lavar louça", "icon": "dishes"},
        format="json",
    )
    assert resp.status_code == 201
    assert TaskDefinition.objects.filter(environment=env, name="Lavar louça").exists()


@pytest.mark.django_db
def test_member_can_list_but_not_create():
    env, ana, bob = _env_with_member()
    TaskDefinition.objects.create(environment=env, name="Tirar o lixo")
    list_resp = auth_client(bob).get(f"/api/environments/{env.id}/task-definitions/")
    assert list_resp.status_code == 200
    assert [t["name"] for t in list_resp.data] == ["Tirar o lixo"]

    create_resp = auth_client(bob).post(
        f"/api/environments/{env.id}/task-definitions/",
        {"name": "Nova"},
        format="json",
    )
    assert create_resp.status_code == 403


@pytest.mark.django_db
def test_admin_can_delete_task_definition():
    env, ana, bob = _env_with_member()
    td = TaskDefinition.objects.create(environment=env, name="Varrer")
    resp = auth_client(ana).delete(f"/api/task-definitions/{td.id}/")
    assert resp.status_code == 204
    assert not TaskDefinition.objects.filter(id=td.id).exists()


@pytest.mark.django_db
def test_member_cannot_delete_task_definition():
    env, ana, bob = _env_with_member()
    td = TaskDefinition.objects.create(environment=env, name="Varrer")
    resp = auth_client(bob).delete(f"/api/task-definitions/{td.id}/")
    assert resp.status_code == 403
    assert TaskDefinition.objects.filter(id=td.id).exists()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_task_definition_api.py -v`
Expected: FAIL — routes not defined.

- [ ] **Step 3: Create `backend/tasks/serializers.py`**

```python
from rest_framework import serializers

from tasks.models import TaskDefinition


class TaskDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskDefinition
        fields = ["id", "name", "icon"]
        read_only_fields = ["id"]
```

- [ ] **Step 4: Add catalog views to `backend/tasks/views.py`**

Add imports at the top (extend the existing import block):
```python
from rest_framework import status as http_status

from tasks.models import TaskDefinition
from tasks.serializers import TaskDefinitionSerializer
```
Append the views:
```python
class TaskDefinitionListCreateView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        tds = environment.task_definitions.all().order_by("created_at")
        return Response(TaskDefinitionSerializer(tds, many=True).data)

    def post(self, request, env_id):
        environment = self.get_environment()
        self.require_admin(environment)
        serializer = TaskDefinitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(environment=environment)
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)


class TaskDefinitionDetailView(APIView):
    def delete(self, request, pk):
        td = get_object_or_404(TaskDefinition, pk=pk)
        if get_membership(request.user, td.environment) is None:
            raise Http404
        if not is_admin(request.user, td.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        td.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)
```
Also add `from django.http import Http404` to the top-level imports (remove the inline import inside `get_environment` and use the module-level one).

- [ ] **Step 5: Add routes to `backend/tasks/urls.py`**

Update the file:
```python
from django.urls import path

from tasks.views import (
    TaskDefinitionDetailView,
    TaskDefinitionListCreateView,
    TaskPresetsView,
)

urlpatterns = [
    path(
        "environments/<uuid:env_id>/task-presets/",
        TaskPresetsView.as_view(),
        name="task-presets",
    ),
    path(
        "environments/<uuid:env_id>/task-definitions/",
        TaskDefinitionListCreateView.as_view(),
        name="task-definition-list",
    ),
    path(
        "task-definitions/<uuid:pk>/",
        TaskDefinitionDetailView.as_view(),
        name="task-definition-detail",
    ),
]
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_task_definition_api.py -v`
Expected: PASS — all four tests.

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: task definition catalog API (member read, admin write)"
```

---

### Task 6: RecurringTask agenda API (member reads, ADMIN writes)

**Files:**
- Modify: `backend/tasks/serializers.py` (add `RecurringTaskSerializer`)
- Modify: `backend/tasks/views.py` (add agenda views)
- Modify: `backend/tasks/urls.py` (add agenda routes)
- Test: `backend/tasks/tests/test_recurring_task_api.py`

**Interfaces:**
- Consumes: `RecurringTask`, `TaskDefinition`, `EnvironmentScopedView`.
- Produces:
  - `tasks.serializers.RecurringTaskSerializer` — fields `["id", "task_definition", "weekday", "time", "assignee", "active"]`; `id` read-only. `task_definition` and `assignee` are primary-key fields. Validates `weekday` in 0–6, and that `task_definition` belongs to the same environment (via `validate` using `self.context["environment"]`).
  - `GET /api/environments/{env_id}/recurring-tasks/` — member → 200 list.
  - `POST /api/environments/{env_id}/recurring-tasks/` — ADMIN → 201.
  - `PATCH /api/recurring-tasks/{pk}/` — ADMIN → 200 (edit weekday/time/assignee/active).
  - `DELETE /api/recurring-tasks/{pk}/` — ADMIN → 204.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_recurring_task_api.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import RecurringTask, TaskDefinition

User = get_user_model()


def _setup():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    td = TaskDefinition.objects.create(environment=env, name="Lavar louça")
    return env, ana, bob, td


@pytest.mark.django_db
def test_admin_creates_recurring_task():
    env, ana, bob, td = _setup()
    resp = auth_client(ana).post(
        f"/api/environments/{env.id}/recurring-tasks/",
        {"task_definition": str(td.id), "weekday": 0, "time": "20:00", "assignee": str(ana.id)},
        format="json",
    )
    assert resp.status_code == 201
    rt = RecurringTask.objects.get(id=resp.data["id"])
    assert rt.weekday == 0 and rt.assignee_id == ana.id


@pytest.mark.django_db
def test_member_cannot_create_recurring_task():
    env, ana, bob, td = _setup()
    resp = auth_client(bob).post(
        f"/api/environments/{env.id}/recurring-tasks/",
        {"task_definition": str(td.id), "weekday": 0, "time": "20:00"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_reject_task_definition_from_other_environment():
    env, ana, bob, td = _setup()
    other = Environment.create_with_admin(name="Outra", env_type="HOUSE", owner=ana)
    foreign_td = TaskDefinition.objects.create(environment=other, name="Estranha")
    resp = auth_client(ana).post(
        f"/api/environments/{env.id}/recurring-tasks/",
        {"task_definition": str(foreign_td.id), "weekday": 1, "time": "09:00"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_admin_patches_and_deletes_recurring_task():
    env, ana, bob, td = _setup()
    rt = RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=0, time="20:00"
    )
    patch = auth_client(ana).patch(
        f"/api/recurring-tasks/{rt.id}/", {"weekday": 3}, format="json"
    )
    assert patch.status_code == 200
    rt.refresh_from_db()
    assert rt.weekday == 3

    delete = auth_client(ana).delete(f"/api/recurring-tasks/{rt.id}/")
    assert delete.status_code == 204
    assert not RecurringTask.objects.filter(id=rt.id).exists()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_recurring_task_api.py -v`
Expected: FAIL — routes not defined.

- [ ] **Step 3: Add `RecurringTaskSerializer` to `backend/tasks/serializers.py`**

Append:
```python
from tasks.models import RecurringTask


class RecurringTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringTask
        fields = ["id", "task_definition", "weekday", "time", "assignee", "active"]
        read_only_fields = ["id"]

    def validate_weekday(self, value):
        if not 0 <= value <= 6:
            raise serializers.ValidationError("weekday deve estar entre 0 e 6.")
        return value

    def validate(self, attrs):
        environment = self.context["environment"]
        task_definition = attrs.get("task_definition")
        if task_definition is not None and task_definition.environment_id != environment.id:
            raise serializers.ValidationError(
                {"task_definition": "A tarefa não pertence a este ambiente."}
            )
        return attrs
```

- [ ] **Step 4: Add agenda views to `backend/tasks/views.py`**

Add imports (extend existing):
```python
from tasks.models import RecurringTask
from tasks.serializers import RecurringTaskSerializer
```
Append the views:
```python
class RecurringTaskListCreateView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        rts = environment.recurring_tasks.all().order_by("weekday", "time")
        return Response(RecurringTaskSerializer(rts, many=True).data)

    def post(self, request, env_id):
        environment = self.get_environment()
        self.require_admin(environment)
        serializer = RecurringTaskSerializer(
            data=request.data, context={"environment": environment}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(environment=environment)
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)


class RecurringTaskDetailView(APIView):
    def _get_object(self, request, pk):
        rt = get_object_or_404(RecurringTask, pk=pk)
        if get_membership(request.user, rt.environment) is None:
            raise Http404
        return rt

    def patch(self, request, pk):
        rt = self._get_object(request, pk)
        if not is_admin(request.user, rt.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        serializer = RecurringTaskSerializer(
            rt, data=request.data, partial=True, context={"environment": rt.environment}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        rt = self._get_object(request, pk)
        if not is_admin(request.user, rt.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        rt.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 5: Add routes to `backend/tasks/urls.py`**

Add the imports `RecurringTaskListCreateView`, `RecurringTaskDetailView` to the import block, and append to `urlpatterns`:
```python
    path(
        "environments/<uuid:env_id>/recurring-tasks/",
        RecurringTaskListCreateView.as_view(),
        name="recurring-task-list",
    ),
    path(
        "recurring-tasks/<uuid:pk>/",
        RecurringTaskDetailView.as_view(),
        name="recurring-task-detail",
    ),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_recurring_task_api.py -v`
Expected: PASS — all four tests.

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: recurring task agenda API (member read, admin write)"
```

---

### Task 7: Idempotent materialization service

**Files:**
- Create: `backend/tasks/services.py`
- Test: `backend/tasks/tests/test_materialization.py`

**Interfaces:**
- Consumes: `RecurringTask`, `Occurrence`.
- Produces:
  - `tasks.services.ensure_occurrences_for(environment, date)` → returns the list of `Occurrence`s that exist for that `date` after ensuring materialization. For every **active** `RecurringTask` in `environment` whose `weekday == date.weekday()`, it `get_or_create`s an `Occurrence` (keyed on `recurring_task` + `date`) with `time`, `assignee`, `task_definition`, `title = task_definition.name`, copied from the pattern. Idempotent: calling twice creates no duplicates. It does NOT recreate an occurrence the caller has cancelled (the row still exists, so `get_or_create` finds it).
  - `tasks.services.ensure_occurrences_for_range(environment, start_date, end_date)` → calls `ensure_occurrences_for` for each date in `[start_date, end_date]` inclusive; returns the total count created.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_materialization.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from tasks.models import Occurrence, RecurringTask, TaskDefinition
from tasks.services import ensure_occurrences_for, ensure_occurrences_for_range

User = get_user_model()

MONDAY = datetime.date(2026, 7, 27)  # a Monday (weekday()==0)
TUESDAY = datetime.date(2026, 7, 28)


@pytest.fixture
def env(db):
    owner = User.objects.create_user(email="ana@example.com", password="x")
    return Environment.create_with_admin(
        name="Casa", env_type=Environment.Type.HOUSE, owner=owner
    )


def _recurring(env, weekday, name="Lavar louça", active=True, assignee=None):
    td = TaskDefinition.objects.create(environment=env, name=name)
    return RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=weekday,
        time=datetime.time(20, 0), active=active, assignee=assignee,
    )


def test_materializes_matching_weekday_only(env):
    _recurring(env, weekday=0, name="Louça")       # Monday
    _recurring(env, weekday=1, name="Lixo")        # Tuesday
    result = ensure_occurrences_for(env, MONDAY)
    assert len(result) == 1
    assert result[0].title == "Louça"
    assert result[0].date == MONDAY
    assert result[0].time == datetime.time(20, 0)


def test_is_idempotent(env):
    _recurring(env, weekday=0)
    ensure_occurrences_for(env, MONDAY)
    ensure_occurrences_for(env, MONDAY)
    assert Occurrence.objects.filter(environment=env, date=MONDAY).count() == 1


def test_inactive_recurring_task_not_materialized(env):
    _recurring(env, weekday=0, active=False)
    result = ensure_occurrences_for(env, MONDAY)
    assert result == []


def test_copies_assignee(env):
    owner = env.created_by
    _recurring(env, weekday=0, assignee=owner)
    occ = ensure_occurrences_for(env, MONDAY)[0]
    assert occ.assignee_id == owner.id


def test_cancelled_occurrence_is_not_recreated(env):
    rt = _recurring(env, weekday=0)
    occ = ensure_occurrences_for(env, MONDAY)[0]
    occ.is_cancelled = True
    occ.save(update_fields=["is_cancelled"])
    # Re-materialize: the cancelled row must survive, not be replaced.
    again = ensure_occurrences_for(env, MONDAY)
    assert len(again) == 1
    assert again[0].id == occ.id
    assert again[0].is_cancelled is True
    assert Occurrence.objects.filter(recurring_task=rt, date=MONDAY).count() == 1


def test_range_creates_for_each_matching_day(env):
    _recurring(env, weekday=0, name="Louça")  # Monday
    _recurring(env, weekday=1, name="Lixo")   # Tuesday
    created = ensure_occurrences_for_range(env, MONDAY, TUESDAY)
    assert created == 2
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_materialization.py -v`
Expected: FAIL — `tasks.services` does not exist.

- [ ] **Step 3: Create `backend/tasks/services.py`**

```python
import datetime

from tasks.models import Occurrence


def ensure_occurrences_for(environment, date):
    """Idempotently materialize occurrences for `date` from active recurring tasks.

    Returns every Occurrence tied to a recurring task for that date (created or
    pre-existing). Cancelled rows are preserved, not recreated.
    """
    recurring = environment.recurring_tasks.filter(
        active=True, weekday=date.weekday()
    ).select_related("task_definition")

    occurrences = []
    for rt in recurring:
        occ, _ = Occurrence.objects.get_or_create(
            recurring_task=rt,
            date=date,
            defaults={
                "environment": environment,
                "task_definition": rt.task_definition,
                "title": rt.task_definition.name,
                "time": rt.time,
                "assignee": rt.assignee,
            },
        )
        occurrences.append(occ)
    return occurrences


def ensure_occurrences_for_range(environment, start_date, end_date):
    """Materialize each date in [start_date, end_date] inclusive. Returns count created."""
    created = 0
    day = start_date
    while day <= end_date:
        before = Occurrence.objects.filter(environment=environment, date=day).count()
        ensure_occurrences_for(environment, day)
        after = Occurrence.objects.filter(environment=environment, date=day).count()
        created += after - before
        day += datetime.timedelta(days=1)
    return created
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_materialization.py -v`
Expected: PASS — all six tests.

- [ ] **Step 5: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: idempotent occurrence materialization service"
```

---

### Task 8: Occurrence listing API (day / week — triggers materialization)

**Files:**
- Modify: `backend/tasks/serializers.py` (add `OccurrenceSerializer`)
- Modify: `backend/tasks/views.py` (add occurrence list view)
- Modify: `backend/tasks/urls.py` (add occurrence route)
- Test: `backend/tasks/tests/test_occurrence_list_api.py`

**Interfaces:**
- Consumes: `Occurrence`, `ensure_occurrences_for` / `ensure_occurrences_for_range` (Task 7), `EnvironmentScopedView`.
- Produces:
  - `tasks.serializers.OccurrenceSerializer` — fields `["id", "title", "date", "time", "assignee", "status", "is_one_off", "is_cancelled", "recurring_task", "task_definition"]`; all read-only except where a later task sets them (this task uses it read-only).
  - `GET /api/environments/{env_id}/occurrences/?date=YYYY-MM-DD` — member → materializes that day, returns its non-cancelled occurrences ordered by `time` (nulls last). Missing/invalid `date` → 400.
  - `GET /api/environments/{env_id}/occurrences/?week_of=YYYY-MM-DD` — member → treats `week_of` as any date, materializes Monday…Sunday of that week, returns all non-cancelled occurrences in that range ordered by `date, time`.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_occurrence_list_api.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence, RecurringTask, TaskDefinition

User = get_user_model()

MONDAY = "2026-07-27"


@pytest.fixture
def env_with_recurring(db):
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=0, time=datetime.time(20, 0)
    )
    return env, ana


@pytest.mark.django_db
def test_list_by_date_materializes(env_with_recurring):
    env, ana = env_with_recurring
    assert Occurrence.objects.count() == 0
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={MONDAY}")
    assert resp.status_code == 200
    assert [o["title"] for o in resp.data] == ["Louça"]
    assert Occurrence.objects.filter(environment=env).count() == 1


@pytest.mark.django_db
def test_cancelled_occurrences_are_hidden(env_with_recurring):
    env, ana = env_with_recurring
    auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={MONDAY}")
    occ = Occurrence.objects.get()
    occ.is_cancelled = True
    occ.save(update_fields=["is_cancelled"])
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/?date={MONDAY}")
    assert resp.data == []


@pytest.mark.django_db
def test_missing_date_is_400(env_with_recurring):
    env, ana = env_with_recurring
    resp = auth_client(ana).get(f"/api/environments/{env.id}/occurrences/")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_week_view_materializes_whole_week(env_with_recurring):
    env, ana = env_with_recurring
    # week_of a Wednesday in the same week as MONDAY 2026-07-27
    resp = auth_client(ana).get(
        f"/api/environments/{env.id}/occurrences/?week_of=2026-07-29"
    )
    assert resp.status_code == 200
    assert [o["title"] for o in resp.data] == ["Louça"]  # only Monday matches
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_occurrence_list_api.py -v`
Expected: FAIL — route not defined.

- [ ] **Step 3: Add `OccurrenceSerializer` to `backend/tasks/serializers.py`**

Append:
```python
from tasks.models import Occurrence


class OccurrenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Occurrence
        fields = [
            "id", "title", "date", "time", "assignee", "status",
            "is_one_off", "is_cancelled", "recurring_task", "task_definition",
        ]
        read_only_fields = fields
```

- [ ] **Step 4: Add the occurrence list view to `backend/tasks/views.py`**

Add imports (extend existing):
```python
import datetime

from rest_framework.exceptions import ValidationError

from tasks.models import Occurrence
from tasks.serializers import OccurrenceSerializer
from tasks.services import ensure_occurrences_for, ensure_occurrences_for_range
```
Append the view:
```python
def _parse_date(value):
    if not value:
        raise ValidationError({"date": "Parâmetro obrigatório (YYYY-MM-DD)."})
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise ValidationError({"date": "Data inválida (use YYYY-MM-DD)."})


class OccurrenceListCreateView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        week_of = request.query_params.get("week_of")
        if week_of:
            anchor = _parse_date(week_of)
            monday = anchor - datetime.timedelta(days=anchor.weekday())
            sunday = monday + datetime.timedelta(days=6)
            ensure_occurrences_for_range(environment, monday, sunday)
            qs = environment.occurrences.filter(
                date__gte=monday, date__lte=sunday, is_cancelled=False
            ).order_by("date", "time")
        else:
            day = _parse_date(request.query_params.get("date"))
            ensure_occurrences_for(environment, day)
            qs = environment.occurrences.filter(
                date=day, is_cancelled=False
            ).order_by("time")
        return Response(OccurrenceSerializer(qs, many=True).data)
```

- [ ] **Step 5: Add the route to `backend/tasks/urls.py`**

Add `OccurrenceListCreateView` to the import block and append to `urlpatterns`:
```python
    path(
        "environments/<uuid:env_id>/occurrences/",
        OccurrenceListCreateView.as_view(),
        name="occurrence-list",
    ),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_occurrence_list_api.py -v`
Expected: PASS — all four tests.

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: occurrence listing API with on-demand materialization"
```

---

### Task 9: Per-week occurrence exceptions (reassign / retime / skip) — ADMIN

**Files:**
- Modify: `backend/tasks/serializers.py` (add `OccurrenceEditSerializer`)
- Modify: `backend/tasks/views.py` (add occurrence detail + cancel views)
- Modify: `backend/tasks/urls.py` (add routes)
- Test: `backend/tasks/tests/test_occurrence_exception_api.py`

**Interfaces:**
- Consumes: `Occurrence`, permission helpers.
- Produces:
  - `tasks.serializers.OccurrenceEditSerializer` — writable fields `["assignee", "time"]` only (`ModelSerializer` on `Occurrence`).
  - `PATCH /api/occurrences/{pk}/` — ADMIN → 200; edits `assignee` and/or `time` of that single occurrence (a per-week exception that does NOT touch the `RecurringTask`). Member → 403.
  - `POST /api/occurrences/{pk}/cancel/` — ADMIN → 200 `{"is_cancelled": true}`; sets `is_cancelled=True` ("skip this week"). Member → 403.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_occurrence_exception_api.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence, RecurringTask, TaskDefinition

User = get_user_model()

MONDAY = datetime.date(2026, 7, 27)


def _setup_occurrence():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    rt = RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=0, time=datetime.time(20, 0)
    )
    occ = Occurrence.objects.create(
        environment=env, recurring_task=rt, task_definition=td,
        title="Louça", date=MONDAY, time=datetime.time(20, 0),
    )
    return env, ana, bob, rt, occ


@pytest.mark.django_db
def test_admin_reassigns_single_occurrence_without_touching_pattern():
    env, ana, bob, rt, occ = _setup_occurrence()
    resp = auth_client(ana).patch(
        f"/api/occurrences/{occ.id}/",
        {"assignee": str(bob.id), "time": "21:30"},
        format="json",
    )
    assert resp.status_code == 200
    occ.refresh_from_db()
    rt.refresh_from_db()
    assert occ.assignee_id == bob.id and occ.time == datetime.time(21, 30)
    assert rt.assignee is None and rt.time == datetime.time(20, 0)  # pattern untouched


@pytest.mark.django_db
def test_member_cannot_edit_occurrence():
    env, ana, bob, rt, occ = _setup_occurrence()
    resp = auth_client(bob).patch(
        f"/api/occurrences/{occ.id}/", {"time": "22:00"}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_admin_cancels_occurrence():
    env, ana, bob, rt, occ = _setup_occurrence()
    resp = auth_client(ana).post(f"/api/occurrences/{occ.id}/cancel/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.is_cancelled is True


@pytest.mark.django_db
def test_member_cannot_cancel_occurrence():
    env, ana, bob, rt, occ = _setup_occurrence()
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/cancel/")
    assert resp.status_code == 403
    occ.refresh_from_db()
    assert occ.is_cancelled is False
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_occurrence_exception_api.py -v`
Expected: FAIL — routes not defined.

- [ ] **Step 3: Add `OccurrenceEditSerializer` to `backend/tasks/serializers.py`**

Append:
```python
class OccurrenceEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Occurrence
        fields = ["assignee", "time"]
```

- [ ] **Step 4: Add the views to `backend/tasks/views.py`**

Add import (extend existing):
```python
from tasks.serializers import OccurrenceEditSerializer
```
Append:
```python
class OccurrenceDetailView(APIView):
    def _get_object(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        return occ

    def patch(self, request, pk):
        occ = self._get_object(request, pk)
        if not is_admin(request.user, occ.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        serializer = OccurrenceEditSerializer(occ, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(OccurrenceSerializer(occ).data)


class OccurrenceCancelView(APIView):
    def post(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        if not is_admin(request.user, occ.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        occ.is_cancelled = True
        occ.save(update_fields=["is_cancelled"])
        return Response({"is_cancelled": True})
```

- [ ] **Step 5: Add routes to `backend/tasks/urls.py`**

Add `OccurrenceDetailView`, `OccurrenceCancelView` to the imports and append:
```python
    path(
        "occurrences/<uuid:pk>/",
        OccurrenceDetailView.as_view(),
        name="occurrence-detail",
    ),
    path(
        "occurrences/<uuid:pk>/cancel/",
        OccurrenceCancelView.as_view(),
        name="occurrence-cancel",
    ),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_occurrence_exception_api.py -v`
Expected: PASS — all four tests.

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: per-week occurrence exceptions (reassign, retime, skip)"
```

---

### Task 10: One-off occurrence creation (member)

**Files:**
- Modify: `backend/tasks/serializers.py` (add `OneOffOccurrenceSerializer`)
- Modify: `backend/tasks/views.py` (add `post` to `OccurrenceListCreateView`)
- Test: `backend/tasks/tests/test_one_off_occurrence_api.py`

**Interfaces:**
- Consumes: `Occurrence`, `EnvironmentScopedView`.
- Produces:
  - `tasks.serializers.OneOffOccurrenceSerializer` — writable fields `["title", "date", "time", "task_definition"]` (`title` required, `time`/`task_definition` optional). Validates `task_definition` (if given) belongs to the environment.
  - `POST /api/environments/{env_id}/occurrences/` — any active **member** → 201; creates an `Occurrence` with `is_one_off=True`, `created_by=request.user`, `assignee=request.user`, `recurring_task=None`, `status=PENDING`, visible to all. Outsider → 404.

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_one_off_occurrence_api.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence

User = get_user_model()


def _env_with_member():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    return env, ana, bob


@pytest.mark.django_db
def test_member_creates_one_off_assigned_to_self():
    env, ana, bob = _env_with_member()
    resp = auth_client(bob).post(
        f"/api/environments/{env.id}/occurrences/",
        {"title": "Regar plantas", "date": "2026-07-27", "time": "18:00"},
        format="json",
    )
    assert resp.status_code == 201
    occ = Occurrence.objects.get(id=resp.data["id"])
    assert occ.is_one_off is True
    assert occ.created_by_id == bob.id
    assert occ.assignee_id == bob.id
    assert occ.recurring_task_id is None
    assert occ.status == Occurrence.Status.PENDING


@pytest.mark.django_db
def test_one_off_visible_to_all_members():
    env, ana, bob = _env_with_member()
    auth_client(bob).post(
        f"/api/environments/{env.id}/occurrences/",
        {"title": "Regar plantas", "date": "2026-07-27"},
        format="json",
    )
    resp = auth_client(ana).get(
        f"/api/environments/{env.id}/occurrences/?date=2026-07-27"
    )
    assert [o["title"] for o in resp.data] == ["Regar plantas"]


@pytest.mark.django_db
def test_outsider_cannot_create_one_off():
    env, ana, bob = _env_with_member()
    out = User.objects.create_user(email="out@example.com", password="x")
    resp = auth_client(out).post(
        f"/api/environments/{env.id}/occurrences/",
        {"title": "Xereta", "date": "2026-07-27"},
        format="json",
    )
    assert resp.status_code == 404
    assert not Occurrence.objects.filter(title="Xereta").exists()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_one_off_occurrence_api.py -v`
Expected: FAIL — POST not implemented (405 or similar).

- [ ] **Step 3: Add `OneOffOccurrenceSerializer` to `backend/tasks/serializers.py`**

Append:
```python
class OneOffOccurrenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Occurrence
        fields = ["id", "title", "date", "time", "task_definition"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        environment = self.context["environment"]
        td = attrs.get("task_definition")
        if td is not None and td.environment_id != environment.id:
            raise serializers.ValidationError(
                {"task_definition": "A tarefa não pertence a este ambiente."}
            )
        return attrs
```

- [ ] **Step 4: Add `post` to `OccurrenceListCreateView` in `backend/tasks/views.py`**

Add import (extend existing):
```python
from tasks.serializers import OneOffOccurrenceSerializer
```
Add this method to the existing `OccurrenceListCreateView` class (alongside `get`):
```python
    def post(self, request, env_id):
        environment = self.get_environment()  # 404 for non-members
        serializer = OneOffOccurrenceSerializer(
            data=request.data, context={"environment": environment}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(
            environment=environment,
            is_one_off=True,
            created_by=request.user,
            assignee=request.user,
        )
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_one_off_occurrence_api.py -v`
Expected: PASS — all three tests.

- [ ] **Step 6: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: member-created one-off occurrences"
```

---

### Task 11: Management command for materialization

**Files:**
- Create: `backend/tasks/management/__init__.py`, `backend/tasks/management/commands/__init__.py`, `backend/tasks/management/commands/materialize_occurrences.py`
- Test: `backend/tasks/tests/test_materialize_command.py`

**Interfaces:**
- Consumes: `ensure_occurrences_for_range` (Task 7), `Environment`.
- Produces: a management command `materialize_occurrences` that materializes the next `--days` (default 14) days for every environment, starting from `timezone.localdate()`. Writes a one-line summary per run to stdout. (A later plan wires this into Celery Beat; for now it is runnable by hand or cron.)

- [ ] **Step 1: Write the failing test `backend/tasks/tests/test_materialize_command.py`**

```python
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from environments.models import Environment
from tasks.models import Occurrence, TaskDefinition, RecurringTask

User = get_user_model()


@pytest.mark.django_db
def test_command_materializes_upcoming_days():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    td = TaskDefinition.objects.create(environment=env, name="Louça")
    today = timezone.localdate()
    RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=today.weekday(),
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
        environment=env, task_definition=td, weekday=today.weekday(),
        time=datetime.time(20, 0),
    )
    call_command("materialize_occurrences", "--days", "7")
    call_command("materialize_occurrences", "--days", "7")
    assert Occurrence.objects.filter(environment=env, date=today).count() == 1
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tasks/tests/test_materialize_command.py -v`
Expected: FAIL — Unknown command `materialize_occurrences`.

- [ ] **Step 3: Create the package files**

Create empty `backend/tasks/management/__init__.py` and `backend/tasks/management/commands/__init__.py`.

- [ ] **Step 4: Create `backend/tasks/management/commands/materialize_occurrences.py`**

```python
import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from environments.models import Environment
from tasks.services import ensure_occurrences_for_range


class Command(BaseCommand):
    help = "Materialize occurrences for the next N days across all environments."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=14)

    def handle(self, *args, **options):
        days = options["days"]
        start = timezone.localdate()
        end = start + datetime.timedelta(days=days - 1)
        total = 0
        for env in Environment.objects.all():
            total += ensure_occurrences_for_range(env, start, end)
        self.stdout.write(
            f"Materialized {total} occurrence(s) from {start} to {end}."
        )
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest tasks/tests/test_materialize_command.py -v`
Expected: PASS — both tests.

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `cd backend && pytest -v`
Expected: PASS — every test across `accounts`, `environments`, and `tasks`, pristine (0 warnings). Then `ruff check .` — clean.

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: materialize_occurrences management command"
```

---

## Self-Review

**Spec coverage (against the MVP spec — recurring-agenda portion):**
- Catálogo de tarefas (recomendadas + criadas) → Tasks 1, 4 (presets), 5 (CRUD). ✅
- Agenda semanal recorrente (grade dia×hora) → Tasks 2 (model), 6 (API). ✅
- Modelo híbrido (base recorrente + exceções por semana) → Task 3 (`is_cancelled` + per-date uniqueness), 7 (materialization preserves cancelled), 9 (reassign/retime/skip edits leave the pattern untouched). ✅
- Materialização das ocorrências → Task 7 (service), 8 (on-demand on list), 11 (command). Celery deferred to a later plan by design. ✅
- Tarefa avulsa do membro (um dia, visível a todos) → Task 10. ✅
- Permissões (ADM estrutura; membro lê + cria avulsa) → enforced in Tasks 5, 6, 9 (ADMIN) and 10 (member). ✅
- Occurrence carries the 5 lifecycle statuses for the daily-board plan → Task 3 (defined, default PENDING; transitions deferred). ✅
- Correctly deferred to later plans: status transitions/daily board (Plan 3), real-time (Plan 3), notifications (Plan 4), push + Celery Beat (Plan 5), RN client (Plan 6).

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step contains complete code. ✅

**Type consistency:** `ensure_occurrences_for(environment, date)` and `ensure_occurrences_for_range(environment, start_date, end_date)` defined in Task 7 and called identically in Tasks 8, 11. `EnvironmentScopedView.get_environment()` / `require_admin(environment)` defined in Task 4 and reused in Tasks 5, 6, 8, 10. `Occurrence.Status.PENDING`, `is_cancelled`, `is_one_off` consistent across Tasks 3, 7, 8, 9, 10. Serializers (`TaskDefinitionSerializer`, `RecurringTaskSerializer`, `OccurrenceSerializer`, `OccurrenceEditSerializer`, `OneOffOccurrenceSerializer`) each defined once and used consistently. `auth_client` imported from `environments/tests/test_environment_api.py` (Plan 1) throughout. ✅

**Note on a Plan-1 follow-up now resolved here:** `RecurringTaskSerializer.validate` and `OneOffOccurrenceSerializer.validate` enforce that a referenced `task_definition` belongs to the environment — the cross-environment leak class flagged in Plan 1's invitation review does not recur here.

---

## Execution Handoff

This plan (Plan 2 of 6) delivers the task catalog, recurring agenda, and occurrence materialization as working, testable software. Plans 3–6 (daily board + status lifecycle + real-time, notifications, push + Celery Beat, RN client) follow with their own plan documents.
