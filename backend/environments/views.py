from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied

from environments.models import Environment, Membership
from environments.permissions import IsEnvironmentAdmin, IsEnvironmentMember, is_admin
from environments.serializers import EnvironmentSerializer


class EnvironmentViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = EnvironmentSerializer

    def get_queryset(self):
        return Environment.objects.filter(
            memberships__user=self.request.user,
            memberships__status=Membership.Status.ACTIVE,
        ).distinct()

    def get_permissions(self):
        if self.action in ("update", "partial_update"):
            return [IsEnvironmentAdmin()]
        return [IsEnvironmentMember()]

    def perform_create(self, serializer):
        env = Environment.create_with_admin(
            name=serializer.validated_data["name"],
            env_type=serializer.validated_data["env_type"],
            owner=self.request.user,
        )
        serializer.instance = env
