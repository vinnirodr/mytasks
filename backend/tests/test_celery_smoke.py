from celery import shared_task


@shared_task
def _ping():
    return "pong"


def test_task_runs_eagerly_under_pytest():
    result = _ping.delay()
    assert result.get() == "pong"
