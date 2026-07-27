from django.urls import path

from notifications.views import ActivityFeedView, ActivityMarkReadView

urlpatterns = [
    path(
        "environments/<uuid:env_id>/activity/",
        ActivityFeedView.as_view(),
        name="activity-feed",
    ),
    path(
        "environments/<uuid:env_id>/activity/read/",
        ActivityMarkReadView.as_view(),
        name="activity-mark-read",
    ),
]
