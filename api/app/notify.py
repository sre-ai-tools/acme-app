"""SEV1 notifications to SNS (APP-7)."""

import logging
import os

log = logging.getLogger(__name__)

# infra/alarms.tf alarms on this log message, so a lost page is noticed.
FAILURE_MESSAGE = "sev1_notification_failed"

_client = None


def _sns():
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config

        _client = boto3.client(
            "sns",
            config=Config(
                connect_timeout=2, read_timeout=3, retries={"max_attempts": 2, "mode": "standard"}
            ),
        )
    return _client


def notify_sev1(incident: dict) -> None:
    """Publish a SEV1 notification. Best effort: the incident is already saved, so a failed
    publish is logged, not raised. Without NOTIFY_TOPIC_ARN (local runs, tests) it does nothing.
    """
    topic = os.environ.get("NOTIFY_TOPIC_ARN")
    if not topic:
        return
    message = "\n".join(
        [
            f"SEV1: {incident['title']}",
            f"Status: {incident['status']}",
            f"Owner: {incident['owner'] or 'unassigned'}",
            f"Started: {incident['started_at'].isoformat()}",
            f"Incident: {incident['id']}",
        ]
    )
    try:
        # A fixed subject: SNS rejects non-ASCII and long subjects, and titles are free text.
        _sns().publish(TopicArn=topic, Subject="SEV1 incident", Message=message)
    except Exception:
        log.exception("%s incident_id=%s", FAILURE_MESSAGE, incident["id"])
