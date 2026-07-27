from django.core.management.base import BaseCommand

from environments.models import Environment
from tasks.services import refresh_statuses


class Command(BaseCommand):
    help = "Apply time-based status transitions (LATE/MISSED) across all environments."

    def handle(self, *args, **options):
        total = 0
        for env in Environment.objects.all():
            total += refresh_statuses(env)
        self.stdout.write(f"Updated {total} occurrence status(es).")
