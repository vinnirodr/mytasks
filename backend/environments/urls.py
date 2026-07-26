from rest_framework.routers import DefaultRouter

from environments.views import EnvironmentViewSet

router = DefaultRouter()
router.register("environments", EnvironmentViewSet, basename="environment")

urlpatterns = router.urls
