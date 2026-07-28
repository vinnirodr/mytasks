import uuid

from django.conf import settings
from django.db import models

from environments.models import Environment


class TaskDefinition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="task_definitions"
    )
    name = models.CharField(max_length=120)
    icon = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class RecurringTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="recurring_tasks"
    )
    task_definition = models.ForeignKey(
        TaskDefinition, on_delete=models.PROTECT, related_name="recurring_tasks"
    )
    weekday = models.PositiveSmallIntegerField()  # 0=Monday ... 6=Sunday
    time = models.TimeField()
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recurring_tasks",
    )
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.task_definition} · weekday {self.weekday} @ {self.time}"


class Occurrence(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        LATE = "LATE", "Atrasada"
        DONE = "DONE", "Feita"
        POSTPONED = "POSTPONED", "Adiada"
        MISSED = "MISSED", "Não feita"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="occurrences"
    )
    recurring_task = models.ForeignKey(
        RecurringTask,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="occurrences",
    )
    task_definition = models.ForeignKey(
        TaskDefinition,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="occurrences",
    )
    title = models.CharField(max_length=120)
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="occurrences",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    is_cancelled = models.BooleanField(default=False)
    is_one_off = models.BooleanField(default=False)
    reminder_sent = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_occurrences",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_occurrences",
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recurring_task", "date"],
                name="uniq_recurring_occurrence_per_date",
            )
        ]

    def __str__(self):
        return f"{self.title} @ {self.date}"
