import datetime

import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment, Membership
from environments.tests.test_environment_api import auth_client
from tasks.models import Occurrence

User = get_user_model()


def _open_occ():
    ana = User.objects.create_user(email="ana@example.com", password="x")
    bob = User.objects.create_user(email="bob@example.com", password="x")
    env = Environment.create_with_admin(name="Casa", env_type="HOUSE", owner=ana)
    Membership.objects.create(environment=env, user=bob, role="MEMBER")
    occ = Occurrence.objects.create(
        environment=env, title="Louça", date=datetime.date(2026, 7, 27), assignee=None
    )
    return env, ana, bob, occ


@pytest.mark.django_db
def test_member_picks_up_open_occurrence():
    env, ana, bob, occ = _open_occ()
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/pickup/")
    assert resp.status_code == 200
    occ.refresh_from_db()
    assert occ.assignee_id == bob.id


@pytest.mark.django_db
def test_cannot_pick_up_already_assigned():
    env, ana, bob, occ = _open_occ()
    occ.assignee = ana
    occ.save(update_fields=["assignee"])
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/pickup/")
    assert resp.status_code == 400
    occ.refresh_from_db()
    assert occ.assignee_id == ana.id


@pytest.mark.django_db
def test_outsider_cannot_pick_up():
    env, ana, bob, occ = _open_occ()
    out = User.objects.create_user(email="out@example.com", password="x")
    resp = auth_client(out).post(f"/api/occurrences/{occ.id}/pickup/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_cannot_pick_up_cancelled_occurrence():
    env, ana, bob, occ = _open_occ()
    occ.is_cancelled = True
    occ.save(update_fields=["is_cancelled"])
    resp = auth_client(bob).post(f"/api/occurrences/{occ.id}/pickup/")
    assert resp.status_code == 400
    occ.refresh_from_db()
    assert occ.assignee_id is None
