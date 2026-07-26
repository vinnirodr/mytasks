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
    rt = RecurringTask.objects.create(environment=env, task_definition=td, weekday=0, time="20:00")
    patch = auth_client(ana).patch(f"/api/recurring-tasks/{rt.id}/", {"weekday": 3}, format="json")
    assert patch.status_code == 200
    rt.refresh_from_db()
    assert rt.weekday == 3

    delete = auth_client(ana).delete(f"/api/recurring-tasks/{rt.id}/")
    assert delete.status_code == 204
    assert not RecurringTask.objects.filter(id=rt.id).exists()
