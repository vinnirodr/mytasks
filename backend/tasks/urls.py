from django.urls import path

from tasks.views import (
    TaskDefinitionDetailView,
    TaskDefinitionListCreateView,
    TaskPresetsView,
)

urlpatterns = [
    path(
        "environments/<uuid:env_id>/task-presets/",
        TaskPresetsView.as_view(),
        name="task-presets",
    ),
    path(
        "environments/<uuid:env_id>/task-definitions/",
        TaskDefinitionListCreateView.as_view(),
        name="task-definition-list",
    ),
    path(
        "task-definitions/<uuid:pk>/",
        TaskDefinitionDetailView.as_view(),
        name="task-definition-detail",
    ),
]
