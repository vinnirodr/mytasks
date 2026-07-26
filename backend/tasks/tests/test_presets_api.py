import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
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
    house_names = {
        i["name"] for i in auth_client(ana).get(f"/api/environments/{house.id}/task-presets/").data
    }
    office_names = {
        i["name"] for i in auth_client(ana).get(f"/api/environments/{office.id}/task-presets/").data
    }
    assert house_names != office_names
