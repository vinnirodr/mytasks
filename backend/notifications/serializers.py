from rest_framework import serializers

from notifications.models import ActivityEvent


class ActivityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityEvent
        fields = ["id", "verb", "actor_name", "occurrence", "created_at"]
        read_only_fields = fields
