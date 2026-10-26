// Mirrors api/app/models.py.

export type Status = "open" | "mitigated" | "resolved";
export type Severity = 1 | 2 | 3 | 4;
export type EventKind = "detection" | "action" | "communication" | "note";

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: Status;
  started_at: string;
  resolved_at: string | null;
  owner: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentPage {
  items: Incident[];
  next_cursor: string | null;
}

export interface IncidentInput {
  title: string;
  severity: Severity;
  status: Status;
  started_at: string;
  resolved_at: string | null;
  owner: string | null;
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  occurred_at: string;
  kind: EventKind;
  body: string;
  created_at: string;
}

export interface Postmortem {
  incident_id: string;
  summary: string;
  impact: string;
  root_cause: string;
  created_at: string;
  updated_at: string;
}

export interface ActionItem {
  id: string;
  incident_id: string;
  description: string;
  owner: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListFilters {
  status?: Status;
  severity?: Severity;
  cursor?: string;
  limit?: number;
}

export interface SearchResult extends Incident {
  owner_handle: string | null;
}
