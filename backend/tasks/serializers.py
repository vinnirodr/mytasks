from rest_framework import serializers

from environments.permissions import get_membership
from tasks.models import Occurrence, RecurringTask, TaskDefinition


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
        assignee = attrs.get("assignee")
        if assignee is not None and get_membership(assignee, environment) is None:
            raise serializers.ValidationError(
                {"assignee": "O responsável precisa ser membro deste ambiente."}
            )
        return attrs


class OccurrenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Occurrence
        fields = [
            "id",
            "title",
            "date",
            "time",
            "assignee",
            "status",
            "is_one_off",
            "is_cancelled",
            "recurring_task",
            "task_definition",
            "completed_by",
            "completed_at",
        ]
        read_only_fields = fields


class OccurrenceEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Occurrence
        fields = ["assignee", "time"]

    def validate(self, attrs):
        assignee = attrs.get("assignee")
        environment = self.context["environment"]
        if assignee is not None and get_membership(assignee, environment) is None:
            raise serializers.ValidationError(
                {"assignee": "O responsável precisa ser membro deste ambiente."}
            )
        return attrs


class OneOffOccurrenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Occurrence
        fields = ["id", "title", "date", "time", "task_definition"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        environment = self.context["environment"]
        td = attrs.get("task_definition")
        if td is not None and td.environment_id != environment.id:
            raise serializers.ValidationError(
                {"task_definition": "A tarefa não pertence a este ambiente."}
            )
        return attrs
