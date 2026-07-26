import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
def test_create_user_with_email():
    user = User.objects.create_user(
        email="ana@example.com", password="s3cret!!", display_name="Ana"
    )
    assert user.email == "ana@example.com"
    assert user.display_name == "Ana"
    assert user.check_password("s3cret!!")
    assert user.is_active is True
    assert user.is_staff is False


@pytest.mark.django_db
def test_email_is_required():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password="x")


@pytest.mark.django_db
def test_create_superuser():
    admin = User.objects.create_superuser(email="root@example.com", password="s3cret!!")
    assert admin.is_staff is True
    assert admin.is_superuser is True
