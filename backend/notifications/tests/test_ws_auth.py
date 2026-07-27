import pytest
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from notifications.auth import get_user_from_token

User = get_user_model()


@pytest.mark.django_db(transaction=True)
async def test_valid_token_returns_user():
    ana = await _create_user("ana@example.com")
    token = str(RefreshToken.for_user(ana).access_token)
    resolved = await get_user_from_token(token)
    assert resolved == ana


@pytest.mark.django_db(transaction=True)
async def test_invalid_token_returns_none():
    assert await get_user_from_token("not-a-real-token") is None


@pytest.mark.django_db(transaction=True)
async def test_empty_token_returns_none():
    assert await get_user_from_token("") is None


@database_sync_to_async
def _create_user(email):
    return User.objects.create_user(email=email, password="x")
