from rest_framework import serializers


class PushTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=255)
    device_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
