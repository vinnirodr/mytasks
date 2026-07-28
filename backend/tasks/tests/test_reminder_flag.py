import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from tasks.models import Occurrence

User = get_user_model()


@pytest.mark.django_db
def test_reminder_sent_defaults_false():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    occ = Occurrence.objects.create(environment=env, title="Louça", date=datetime.date(2026, 7, 27))
    assert occ.reminder_sent is False
