from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from push.models import PushToken
from push.serializers import PushTokenSerializer


class RegisterPushTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PushTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        PushToken.objects.update_or_create(
            token=token,
            defaults={
                "user": request.user,
                "device_name": serializer.validated_data.get("device_name", ""),
            },
        )
        return Response({"token": token})
