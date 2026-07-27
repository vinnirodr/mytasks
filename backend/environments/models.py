import uuid

from django.conf import settings
from django.db import models, transaction


class Environment(models.Model):
    class Type(models.TextChoices):
        HOUSE = "HOUSE", "Casa"
        OFFICE = "OFFICE", "Escritório"
        WORK = "WORK", "Trabalho"
        OTHER = "OTHER", "Outro"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    env_type = models.CharField(max_length=10, choices=Type.choices, default=Type.HOUSE)
    timezone = models.CharField(max_length=64, default="America/Sao_Paulo")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="created_environments"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    @classmethod
    def create_with_admin(cls, name, env_type, owner):
        with transaction.atomic():
            env = cls.objects.create(name=name, env_type=env_type, created_by=owner)
            Membership.objects.create(environment=env, user=owner, role=Membership.Role.ADMIN)
        return env


class Membership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "ADM"
        MEMBER = "MEMBER", "Membro"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativo"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    notifications_last_read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("environment", "user")

    def __str__(self):
        return f"{self.user} @ {self.environment} ({self.role})"


class Invitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        ACCEPTED = "ACCEPTED", "Aceito"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    environment = models.ForeignKey(
        Environment, on_delete=models.CASCADE, related_name="invitations"
    )
    email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_invitations"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.email} → {self.environment} ({self.status})"
