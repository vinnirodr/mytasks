import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from notifications.models import ActivityEvent

User = get_user_model()


def _setup():
    ana = User.objects.create_user(email="ana@example.com", password="x", display_name="Ana")
    bob = User.objects.create_user(email="bob@example.com", password="x", display_name="Bob")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    return env, ana, bob


@pytest.mark.django_db
def test_feed_lists_events_with_unread_count():
    env, ana, bob = _setup()
    ActivityEvent.objects.create(
        environment=env, actor=ana, actor_name="Ana", verb=ActivityEvent.Verb.COMPLETED
    )
    ActivityEvent.objects.create(
        environment=env, actor=bob, actor_name="Bob", verb=ActivityEvent.Verb.PICKED_UP
    )
    resp = auth_client(bob).get(f"/api/environments/{env.id}/activity/")
    assert resp.status_code == 200
    assert resp.data["unread_count"] == 2
    assert len(resp.data["results"]) == 2
    assert resp.data["results"][0]["unread"] is True


@pytest.mark.django_db
def test_mark_read_zeroes_unread_count():
    env, ana, bob = _setup()
    ActivityEvent.objects.create(
        environment=env, actor=ana, actor_name="Ana", verb=ActivityEvent.Verb.COMPLETED
    )
    mark = auth_client(bob).post(f"/api/environments/{env.id}/activity/read/")
    assert mark.status_code == 200
    assert mark.data["unread_count"] == 0

    feed = auth_client(bob).get(f"/api/environments/{env.id}/activity/")
    assert feed.data["unread_count"] == 0
    assert feed.data["results"][0]["unread"] is False


@pytest.mark.django_db
def test_outsider_cannot_read_feed():
    env, ana, bob = _setup()
    out = User.objects.create_user(email="out@example.com", password="x")
    resp = auth_client(out).get(f"/api/environments/{env.id}/activity/")
    assert resp.status_code == 404
