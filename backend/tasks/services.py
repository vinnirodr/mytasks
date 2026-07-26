import datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

from tasks.models import Occurrence


def ensure_occurrences_for(environment, date):
    """Idempotently materialize occurrences for `date` from active recurring tasks.

    Returns every Occurrence tied to a recurring task for that date (created or
    pre-existing). Cancelled rows are preserved, not recreated.
    """
    recurring = environment.recurring_tasks.filter(
        active=True, weekday=date.weekday()
    ).select_related("task_definition")

    occurrences = []
    for rt in recurring:
        occ, _ = Occurrence.objects.get_or_create(
            recurring_task=rt,
            date=date,
            defaults={
                "environment": environment,
                "task_definition": rt.task_definition,
                "title": rt.task_definition.name,
                "time": rt.time,
                "assignee": rt.assignee,
            },
        )
        occurrences.append(occ)
    return occurrences


def ensure_occurrences_for_range(environment, start_date, end_date):
    """Materialize each date in [start_date, end_date] inclusive. Returns count created."""
    created = 0
    day = start_date
    while day <= end_date:
        before = Occurrence.objects.filter(environment=environment, date=day).count()
        ensure_occurrences_for(environment, day)
        after = Occurrence.objects.filter(environment=environment, date=day).count()
        created += after - before
        day += datetime.timedelta(days=1)
    return created


_TERMINAL_STATUSES = {Occurrence.Status.DONE, Occurrence.Status.MISSED}


def _target_status(occurrence, today, now_time):
    """The status this occurrence should have, given local `today` and `now_time`."""
    if occurrence.date < today:
        return Occurrence.Status.MISSED
    if (
        occurrence.status == Occurrence.Status.PENDING
        and occurrence.date == today
        and occurrence.time is not None
        and now_time > occurrence.time
    ):
        return Occurrence.Status.LATE
    return occurrence.status


def refresh_statuses(environment, now_dt=None):
    """Idempotently persist LATE/MISSED transitions using the environment's timezone.

    Returns the number of occurrences whose status changed. DONE/MISSED are
    terminal and never touched; cancelled occurrences are ignored.
    """
    now_dt = now_dt or timezone.now()
    local_now = now_dt.astimezone(ZoneInfo(environment.timezone))
    today = local_now.date()
    now_time = local_now.time()

    qs = environment.occurrences.filter(is_cancelled=False).exclude(status__in=_TERMINAL_STATUSES)
    updated = 0
    for occ in qs:
        target = _target_status(occ, today, now_time)
        if target != occ.status:
            occ.status = target
            occ.save(update_fields=["status"])
            updated += 1
    return updated
