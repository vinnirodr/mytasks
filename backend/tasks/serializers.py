from rest_framework import serializers

from tasks.models import TaskDefinition


class TaskDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskDefinition
        fields = ["id", "name", "icon"]
        read_only_fields = ["id"]
