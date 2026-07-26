from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from environments.models import Environment, Invitation, Membership
from environments.permissions import IsEnvironmentAdmin, IsEnvironmentMember, is_admin
from environments.serializers import EnvironmentSerializer, InvitationSerializer


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

    @action(detail=True, methods=["post"], url_path="invitations")
    def invitations(self, request, pk=None):
        environment = self.get_object()  # runs IsEnvironmentMember object check
        if not is_admin(request.user, environment):
            raise PermissionDenied("Apenas o ADM pode convidar.")
        serializer = InvitationSerializer(data=request.data, context={"environment": environment})
        serializer.is_valid(raise_exception=True)
        invitation = Invitation.objects.create(
            environment=environment,
            email=serializer.validated_data["email"],
            invited_by=request.user,
        )
        return Response(InvitationSerializer(invitation).data, status=201)
