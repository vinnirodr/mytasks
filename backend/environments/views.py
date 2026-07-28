import uuid

from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework import status as http_status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from environments.models import Environment, Invitation, Membership
from environments.permissions import IsEnvironmentAdmin, IsEnvironmentMember, is_admin
from environments.serializers import EnvironmentSerializer, InvitationSerializer


def initials(name):
    letters = [c for c in name if c.isalpha()][:2]
    return "".join(letters).upper()


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
            env_type=serializer.validated_data.get("env_type", Environment.Type.HOUSE),
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


class AcceptInvitationView(APIView):
    def post(self, request):
        token = request.data.get("token")
        try:
            uuid.UUID(str(token))
        except ValueError, TypeError:
            raise Http404
        invitation = get_object_or_404(Invitation, token=token)

        if invitation.email.lower() != request.user.email.lower():
            raise PermissionDenied("Este convite é para outro e-mail.")
        if invitation.status == Invitation.Status.ACCEPTED:
            return Response(
                {"detail": "Convite já aceito."}, status=http_status.HTTP_400_BAD_REQUEST
            )

        membership, _ = Membership.objects.get_or_create(
            environment=invitation.environment,
            user=request.user,
            defaults={"role": Membership.Role.MEMBER},
        )
        invitation.status = Invitation.Status.ACCEPTED
        invitation.save(update_fields=["status"])

        return Response(
            {"environment_id": str(invitation.environment_id), "role": membership.role},
            status=http_status.HTTP_200_OK,
        )


class InvitationPreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        invitation = get_object_or_404(Invitation, token=token)
        environment = invitation.environment
        members = [
            {
                "display_name": membership.user.display_name or membership.user.email,
                "initials": initials(membership.user.display_name or membership.user.email),
            }
            for membership in environment.memberships.filter(status=Membership.Status.ACTIVE)
        ]
        return Response(
            {
                "environment_name": environment.name,
                "env_type": environment.env_type,
                "member_count": environment.memberships.count(),
                "members": members,
                "invited_by_name": invitation.invited_by.display_name
                or invitation.invited_by.email,
                "status": invitation.status,
                "email": invitation.email,
            },
            status=http_status.HTTP_200_OK,
        )
