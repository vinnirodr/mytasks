from rest_framework import serializers

from tasks.models import RecurringTask, TaskDefinition


class TaskDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskDefinition
        fields = ["id", "name", "icon"]
        read_only_fields = ["id"]


class RecurringTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringTask
        fields = ["id", "task_definition", "weekday", "time", "assignee", "active"]
        read_only_fields = ["id"]

    def validate_weekday(self, value):
        if not 0 <= value <= 6:
            raise serializers.ValidationError("weekday deve estar entre 0 e 6.")
        return value

    def validate(self, attrs):
        environment = self.context["environment"]
        task_definition = attrs.get("task_definition")
        if task_definition is not None and task_definition.environment_id != environment.id:
            raise serializers.ValidationError(
                {"task_definition": "A tarefa não pertence a este ambiente."}
            )
        return attrs
