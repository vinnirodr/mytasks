import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from environments.models import Environment
from tasks.services import ensure_occurrences_for_range


class Command(BaseCommand):
    help = "Materialize occurrences for the next N days across all environments."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=14)

    def handle(self, *args, **options):
        days = options["days"]
        start = timezone.localdate()
        end = start + datetime.timedelta(days=days - 1)
        total = 0
        for env in Environment.objects.all():
            total += ensure_occurrences_for_range(env, start, end)
        self.stdout.write(f"Materialized {total} occurrence(s) from {start} to {end}.")
