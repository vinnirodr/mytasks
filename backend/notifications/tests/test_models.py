import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from notifications.models import ActivityEvent

User = get_user_model()


@pytest.mark.django_db
def test_activity_event_defaults_and_ordering():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    first = ActivityEvent.objects.create(
        environment=env, actor=ana, actor_name="Ana", verb=ActivityEvent.Verb.COMPLETED
    )
    second = ActivityEvent.objects.create(
        environment=env, actor=ana, actor_name="Ana", verb=ActivityEvent.Verb.POSTPONED
    )
    assert first.occurrence is None
    # newest first
    assert list(env.activity_events.all()) == [second, first]
