from django.urls import path

from notifications.consumers import EnvironmentConsumer

websocket_urlpatterns = [
    path("ws/environments/<uuid:env_id>/", EnvironmentConsumer.as_asgi()),
]
