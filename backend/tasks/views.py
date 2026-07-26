import datetime

from django.db.models import Case, IntegerField, ProtectedError, Value, When
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from environments.models import Environment
from environments.permissions import get_membership, is_admin
from tasks.models import Occurrence, RecurringTask, TaskDefinition
from tasks.presets import get_recommended_tasks
from tasks.serializers import (
    OccurrenceEditSerializer,
    OccurrenceSerializer,
    OneOffOccurrenceSerializer,
    RecurringTaskSerializer,
    TaskDefinitionSerializer,
)
from tasks.services import ensure_occurrences_for, ensure_occurrences_for_range, refresh_statuses


class EnvironmentScopedView(APIView):
    """Base view that resolves an environment from the URL and enforces membership."""

    def get_environment(self):
        env = get_object_or_404(Environment, pk=self.kwargs["env_id"])
        if get_membership(self.request.user, env) is None:
            # Hide existence from non-members.
            raise Http404
        return env

    def require_admin(self, environment):
        if not is_admin(self.request.user, environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")


class TaskPresetsView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        return Response(get_recommended_tasks(environment.env_type))


class TaskDefinitionListCreateView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        tds = environment.task_definitions.all().order_by("created_at")
        return Response(TaskDefinitionSerializer(tds, many=True).data)

    def post(self, request, env_id):
        environment = self.get_environment()
        self.require_admin(environment)
        serializer = TaskDefinitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(environment=environment)
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)


class TaskDefinitionDetailView(APIView):
    def delete(self, request, pk):
        td = get_object_or_404(TaskDefinition, pk=pk)
        if get_membership(request.user, td.environment) is None:
            raise Http404
        if not is_admin(request.user, td.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        try:
            td.delete()
        except ProtectedError:
            return Response(
                {"detail": "Esta tarefa está em uso pela agenda e não pode ser removida."},
                status=http_status.HTTP_409_CONFLICT,
            )
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class RecurringTaskListCreateView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        rts = environment.recurring_tasks.all().order_by("weekday", "time")
        return Response(RecurringTaskSerializer(rts, many=True).data)

    def post(self, request, env_id):
        environment = self.get_environment()
        self.require_admin(environment)
        serializer = RecurringTaskSerializer(
            data=request.data, context={"environment": environment}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(environment=environment)
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)


class RecurringTaskDetailView(APIView):
    def _get_object(self, request, pk):
        rt = get_object_or_404(RecurringTask, pk=pk)
        if get_membership(request.user, rt.environment) is None:
            raise Http404
        return rt

    def patch(self, request, pk):
        rt = self._get_object(request, pk)
        if not is_admin(request.user, rt.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        serializer = RecurringTaskSerializer(
            rt, data=request.data, partial=True, context={"environment": rt.environment}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        rt = self._get_object(request, pk)
        if not is_admin(request.user, rt.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        rt.delete()
        return Response(status=http_status.HTTP_204_NO_CONTENT)


def _parse_date(value):
    if not value:
        raise ValidationError({"date": "Parâmetro obrigatório (YYYY-MM-DD)."})
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise ValidationError({"date": "Data inválida (use YYYY-MM-DD)."})


class OccurrenceListCreateView(EnvironmentScopedView):
    def get(self, request, env_id):
        environment = self.get_environment()
        week_of = request.query_params.get("week_of")
        if week_of:
            anchor = _parse_date(week_of)
            monday = anchor - datetime.timedelta(days=anchor.weekday())
            sunday = monday + datetime.timedelta(days=6)
            ensure_occurrences_for_range(environment, monday, sunday)
            refresh_statuses(environment)
            qs = environment.occurrences.filter(
                date__gte=monday, date__lte=sunday, is_cancelled=False
            ).order_by("date", "time")
        else:
            day = _parse_date(request.query_params.get("date"))
            ensure_occurrences_for(environment, day)
            refresh_statuses(environment)
            qs = (
                environment.occurrences.filter(date=day, is_cancelled=False)
                .annotate(
                    _postponed_last=Case(
                        When(status=Occurrence.Status.POSTPONED, then=Value(1)),
                        default=Value(0),
                        output_field=IntegerField(),
                    )
                )
                .order_by("_postponed_last", "time")
            )
        return Response(OccurrenceSerializer(qs, many=True).data)

    def post(self, request, env_id):
        environment = self.get_environment()  # 404 for non-members
        serializer = OneOffOccurrenceSerializer(
            data=request.data, context={"environment": environment}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(
            environment=environment,
            is_one_off=True,
            created_by=request.user,
            assignee=request.user,
        )
        return Response(serializer.data, status=http_status.HTTP_201_CREATED)


class OccurrenceDetailView(APIView):
    def _get_object(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        return occ

    def patch(self, request, pk):
        occ = self._get_object(request, pk)
        if not is_admin(request.user, occ.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        serializer = OccurrenceEditSerializer(
            occ, data=request.data, partial=True, context={"environment": occ.environment}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(OccurrenceSerializer(occ).data)


class OccurrenceCancelView(APIView):
    def post(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        if not is_admin(request.user, occ.environment):
            raise PermissionDenied("Apenas o ADM pode fazer isso.")
        occ.is_cancelled = True
        occ.save(update_fields=["is_cancelled"])
        return Response({"is_cancelled": True})


class OccurrenceCompleteView(APIView):
    def post(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        occ.status = Occurrence.Status.DONE
        occ.completed_by = request.user
        occ.completed_at = timezone.now()
        occ.save(update_fields=["status", "completed_by", "completed_at"])
        return Response(OccurrenceSerializer(occ).data)


class OccurrencePostponeView(APIView):
    def post(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        if occ.assignee_id != request.user.id and not is_admin(request.user, occ.environment):
            raise PermissionDenied("Só o responsável ou o ADM podem adiar.")
        if occ.status not in (Occurrence.Status.PENDING, Occurrence.Status.LATE):
            return Response(
                {"detail": "Só é possível adiar uma tarefa pendente ou atrasada."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        occ.status = Occurrence.Status.POSTPONED
        occ.save(update_fields=["status"])
        return Response(OccurrenceSerializer(occ).data)


class OccurrencePickupView(APIView):
    def post(self, request, pk):
        occ = get_object_or_404(Occurrence, pk=pk)
        if get_membership(request.user, occ.environment) is None:
            raise Http404
        if occ.assignee_id is not None:
            return Response(
                {"detail": "Esta tarefa já tem um responsável."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        occ.assignee = request.user
        occ.save(update_fields=["assignee"])
        return Response(OccurrenceSerializer(occ).data)
