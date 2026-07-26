from django.urls import path

from tasks.views import (
    OccurrenceListCreateView,
    RecurringTaskDetailView,
    RecurringTaskListCreateView,
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
    path(
        "environments/<uuid:env_id>/recurring-tasks/",
        RecurringTaskListCreateView.as_view(),
        name="recurring-task-list",
    ),
    path(
        "recurring-tasks/<uuid:pk>/",
        RecurringTaskDetailView.as_view(),
        name="recurring-task-detail",
    ),
    path(
        "environments/<uuid:env_id>/occurrences/",
        OccurrenceListCreateView.as_view(),
        name="occurrence-list",
    ),
]
