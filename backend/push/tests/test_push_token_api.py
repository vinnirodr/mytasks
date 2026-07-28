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
