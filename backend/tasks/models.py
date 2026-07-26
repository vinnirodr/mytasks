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
