import uuid

from django.conf import settings
from django.db import models

from environments.models import Environment
from tasks.models import Occurrence


class ActivityEvent(models.Model):
    class Verb(models.TextChoices):
        COMPLETED = "COMPLETED", "Concluiu"
        PICKED_UP = "PICKED_UP", "Pegou"
        POSTPONED = "POSTPONED", "Adiou"
        ADDED_TASK = "ADDED_TASK", "Adicionou tarefa"
        AGENDA_CHANGED = "AGENDA_CHANGED", "Mudou a agenda"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="activity_events"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_events",
    )
    actor_name = models.CharField(max_length=120)
    verb = models.CharField(max_length=20, choices=Verb.choices)
    occurrence = models.ForeignKey(
        Occurrence,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.actor_name} {self.verb}"
