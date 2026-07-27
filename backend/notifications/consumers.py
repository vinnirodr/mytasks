from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from environments.models import Environment
from environments.permissions import get_membership
from notifications.auth import get_user_from_token


class EnvironmentConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        token = self._token_from_subprotocols()
        user = await get_user_from_token(token)
        if user is None:
            await self.close()
            return
        env_id = self.scope["url_route"]["kwargs"]["env_id"]
        if await self._get_membership(user, env_id) is None:
            await self.close()
            return
        self.group_name = f"env_{env_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept(subprotocol="jwt")

    async def disconnect(self, code):
        group_name = getattr(self, "group_name", None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def broadcast(self, event):
        await self.send_json(event["payload"])

    def _token_from_subprotocols(self):
        subprotocols = self.scope.get("subprotocols", [])
        if len(subprotocols) >= 2 and subprotocols[0] == "jwt":
            return subprotocols[1]
        return None

    @database_sync_to_async
    def _get_membership(self, user, env_id):
        try:
            environment = Environment.objects.get(id=env_id)
        except Environment.DoesNotExist:
            return None
        return get_membership(user, environment)
