from rest_framework import serializers

from environments.models import Environment
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
