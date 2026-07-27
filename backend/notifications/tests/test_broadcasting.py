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
