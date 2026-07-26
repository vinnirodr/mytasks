from rest_framework import serializers

from environments.models import Environment, Invitation, Membership
from environments.permissions import get_membership


class EnvironmentSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = Environment
        fields = ["id", "name", "env_type", "role"]
        read_only_fields = ["id", "role"]

    def get_role(self, obj):
        user = self.context["request"].user
        membership = get_membership(user, obj)
        return membership.role if membership else None


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = ["id", "email", "token", "status"]
        read_only_fields = ["id", "token", "status"]

    def validate_email(self, value):
        environment = self.context["environment"]
        already_member = Membership.objects.filter(
            environment=environment, user__email=value
        ).exists()
        if already_member:
            raise serializers.ValidationError("Esse e-mail já é membro do ambiente.")
        return value
