"""SEV1 notifications to SNS (APP-7)."""

import logging
import os
import re

log = logging.getLogger(__name__)

# infra/alarms.tf alarms on this log message, so a lost page is noticed.
FAILURE_MESSAGE = "sev1_notification_failed"

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]+")

_client = None


def _sns():
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config

        # Runs inside the request: at most 2 attempts x (1 s connect + 2 s read) = 6 s, well
        # inside the 15 s Lambda timeout.
        _client = boto3.client(
            "sns",
            config=Config(
                connect_timeout=1, read_timeout=2, retries={"max_attempts": 2, "mode": "standard"}
            ),
        )
    return _client


def _one_line(text: str) -> str:
    # Free text must not add lines that look like the page's own fields.
    return _CONTROL_CHARS.sub(" ", text).strip()


def notify_sev1(incident: dict) -> None:
    """Publish a SEV1 notification. Best effort: the incident is already saved, so a failed
    publish is logged, not raised. Without NOTIFY_TOPIC_ARN (local runs, tests) it does nothing.
    """
    topic = os.environ.get("NOTIFY_TOPIC_ARN")
    if not topic:
        return
    message = "\n".join(
        [
            f"SEV1: {_one_line(incident['title'])}",
            f"Status: {incident['status']}",
            f"Owner: {_one_line(incident['owner']) if incident['owner'] else 'unassigned'}",
            f"Started: {incident['started_at'].isoformat()}",
            f"Incident: {incident['id']}",
        ]
    )
    try:
        # A fixed subject: SNS rejects non-ASCII and long subjects, and titles are free text.
        _sns().publish(TopicArn=topic, Subject="SEV1 incident", Message=message)
    except Exception:
        log.exception("%s incident_id=%s", FAILURE_MESSAGE, incident["id"])
