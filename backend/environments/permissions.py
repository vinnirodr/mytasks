from rest_framework import permissions

from environments.models import Membership


def get_membership(user, environment):
    if not user or not user.is_authenticated:
        return None
    return Membership.objects.filter(
        environment=environment, user=user, status=Membership.Status.ACTIVE
    ).first()


def is_admin(user, environment):
    membership = get_membership(user, environment)
    return membership is not None and membership.role == Membership.Role.ADMIN


class IsEnvironmentMember(permissions.IsAuthenticated):
    def has_object_permission(self, request, view, obj):
        return get_membership(request.user, obj) is not None


class IsEnvironmentAdmin(permissions.IsAuthenticated):
    def has_object_permission(self, request, view, obj):
        return is_admin(request.user, obj)
