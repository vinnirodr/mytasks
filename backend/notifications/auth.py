from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token):
    """Return the User for a valid simplejwt access token, else None."""
    if not token:
        return None
    try:
        access = AccessToken(token)
    except TokenError:
        return None
    try:
        return User.objects.get(id=access["user_id"])
    except User.DoesNotExist, KeyError:
        return None
