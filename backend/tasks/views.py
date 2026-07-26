from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from environments.models import Environment
from environments.permissions import get_membership, is_admin
from tasks.presets import get_recommended_tasks


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
