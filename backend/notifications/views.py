from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from environments.models import Environment
from environments.permissions import get_membership
from notifications.serializers import ActivityEventSerializer

FEED_LIMIT = 50


class ActivityFeedView(APIView):
    def get(self, request, env_id):
        environment = get_object_or_404(Environment, pk=env_id)
        membership = get_membership(request.user, environment)
        if membership is None:
            raise Http404
        events = list(environment.activity_events.all()[:FEED_LIMIT])
        last_read = membership.notifications_last_read_at
        unread_count = sum(1 for e in events if last_read is None or e.created_at > last_read)
        results = []
        for e in events:
            data = ActivityEventSerializer(e).data
            data["unread"] = last_read is None or e.created_at > last_read
            results.append(data)
        return Response({"unread_count": unread_count, "results": results})


class ActivityMarkReadView(APIView):
    def post(self, request, env_id):
        environment = get_object_or_404(Environment, pk=env_id)
        membership = get_membership(request.user, environment)
        if membership is None:
            raise Http404
        membership.notifications_last_read_at = timezone.now()
        membership.save(update_fields=["notifications_last_read_at"])
        return Response({"unread_count": 0}, status=http_status.HTTP_200_OK)
