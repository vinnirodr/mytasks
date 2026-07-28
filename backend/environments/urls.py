from django.urls import path
from rest_framework.routers import DefaultRouter

from environments.views import AcceptInvitationView, EnvironmentViewSet, InvitationPreviewView

router = DefaultRouter()
router.register("environments", EnvironmentViewSet, basename="environment")

urlpatterns = router.urls + [
    path("invitations/accept/", AcceptInvitationView.as_view(), name="accept-invitation"),
    path(
        "invitations/<uuid:token>/preview/",
        InvitationPreviewView.as_view(),
        name="invitation-preview",
    ),
]
