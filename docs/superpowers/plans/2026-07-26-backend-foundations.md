# Backend Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Django/DRF backend foundation — email-based accounts with JWT auth, multi-tenant environments, memberships with roles (ADM/member), and an invite/accept flow — as the base every later MVP slice builds on.

**Architecture:** A single Django project (`config`) with two apps: `accounts` (custom email user + JWT auth) and `environments` (Environment, Membership, Invitation). REST API via Django REST Framework. Business rules (permissions by role, invite acceptance) live in the backend and are covered by tests. PostgreSQL is the datastore; pytest-django is the test runner.

**Tech Stack:** Python 3.14, Django 6.0, Django REST Framework 3.17, djangorestframework-simplejwt 5.5 (JWT), psycopg 3 (Postgres driver), pytest 9 + pytest-django 4.

## Global Constraints

- Python **3.14** (matches the developer's environment; verified that the full stack installs and imports on 3.14.3).
- Django **6.0.x**; Django REST Framework **3.17.x**.
- Database: **PostgreSQL 15+**. No SQLite, even for tests (tests run against Postgres).
- Custom user model **from the first migration** — email is the login field (`USERNAME_FIELD = "email"`), there is no `username` field.
- Auth tokens: **JWT** via `djangorestframework-simplejwt`. Access + refresh tokens.
- All model primary keys are **UUID** (`UUIDField`, `default=uuid.uuid4`, `editable=False`).
- All API routes are namespaced under `/api/`.
- Every task ends green (all tests pass) and is committed.
- Line length / formatting: use `ruff` defaults; run `ruff format` before each commit.

---

### Task 1: Project scaffolding & Postgres-backed test harness

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/pytest.ini`
- Create: `backend/manage.py`
- Create: `backend/config/__init__.py`
- Create: `backend/config/settings.py`
- Create: `backend/config/urls.py`
- Create: `backend/config/wsgi.py`
- Create: `backend/config/asgi.py`
- Create: `backend/.env.example`
- Test: `backend/tests/test_smoke.py`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a runnable Django project named `config`, `pytest` wired to Django settings, a `DATABASES` config reading `DATABASE_URL` from env. Later tasks add apps to `INSTALLED_APPS`.

- [ ] **Step 1: Create `backend/requirements.txt`**

```
Django==6.0.7
djangorestframework==3.17.1
djangorestframework-simplejwt==5.5.1
psycopg[binary]==3.3.4
django-environ==0.14.0
pytest==9.1.1
pytest-django==4.12.0
ruff==0.16.0
```

- [ ] **Step 2: Create `backend/pyproject.toml`**

```toml
[tool.ruff]
line-length = 100
target-version = "py314"

[tool.ruff.lint]
select = ["E", "F", "I"]
```

- [ ] **Step 3: Create `backend/pytest.ini`**

```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings
python_files = test_*.py
addopts = -v
```

- [ ] **Step 4: Create `backend/manage.py`**

```python
#!/usr/bin/env python
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Create `backend/config/__init__.py`** (empty file)

- [ ] **Step 6: Create `backend/config/settings.py`**

```python
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="dev-insecure-key-change-me")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://postgres:postgres@localhost:5432/mytasks",
    )
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
```

- [ ] **Step 7: Create `backend/config/urls.py`**

```python
from django.contrib import admin
from django.urls import path

urlpatterns = [
    path("admin/", admin.site.urls),
]
```

- [ ] **Step 8: Create `backend/config/wsgi.py` and `backend/config/asgi.py`**

`wsgi.py`:
```python
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()
```

`asgi.py`:
```python
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_asgi_application()
```

- [ ] **Step 9: Create `backend/.env.example`**

```
SECRET_KEY=dev-insecure-key-change-me
DEBUG=True
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mytasks
ALLOWED_HOSTS=*
```

- [ ] **Step 10: Write the smoke test `backend/tests/test_smoke.py`**

```python
import pytest
from django.db import connection


@pytest.mark.django_db
def test_database_is_postgres():
    assert connection.vendor == "postgresql"
```

- [ ] **Step 11: Install deps and create the test database**

Run:
```bash
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
createdb mytasks 2>/dev/null || true
```
Expected: dependencies install without error.

- [ ] **Step 12: Run the smoke test to verify it passes**

Run: `cd backend && pytest tests/test_smoke.py -v`
Expected: PASS — `test_database_is_postgres`. (If it fails with a connection error, confirm Postgres is running and `DATABASE_URL` is correct.)

- [ ] **Step 13: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "chore: scaffold Django project with Postgres-backed pytest"
```

---

### Task 2: Custom email user model

**Files:**
- Create: `backend/accounts/__init__.py`
- Create: `backend/accounts/apps.py`
- Create: `backend/accounts/managers.py`
- Create: `backend/accounts/models.py`
- Modify: `backend/config/settings.py` (add `accounts` to `INSTALLED_APPS`, set `AUTH_USER_MODEL`)
- Test: `backend/accounts/tests/__init__.py`, `backend/accounts/tests/test_models.py`

**Interfaces:**
- Consumes: project scaffolding from Task 1.
- Produces:
  - `accounts.models.User` — fields: `id` (UUID PK), `email` (unique, `USERNAME_FIELD`), `display_name` (CharField), `is_active`, `is_staff`, `date_joined`. No `username`.
  - `accounts.managers.UserManager` with `create_user(email, password, **extra)` and `create_superuser(email, password, **extra)`.

- [ ] **Step 1: Create `backend/accounts/__init__.py`** (empty) and `backend/accounts/apps.py`

```python
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
```

- [ ] **Step 2: Create `backend/accounts/tests/__init__.py`** (empty) and write the failing test `backend/accounts/tests/test_models.py`

```python
import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
def test_create_user_with_email():
    user = User.objects.create_user(
        email="ana@example.com", password="s3cret!!", display_name="Ana"
    )
    assert user.email == "ana@example.com"
    assert user.display_name == "Ana"
    assert user.check_password("s3cret!!")
    assert user.is_active is True
    assert user.is_staff is False


@pytest.mark.django_db
def test_email_is_required():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password="x")


