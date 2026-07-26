import pytest
from django.contrib.auth import get_user_model

from environments.models import Environment
from tasks.models import TaskDefinition

User = get_user_model()


@pytest.fixture
def environment(db):
    owner = User.objects.create_user(email="ana@example.com", password="x")
    return Environment.create_with_admin(name="Casa", env_type=Environment.Type.HOUSE, owner=owner)


def test_task_definition_belongs_to_environment(environment):
    td = TaskDefinition.objects.create(environment=environment, name="Lavar louça")
    assert td.name == "Lavar louça"
    assert td.icon == ""
    assert td.environment == environment
    assert list(environment.task_definitions.all()) == [td]
