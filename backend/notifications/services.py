import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from notifications.models import ActivityEvent

logger = logging.getLogger(__name__)


def broadcast_to_environment(environment_id, payload):
    layer = get_channel_layer()
    try:
        async_to_sync(layer.group_send)(
            f"env_{environment_id}", {"type": "broadcast", "payload": payload}
        )
    except Exception:
        logger.warning("Failed to broadcast to env %s", environment_id, exc_info=True)


def _serialize_event(event):
    return {
        "id": str(event.id),
        "verb": event.verb,
        "actor_name": event.actor_name,
        "occurrence_id": str(event.occurrence_id) if event.occurrence_id else None,
        "created_at": event.created_at.isoformat(),
    }


def record_activity(environment, actor, verb, occurrence=None):
    actor_name = (actor.display_name or actor.email) if actor else ""
    event = ActivityEvent.objects.create(
        environment=environment,
        actor=actor,
        actor_name=actor_name,
        verb=verb,
        occurrence=occurrence,
    )
    broadcast_to_environment(environment.id, {"kind": "activity", "event": _serialize_event(event)})
    return event


def broadcast_board_update(occurrence):
    broadcast_to_environment(
        occurrence.environment_id,
        {
            "kind": "board_update",
            "occurrence_id": str(occurrence.id),
            "status": occurrence.status,
        },
    )