@pytest.mark.django_db
def test_create_superuser():
    admin = User.objects.create_superuser(
        email="root@example.com", password="s3cret!!"
    )
    assert admin.is_staff is True
    assert admin.is_superuser is True
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && pytest accounts/tests/test_models.py -v`
Expected: FAIL / ERROR — `accounts` app not installed / `User` has no `display_name`.

- [ ] **Step 4: Create `backend/accounts/managers.py`**

```python
from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(email, password, **extra_fields)
```

- [ ] **Step 5: Create `backend/accounts/models.py`**

```python
import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from accounts.managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email
```

- [ ] **Step 6: Register the app and user model in `backend/config/settings.py`**

Add `"accounts"` to the end of `INSTALLED_APPS`, and add this line after the `INSTALLED_APPS` list:
```python
AUTH_USER_MODEL = "accounts.User"
```

- [ ] **Step 7: Create and run migrations**

Run:
```bash
cd backend && python manage.py makemigrations accounts && python manage.py migrate
```
Expected: an initial `accounts` migration is created and applied without error.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd backend && pytest accounts/tests/test_models.py -v`
Expected: PASS — all three tests.

- [ ] **Step 9: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: custom email-based user model"
```

---

### Task 3: Registration & JWT auth endpoints

**Files:**
- Create: `backend/accounts/serializers.py`
- Create: `backend/accounts/views.py`
- Create: `backend/accounts/urls.py`
- Modify: `backend/config/urls.py` (include `accounts.urls` under `api/auth/`)
- Test: `backend/accounts/tests/test_auth_api.py`

**Interfaces:**
- Consumes: `accounts.models.User` (Task 2).
- Produces these endpoints:
  - `POST /api/auth/register/` — body `{email, password, display_name}` → 201 `{id, email, display_name}`.
  - `POST /api/auth/token/` — body `{email, password}` → 200 `{access, refresh}` (simplejwt `TokenObtainPairView`).
  - `POST /api/auth/token/refresh/` — body `{refresh}` → 200 `{access}`.
  - `GET /api/auth/me/` — auth required → 200 `{id, email, display_name}`.

- [ ] **Step 1: Write the failing test `backend/accounts/tests/test_auth_api.py`**

```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_register_creates_user(client):
    resp = client.post(
        "/api/auth/register/",
        {"email": "ana@example.com", "password": "s3cret!!", "display_name": "Ana"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["email"] == "ana@example.com"
    assert "password" not in resp.data
    assert User.objects.filter(email="ana@example.com").exists()


@pytest.mark.django_db
def test_register_rejects_duplicate_email(client):
    User.objects.create_user(email="ana@example.com", password="x")
    resp = client.post(
        "/api/auth/register/",
        {"email": "ana@example.com", "password": "s3cret!!"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_token_and_me(client):
    User.objects.create_user(
        email="ana@example.com", password="s3cret!!", display_name="Ana"
    )
    token_resp = client.post(
        "/api/auth/token/",
        {"email": "ana@example.com", "password": "s3cret!!"},
        format="json",
    )
    assert token_resp.status_code == 200
    access = token_resp.data["access"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    me_resp = client.get("/api/auth/me/")
    assert me_resp.status_code == 200
    assert me_resp.data["email"] == "ana@example.com"


@pytest.mark.django_db
def test_me_requires_auth(client):
    resp = client.get("/api/auth/me/")
    assert resp.status_code == 401
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest accounts/tests/test_auth_api.py -v`
Expected: FAIL — 404s (URLs not defined).

- [ ] **Step 3: Create `backend/accounts/serializers.py`**

```python
from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "display_name"]
        read_only_fields = ["id"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "password", "display_name"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
```

- [ ] **Step 4: Create `backend/accounts/views.py`**

```python
from rest_framework import generics, permissions

from accounts.serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
```

- [ ] **Step 5: Create `backend/accounts/urls.py`**

```python
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.views import MeView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
]
```

- [ ] **Step 6: Wire into `backend/config/urls.py`**

```python
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
]
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && pytest accounts/tests/test_auth_api.py -v`
Expected: PASS — all four tests.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: registration and JWT auth endpoints"
```

---

### Task 4: Environment & Membership models

**Files:**
- Create: `backend/environments/__init__.py`
- Create: `backend/environments/apps.py`
- Create: `backend/environments/models.py`
- Modify: `backend/config/settings.py` (add `environments` to `INSTALLED_APPS`)
- Test: `backend/environments/tests/__init__.py`, `backend/environments/tests/test_models.py`

**Interfaces:**
- Consumes: `AUTH_USER_MODEL` (Task 2).
- Produces:
  - `environments.models.Environment` — `id` (UUID PK), `name` (CharField), `env_type` (CharField, choices `HOUSE|OFFICE|WORK|OTHER`), `created_by` (FK User), `created_at`.
  - `environments.models.Membership` — `id` (UUID PK), `environment` (FK), `user` (FK), `role` (CharField, choices `ADMIN|MEMBER`), `status` (CharField, choices `ACTIVE`, default `ACTIVE`), `notifications_last_read_at` (DateTimeField, nullable), `created_at`. `unique_together = (environment, user)`.
  - `Environment.create_with_admin(name, env_type, owner)` classmethod → creates the Environment and an `ADMIN` Membership for `owner`, returns the Environment.

- [ ] **Step 1: Create `backend/environments/__init__.py`** (empty) and `backend/environments/apps.py`

```python
from django.apps import AppConfig


class EnvironmentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "environments"
```

- [ ] **Step 2: Create `backend/environments/tests/__init__.py`** (empty) and write the failing test `backend/environments/tests/test_models.py`

```python
import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from environments.models import Environment, Membership

User = get_user_model()


@pytest.mark.django_db
def test_create_with_admin_makes_owner_admin():
    owner = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(
        name="Casa da Ana", env_type=Environment.Type.HOUSE, owner=owner
    )
    assert env.created_by == owner
    membership = Membership.objects.get(environment=env, user=owner)
    assert membership.role == Membership.Role.ADMIN
    assert membership.status == Membership.Status.ACTIVE


@pytest.mark.django_db
def test_membership_is_unique_per_user_and_environment():
    owner = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(
        name="Casa", env_type=Environment.Type.HOUSE, owner=owner
    )
    with pytest.raises(IntegrityError):
        Membership.objects.create(
            environment=env, user=owner, role=Membership.Role.MEMBER
        )
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && pytest environments/tests/test_models.py -v`
Expected: FAIL — `environments.models` does not exist.

- [ ] **Step 4: Create `backend/environments/models.py`**

```python
import uuid

from django.conf import settings
from django.db import models, transaction


class Environment(models.Model):
    class Type(models.TextChoices):
        HOUSE = "HOUSE", "Casa"
        OFFICE = "OFFICE", "Escritório"
        WORK = "WORK", "Trabalho"
        OTHER = "OTHER", "Outro"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    env_type = models.CharField(max_length=10, choices=Type.choices, default=Type.HOUSE)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="created_environments"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    @classmethod
    def create_with_admin(cls, name, env_type, owner):
        with transaction.atomic():
            env = cls.objects.create(name=name, env_type=env_type, created_by=owner)
            Membership.objects.create(
                environment=env, user=owner, role=Membership.Role.ADMIN
            )
        return env


class Membership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "ADM"
        MEMBER = "MEMBER", "Membro"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativo"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    notifications_last_read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("environment", "user")

    def __str__(self):
        return f"{self.user} @ {self.environment} ({self.role})"
```

- [ ] **Step 5: Register the app in `backend/config/settings.py`**

Add `"environments"` to the end of `INSTALLED_APPS`.

- [ ] **Step 6: Create and run migrations**

Run:
```bash
cd backend && python manage.py makemigrations environments && python manage.py migrate
```
Expected: initial `environments` migration created and applied.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && pytest environments/tests/test_models.py -v`
Expected: PASS — both tests.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: Environment and Membership models"
```

---

### Task 5: Role-based permission helper

**Files:**
- Create: `backend/environments/permissions.py`
- Test: `backend/environments/tests/test_permissions.py`

**Interfaces:**
- Consumes: `Environment`, `Membership` (Task 4).
- Produces:
  - `environments.permissions.get_membership(user, environment)` → the active `Membership` or `None`.
  - `environments.permissions.is_admin(user, environment)` → bool.
  - `environments.permissions.IsEnvironmentMember` — a DRF permission class; object-level `has_object_permission(request, view, obj)` returns True when the user has any active membership in `obj` (an `Environment`).
  - `environments.permissions.IsEnvironmentAdmin` — DRF permission class; object-level check returns True only for `ADMIN` members of `obj`.

- [ ] **Step 1: Write the failing test `backend/environments/tests/test_permissions.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.permissions import get_membership, is_admin

User = get_user_model()


@pytest.fixture
def env_with_users(db):
    admin = User.objects.create_user(email="admin@example.com", password="x")
    member = User.objects.create_user(email="member@example.com", password="x")
    outsider = User.objects.create_user(email="out@example.com", password="x")
    env = Environment.create_with_admin(
        name="Casa", env_type=Environment.Type.HOUSE, owner=admin
    )
    Membership.objects.create(environment=env, user=member, role=Membership.Role.MEMBER)
    return env, admin, member, outsider


def test_get_membership_returns_membership_for_member(env_with_users):
    env, admin, member, outsider = env_with_users
    assert get_membership(member, env).role == Membership.Role.MEMBER


def test_get_membership_returns_none_for_outsider(env_with_users):
    env, admin, member, outsider = env_with_users
    assert get_membership(outsider, env) is None


def test_is_admin_true_only_for_admin(env_with_users):
    env, admin, member, outsider = env_with_users
    assert is_admin(admin, env) is True
    assert is_admin(member, env) is False
    assert is_admin(outsider, env) is False
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest environments/tests/test_permissions.py -v`
Expected: FAIL — `environments.permissions` does not exist.

- [ ] **Step 3: Create `backend/environments/permissions.py`**

```python
from rest_framework import permissions

from environments.models import Membership


def get_membership(user, environment):
    if not user or not user.is_authenticated:
        return None
    return Membership.objects.filter(
        environment=environment, user=user, status=Membership.Status.ACTIVE
    ).first()


def is_admin(user, environment):
    membership = get_membership(user, environment)
    return membership is not None and membership.role == Membership.Role.ADMIN


class IsEnvironmentMember(permissions.IsAuthenticated):
    def has_object_permission(self, request, view, obj):
        return get_membership(request.user, obj) is not None


class IsEnvironmentAdmin(permissions.IsAuthenticated):
    def has_object_permission(self, request, view, obj):
        return is_admin(request.user, obj)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest environments/tests/test_permissions.py -v`
Expected: PASS — all three tests.

- [ ] **Step 5: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: role-based permission helpers"
```

---

### Task 6: Environment CRUD API

**Files:**
- Create: `backend/environments/serializers.py`
- Create: `backend/environments/views.py`
- Create: `backend/environments/urls.py`
- Modify: `backend/config/urls.py` (include `environments.urls` under `api/`)
- Test: `backend/environments/tests/test_environment_api.py`

**Interfaces:**
- Consumes: `Environment.create_with_admin` (Task 4), `get_membership`/`is_admin` (Task 5).
- Produces:
  - `GET /api/environments/` — lists environments where the requester has an active membership. Response items: `{id, name, env_type, role}` (`role` = requester's role).
  - `POST /api/environments/` — body `{name, env_type}` → 201; creates env + makes requester ADMIN.
  - `GET /api/environments/{id}/` — members only → `{id, name, env_type, role}`.
  - `PATCH /api/environments/{id}/` — ADMIN only → updates `name`/`env_type`.
  - `EnvironmentSerializer` exposing `id, name, env_type, role` (role via `SerializerMethodField`).

- [ ] **Step 1: Write the failing test `backend/environments/tests/test_environment_api.py`**

```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from environments.models import Environment, Membership

User = get_user_model()


def auth_client(user):
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_create_environment_makes_requester_admin():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    client = auth_client(ana)
    resp = client.post(
        "/api/environments/",
        {"name": "Casa da Ana", "env_type": "HOUSE"},
        format="json",
    )
    assert resp.status_code == 201
    env = Environment.objects.get(id=resp.data["id"])
    assert Membership.objects.get(environment=env, user=ana).role == "ADMIN"
    assert resp.data["role"] == "ADMIN"


@pytest.mark.django_db
def test_list_only_returns_my_environments():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    Environment.create_with_admin(name="Casa da Ana", env_type="HOUSE", owner=ana)
    Environment.create_with_admin(name="Casa do Bob", env_type="HOUSE", owner=bob)

    resp = auth_client(ana).get("/api/environments/")
    assert resp.status_code == 200
    names = [e["name"] for e in resp.data]
    assert names == ["Casa da Ana"]


@pytest.mark.django_db
def test_member_cannot_patch_environment():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")

    resp = auth_client(bob).patch(
        f"/api/environments/{env.id}/", {"name": "Novo nome"}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_outsider_cannot_read_environment():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    out = User.objects.create_user(email="out@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)

    resp = auth_client(out).get(f"/api/environments/{env.id}/")
    assert resp.status_code in (403, 404)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest environments/tests/test_environment_api.py -v`
Expected: FAIL — 404s (routes not defined).

- [ ] **Step 3: Create `backend/environments/serializers.py`**

```python
from rest_framework import serializers

from environments.models import Environment
from environments.permissions import get_membership


class EnvironmentSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = Environment
        fields = ["id", "name", "env_type", "role"]
        read_only_fields = ["id", "role"]

    def get_role(self, obj):
        user = self.context["request"].user
        membership = get_membership(user, obj)
        return membership.role if membership else None
```

- [ ] **Step 4: Create `backend/environments/views.py`**

```python
from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied

from environments.models import Environment, Membership
from environments.permissions import IsEnvironmentAdmin, IsEnvironmentMember, is_admin
from environments.serializers import EnvironmentSerializer


class EnvironmentViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = EnvironmentSerializer

    def get_queryset(self):
        return Environment.objects.filter(
            memberships__user=self.request.user,
            memberships__status=Membership.Status.ACTIVE,
        ).distinct()

    def get_permissions(self):
        if self.action in ("update", "partial_update"):
            return [IsEnvironmentAdmin()]
        return [IsEnvironmentMember()]

    def perform_create(self, serializer):
        env = Environment.create_with_admin(
            name=serializer.validated_data["name"],
            env_type=serializer.validated_data["env_type"],
            owner=self.request.user,
        )
        serializer.instance = env
```

> Note: `list`/`create` do not run object-level permission, so membership scoping for the list comes from `get_queryset`. `create` is allowed for any authenticated user (`IsEnvironmentMember` extends `IsAuthenticated`; its object check does not apply to `create`).

- [ ] **Step 5: Create `backend/environments/urls.py`**

```python
from rest_framework.routers import DefaultRouter

from environments.views import EnvironmentViewSet

router = DefaultRouter()
router.register("environments", EnvironmentViewSet, basename="environment")

urlpatterns = router.urls
```

- [ ] **Step 6: Wire into `backend/config/urls.py`**

```python
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("environments.urls")),
]
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && pytest environments/tests/test_environment_api.py -v`
Expected: PASS — all four tests.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: environment CRUD API with role scoping"
```

---

### Task 7: Invitation model & invite endpoint (ADMIN sends)

**Files:**
- Modify: `backend/environments/models.py` (add `Invitation`)
- Modify: `backend/environments/serializers.py` (add `InvitationSerializer`)
- Modify: `backend/environments/views.py` (add invite action)
- Test: `backend/environments/tests/test_invitation_api.py`

**Interfaces:**
- Consumes: `Environment`, `Membership`, `is_admin` (Tasks 4–5).
- Produces:
  - `environments.models.Invitation` — `id` (UUID PK), `environment` (FK), `email` (EmailField), `token` (UUIDField, unique, `default=uuid.uuid4`), `status` (CharField choices `PENDING|ACCEPTED`, default `PENDING`), `invited_by` (FK User), `created_at`.
  - `POST /api/environments/{id}/invitations/` — ADMIN only, body `{email}` → 201 `{id, email, token, status}`. Rejects if the email already has an active membership (400).

- [ ] **Step 1: Write the failing test `backend/environments/tests/test_invitation_api.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Invitation, Membership
from environments.tests.test_environment_api import auth_client

User = get_user_model()


@pytest.mark.django_db
def test_admin_can_invite():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)

    resp = auth_client(ana).post(
        f"/api/environments/{env.id}/invitations/",
        {"email": "bob@example.com"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["status"] == "PENDING"
    assert Invitation.objects.filter(environment=env, email="bob@example.com").exists()


@pytest.mark.django_db
def test_member_cannot_invite():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")

    resp = auth_client(bob).post(
        f"/api/environments/{env.id}/invitations/",
        {"email": "carol@example.com"},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_cannot_invite_existing_member():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")

    resp = auth_client(ana).post(
        f"/api/environments/{env.id}/invitations/",
        {"email": "bob@example.com"},
        format="json",
    )
    assert resp.status_code == 400
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest environments/tests/test_invitation_api.py -v`
Expected: FAIL — `Invitation` does not exist / route missing.

- [ ] **Step 3: Add `Invitation` to `backend/environments/models.py`**

Append to the file:
```python
class Invitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        ACCEPTED = "ACCEPTED", "Aceito"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="invitations"
    )
    email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_invitations"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.email} → {self.environment} ({self.status})"
```

- [ ] **Step 4: Create and run the migration**

Run:
```bash
cd backend && python manage.py makemigrations environments && python manage.py migrate
```
Expected: migration for `Invitation` created and applied.

- [ ] **Step 5: Add `InvitationSerializer` to `backend/environments/serializers.py`**

Append:
```python
from environments.models import Invitation, Membership


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = ["id", "email", "token", "status"]
        read_only_fields = ["id", "token", "status"]

    def validate_email(self, value):
        environment = self.context["environment"]
        already_member = Membership.objects.filter(
            environment=environment, user__email=value
        ).exists()
        if already_member:
            raise serializers.ValidationError("Esse e-mail já é membro do ambiente.")
        return value
```

- [ ] **Step 6: Add the invite action to `EnvironmentViewSet` in `backend/environments/views.py`**

Add these imports at the top:
```python
from rest_framework.decorators import action
from rest_framework.response import Response

from environments.models import Invitation
from environments.serializers import InvitationSerializer
```

Add this method to `EnvironmentViewSet`:
```python
    @action(detail=True, methods=["post"], url_path="invitations")
    def invitations(self, request, pk=None):
        environment = self.get_object()  # runs IsEnvironmentMember object check
        if not is_admin(request.user, environment):
            raise PermissionDenied("Apenas o ADM pode convidar.")
        serializer = InvitationSerializer(
            data=request.data, context={"environment": environment}
        )
        serializer.is_valid(raise_exception=True)
        invitation = Invitation.objects.create(
            environment=environment,
            email=serializer.validated_data["email"],
            invited_by=request.user,
        )
        return Response(
            InvitationSerializer(invitation).data, status=201
        )
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && pytest environments/tests/test_invitation_api.py -v`
Expected: PASS — all three tests.

- [ ] **Step 8: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: invitation model and admin invite endpoint"
```

---

### Task 8: Accept invitation endpoint (invitee joins)

**Files:**
- Modify: `backend/environments/views.py` (add `AcceptInvitationView`)
- Modify: `backend/environments/urls.py` (add accept route)
- Test: `backend/environments/tests/test_accept_invitation_api.py`

**Interfaces:**
- Consumes: `Invitation`, `Membership` (Tasks 4, 7).
- Produces:
  - `POST /api/invitations/accept/` — auth required, body `{token}` → 200 `{environment_id, role}`. Creates an active `MEMBER` `Membership` for `request.user` and marks the invitation `ACCEPTED`. Errors: unknown token → 404; already accepted → 400; token email does not match the authenticated user's email → 403.

- [ ] **Step 1: Write the failing test `backend/environments/tests/test_accept_invitation_api.py`**

```python
import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Invitation, Membership
from environments.tests.test_environment_api import auth_client

User = get_user_model()


def make_invitation(env, admin, email):
    return Invitation.objects.create(environment=env, email=email, invited_by=admin)


@pytest.mark.django_db
def test_accept_creates_member_membership():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    inv = make_invitation(env, ana, "bob@example.com")

    resp = auth_client(bob).post(
        "/api/invitations/accept/", {"token": str(inv.token)}, format="json"
    )
    assert resp.status_code == 200
    assert resp.data["role"] == "MEMBER"
    membership = Membership.objects.get(environment=env, user=bob)
    assert membership.role == "MEMBER"
    inv.refresh_from_db()
    assert inv.status == "ACCEPTED"


@pytest.mark.django_db
def test_accept_rejects_email_mismatch():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    carol = User.objects.create_user(email="carol@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    inv = make_invitation(env, ana, "bob@example.com")

    resp = auth_client(carol).post(
        "/api/invitations/accept/", {"token": str(inv.token)}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_accept_rejects_already_accepted():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    inv = make_invitation(env, ana, "bob@example.com")
    inv.status = "ACCEPTED"
    inv.save()

    resp = auth_client(bob).post(
        "/api/invitations/accept/", {"token": str(inv.token)}, format="json"
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_accept_unknown_token_is_404():
    bob = User.objects.create_user(email="bob@example.com", password="x")
    resp = auth_client(bob).post(
        "/api/invitations/accept/",
        {"token": "00000000-0000-0000-0000-000000000000"},
        format="json",
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest environments/tests/test_accept_invitation_api.py -v`
Expected: FAIL — route not defined.

- [ ] **Step 3: Add `AcceptInvitationView` to `backend/environments/views.py`**

Add imports at the top:
```python
from django.shortcuts import get_object_or_404
from rest_framework import status as http_status
from rest_framework.views import APIView

from environments.models import Membership
```

Append the view class:
```python
class AcceptInvitationView(APIView):
    def post(self, request):
        token = request.data.get("token")
        invitation = get_object_or_404(Invitation, token=token)

        if invitation.status == Invitation.Status.ACCEPTED:
            return Response(
                {"detail": "Convite já aceito."}, status=http_status.HTTP_400_BAD_REQUEST
            )
        if invitation.email.lower() != request.user.email.lower():
            raise PermissionDenied("Este convite é para outro e-mail.")

        membership, _ = Membership.objects.get_or_create(
            environment=invitation.environment,
            user=request.user,
            defaults={"role": Membership.Role.MEMBER},
        )
        invitation.status = Invitation.Status.ACCEPTED
        invitation.save(update_fields=["status"])

        return Response(
            {"environment_id": str(invitation.environment_id), "role": membership.role},
            status=http_status.HTTP_200_OK,
        )
```

- [ ] **Step 4: Add the route to `backend/environments/urls.py`**

```python
from django.urls import path
from rest_framework.routers import DefaultRouter

from environments.views import AcceptInvitationView, EnvironmentViewSet

router = DefaultRouter()
router.register("environments", EnvironmentViewSet, basename="environment")

urlpatterns = router.urls + [
    path("invitations/accept/", AcceptInvitationView.as_view(), name="accept-invitation"),
]
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest environments/tests/test_accept_invitation_api.py -v`
Expected: PASS — all four tests.

- [ ] **Step 6: Run the full suite to confirm nothing regressed**

Run: `cd backend && pytest -v`
Expected: PASS — every test across `accounts` and `environments`.

- [ ] **Step 7: Commit**

```bash
cd backend && ruff format . && git add . && git commit -m "feat: accept-invitation endpoint"
```

---

## Self-Review

**Spec coverage (against §3 "Dentro do MVP" — foundations portion):**
- Contas e autenticação (criar conta, entrar) → Tasks 2–3. Aceitar convite → Task 8. ✅
- Ambientes multi-tenant com tipo; usuário em vários ambientes → Tasks 4, 6 (list scoped by membership). ✅
- Convites e papéis (ADM / membro) → Tasks 4 (roles), 7 (invite), 8 (accept as MEMBER). ✅
- `notifications_last_read_at` field present for the later notifications slice → Task 4. ✅
- Deferred to later plans (correctly out of this plan): task catalog, recurring agenda, occurrences, daily board, real-time, sininho, push. Tracked as Plans 2–6.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Each code step shows complete code. ✅

**Type consistency:** `Environment.create_with_admin(name, env_type, owner)` defined in Task 4 and called identically in Tasks 6–8 and tests. `Membership.Role.ADMIN/MEMBER`, `Membership.Status.ACTIVE`, `Invitation.Status.PENDING/ACCEPTED` used consistently. `get_membership`/`is_admin` signatures from Task 5 used unchanged in Tasks 6–8. `auth_client` helper defined in Task 6's test and imported by Tasks 7–8 tests. ✅

---

## Execution Handoff

This plan (Plan 1 of 6) delivers a working, testable backend foundation. Plans 2–6 (recurring agenda, daily board + real-time, notifications, push, RN client) will each get their own plan document following this same structure.
