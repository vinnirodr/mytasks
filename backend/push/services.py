import datetime
import logging
from zoneinfo import ZoneInfo

from django.utils import timezone

from environments.models import Environment, Membership
from push.expo import send_push
from push.models import PushToken
from tasks.models import Occurrence

logger = logging.getLogger(__name__)

REMINDER_LEAD = datetime.timedelta(minutes=15)


def _recipient_tokens(occurrence):
    if occurrence.assignee_id:
        user_ids = [occurrence.assignee_id]
    else:
        user_ids = list(
            occurrence.environment.memberships.filter(status=Membership.Status.ACTIVE).values_list(
                "user_id", flat=True
            )
        )
    return list(PushToken.objects.filter(user_id__in=user_ids).values_list("token", flat=True))


def _due_occurrences(environment, local_now):
    tz = local_now.tzinfo
    candidates = environment.occurrences.filter(
        is_cancelled=False,
        reminder_sent=False,
        status=Occurrence.Status.PENDING,
        time__isnull=False,
        date__in=[local_now.date(), local_now.date() + datetime.timedelta(days=1)],
    )
    due = []
    for occ in candidates:
        scheduled = datetime.datetime.combine(occ.date, occ.time, tzinfo=tz)
        if scheduled - REMINDER_LEAD <= local_now < scheduled:
            due.append(occ)
    return due


def send_reminders(now_dt=None):
    now_dt = now_dt or timezone.now()
    reminded = 0
    for environment in Environment.objects.all():
        try:
            local_now = now_dt.astimezone(ZoneInfo(environment.timezone))
            due = _due_occurrences(environment, local_now)
        except Exception:
            logger.exception("Reminder sweep failed for environment %s", environment.id)
            continue
        for occ in due:
            try:
                claimed = Occurrence.objects.filter(pk=occ.pk, reminder_sent=False).update(
                    reminder_sent=True
                )
                if not claimed:
                    continue  # another concurrent sweep already took this one
                tokens = _recipient_tokens(occ)
                if tokens:
                    send_push(
                        tokens,
                        "Lembrete de tarefa",
                        f"'{occ.title}' é às {occ.time.strftime('%H:%M')}.",
                        {"occurrence_id": str(occ.id)},
                    )
                reminded += 1
            except Exception:
                logger.exception("Reminder failed for occurrence %s", occ.pk)
    return reminded
