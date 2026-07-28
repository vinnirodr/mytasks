from django.urls import path

from push.views import RegisterPushTokenView

urlpatterns = [
    path("push-tokens/", RegisterPushTokenView.as_view(), name="register-push-token"),
]
