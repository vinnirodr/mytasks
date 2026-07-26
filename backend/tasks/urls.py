from django.urls import path

from tasks.views import TaskPresetsView

urlpatterns = [
    path(
        "environments/<uuid:env_id>/task-presets/",
        TaskPresetsView.as_view(),
        name="task-presets",
    ),
]
