from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status as http_status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from environments.models import Environment
from environments.permissions import get_membership, is_admin
from tasks.models import TaskDefinition
from tasks.presets import get_recommended_tasks
from tasks.serializers import TaskDefinitionSerializer


class EnvironmentScopedView(APIView):
    """Base view that resolves an environment from the URL and enforces membership."""

    def get_environment(self):
        env = get_object_or_404(Environment, pk=self.kwargs["env_id"])
        if get_membership(self.request.user, env) is None:
            # Hide existence from non-members.
            raise Http404
        return env

    def require_admin(self, environment):
        if not is_admin(self.request.user, environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")


class TaskPresetsView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        return Response(get_recommended_tasks(environment.env_type))


class TaskDefinitionListCreateView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        tds = environment.task_definitions.all().order_by("created_at")
        return Response(TaskDefinitionSerializer(tds, many=True).data)

    def post(self, request, env_id):
        environment = self.get_environment()
        self.require_admin(environment)
        serializer = TaskDefinitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(environment=environment)
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)


class TaskDefinitionDetailView(APIView):
    def delete(self, request, pk):
        td = get_object_or_404(TaskDefinition, pk=pk)
        if get_membership(request.user, td.environment) is None:
            raise Http404
        if not is_admin(request.user, td.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        td.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)
