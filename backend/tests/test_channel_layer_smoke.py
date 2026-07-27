import pytest
from channels.layers import get_channel_layer


@pytest.mark.asyncio
async def test_channel_layer_group_send_receive():
    layer = get_channel_layer()
    await layer.group_add("smoke", "chan1")
    await layer.group_send("smoke", {"type": "broadcast", "payload": {"n": 1}})
    message = await layer.receive("chan1")
    assert message == {"type": "broadcast", "payload": {"n": 1}}
