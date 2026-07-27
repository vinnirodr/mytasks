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
