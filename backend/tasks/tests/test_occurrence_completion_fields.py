import datetime

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from environments.models import Environment
from tasks.models import Occurrence

User = get_user_model()


@pytest.mark.django_db
def test_completion_fields_default_null_and_settable():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    occ = Occurrence.objects.create(environment=env, title="Louça", date=datetime.date(2026, 7, 27))
    assert occ.completed_by is None
    assert occ.completed_at is None

    now = timezone.now()
    occ.completed_by = ana
    occ.completed_at = now
    occ.save()
    occ.refresh_from_db()
    assert occ.completed_by == ana
    assert occ.completed_at == now
