from celery import shared_task
from django.core.management import call_command

from push.services import send_reminders


@shared_task
def send_reminders_task():
    return send_reminders()


@shared_task
def materialize_occurrences_task():
    call_command("materialize_occurrences")


@shared_task
def refresh_statuses_task():
    call_command("refresh_statuses")
