import datetime

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from environments.models import Environment
from tasks.models import Occurrence

User = get_user_model()


@pytest.mark.django_db
def test_command_marks_yesterday_pending_as_missed():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    yesterday = datetime.date(2020, 1, 1)  # safely in the past for any timezone
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=yesterday, time=datetime.time(20, 0)
    )
    call_command("refresh_statuses")
    occ.refresh_from_db()
    assert occ.status == Occurrence.Status.MISSED
