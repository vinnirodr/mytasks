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


@pytest.mark.django_db
def test_delete_in_use_task_definition_returns_409():
    env, ana, bob = _env_with_member()
    import datetime

    from tasks.models import RecurringTask

    td = TaskDefinition.objects.create(environment=env, name="Louça")
    RecurringTask.objects.create(
        environment=env, task_definition=td, weekday=0, time=datetime.time(20, 0)
    )
    resp = auth_client(ana).delete(f"/api/task-definitions/{td.id}/")
    assert resp.status_code == 409
    assert TaskDefinition.objects.filter(id=td.id).exists()
