import type { Severity, Status } from "../api/types";

// Severity and status are always written out as text; colour is only a second cue.

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge sev sev-${severity}`}>SEV{severity}</span>;
}

const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  mitigated: "Mitigated",
  resolved: "Resolved",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge status status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export { STATUS_LABELS };
