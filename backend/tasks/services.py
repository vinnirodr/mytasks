import datetime

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
