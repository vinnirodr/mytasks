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
    await layer.group_send(f"env_{env.id}", {"type": "broadcast", "payload": {"kind": "ping"}})
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
