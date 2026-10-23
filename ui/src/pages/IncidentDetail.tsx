import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, ApiError } from "../api/client";
import type { ActionItem, EventKind, Incident, IncidentEvent, Postmortem } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatUtc, utcInputToIso } from "../format";
import { usePageTitle } from "../usePageTitle";

const EVENT_KINDS: EventKind[] = ["detection", "action", "communication", "note"];

export function IncidentDetail() {
  const { incidentId = "" } = useParams();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState<unknown>(null);
  usePageTitle(incident?.title);

  useEffect(() => {
    api.getIncident(incidentId).then(setIncident).catch(setError);
  }, [incidentId]);

  if (error) return <ErrorMessage error={error} />;
  if (!incident) return <p aria-live="polite">Loading incident…</p>;

  return (
    <article aria-labelledby="incident-heading">
      <div className="page-header">
        <h1 id="incident-heading">{incident.title}</h1>
        <Link className="button secondary" to={`/incidents/${incident.id}/edit`}>
          Edit
        </Link>
      </div>
      <p className="meta">
        <SeverityBadge severity={incident.severity} /> <StatusBadge status={incident.status} />{" "}
        Owner {incident.owner ?? <span className="meta">Unassigned</span>} · Started{" "}
        {formatUtc(incident.started_at)}
        {incident.resolved_at && <> · Resolved {formatUtc(incident.resolved_at)}</>}
      </p>

      <Timeline incidentId={incident.id} />
      <PostmortemSection incidentId={incident.id} />
      <ActionItems incidentId={incident.id} />
    </article>
  );
}

function Timeline({ incidentId }: { incidentId: string }) {
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState({ occurredAt: "", kind: "note" as EventKind, body: "" });

  useEffect(() => {
    api.listEvents(incidentId).then(setEvents).catch(setError);
  }, [incidentId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!form.occurredAt || !form.body.trim()) {
      setError(new Error("Time and description are required."));
      return;
    }
    try {
      const added = await api.addEvent(incidentId, {
        occurred_at: utcInputToIso(form.occurredAt),
        kind: form.kind,
        body: form.body.trim(),
      });
      // Keep time order, which the API also returns.
      setEvents((prev) =>
        [...prev, added].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)),
      );
      setForm({ occurredAt: "", kind: "note", body: "" });
      setError(null);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">Timeline</h2>
      {events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <ol className="timeline">
          {events.map((event) => (
            <li key={event.id}>
              <time dateTime={event.occurred_at}>{formatUtc(event.occurred_at)}</time>{" "}
              <span className="kind">{event.kind}</span> {event.body}
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={onAdd} className="inline-form" aria-label="Add timeline event" noValidate>
        <label>
          Time (UTC)
          <input
            type="datetime-local"
            value={form.occurredAt}
            onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
          />
        </label>
        <label>
          Kind
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })}
          >
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          What happened
          <input
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            maxLength={10000}
          />
        </label>
        <button type="submit">Add event</button>
      </form>
      <ErrorMessage error={error} />
    </section>
  );
}

function PostmortemSection({ incidentId }: { incidentId: string }) {
  const [postmortem, setPostmortem] = useState({ summary: "", impact: "", root_cause: "" });
  const [saved, setSaved] = useState<Postmortem | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .getPostmortem(incidentId)
      .then((p) => {
        setSaved(p);
        setPostmortem({ summary: p.summary, impact: p.impact, root_cause: p.root_cause });
      })
      // No postmortem yet is the normal state for an open incident.
      .catch((err) => (err instanceof ApiError && err.status === 404 ? null : setError(err)));
  }, [incidentId]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!postmortem.summary.trim() || !postmortem.impact.trim() || !postmortem.root_cause.trim()) {
      setError(new Error("Summary, impact and root cause are all required."));
      return;
    }
    try {
      setSaved(await api.putPostmortem(incidentId, postmortem));
      setError(null);
      setMessage("Postmortem saved.");
    } catch (err) {
      setError(err);
    }
  }

  const field = (key: keyof typeof postmortem, label: string) => (
    <label>
      {label}
      <textarea
        value={postmortem[key]}
        onChange={(e) => {
          setPostmortem({ ...postmortem, [key]: e.target.value });
          setMessage("");
        }}
        rows={3}
        maxLength={20000}
      />
    </label>
  );

  return (
    <section aria-labelledby="postmortem-heading">
      <h2 id="postmortem-heading">Postmortem</h2>
      <form onSubmit={onSave} noValidate>
        {field("summary", "Summary")}
        {field("impact", "Impact")}
        {field("root_cause", "Root cause")}
        <button type="submit">{saved ? "Update postmortem" : "Save postmortem"}</button>
      </form>
      <p aria-live="polite" className="status-line">
        {message}
      </p>
      <ErrorMessage error={error} />
    </section>
  );
}

function ActionItems({ incidentId }: { incidentId: string }) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState({ description: "", owner: "", dueDate: "" });

  useEffect(() => {
    api.listActionItems(incidentId).then(setItems).catch(setError);
  }, [incidentId]);

  const toggle = useCallback(async (item: ActionItem) => {
    try {
      const updated = await api.updateActionItem(item.id, { done: !item.done });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setError(err);
    }
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || !form.owner.trim()) {
      setError(new Error("Description and owner are required."));
      return;
    }
    try {
      const added = await api.addActionItem(incidentId, {
        description: form.description.trim(),
        owner: form.owner.trim(),
        due_date: form.dueDate || null,
      });
      setItems((prev) => [...prev, added]);
      setForm({ description: "", owner: "", dueDate: "" });
      setError(null);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <section aria-labelledby="actions-heading">
      <h2 id="actions-heading">Action items</h2>
      {items.length === 0 ? (
        <p>No action items yet.</p>
      ) : (
        <ul className="action-items">
          {items.map((item) => (
            <li key={item.id}>
              <label>
                <input type="checkbox" checked={item.done} onChange={() => void toggle(item)} />
                <span className={item.done ? "done" : undefined}>{item.description}</span>
              </label>{" "}
              <span className="meta">
                {item.owner}
                {item.due_date && <> · due {item.due_date}</>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAdd} className="inline-form" aria-label="Add action item" noValidate>
        <label className="grow">
          Description
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={2000}
          />
        </label>
        <label>
          Owner
          <input
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
            maxLength={200}
          />
        </label>
        <label>
          Due
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </label>
        <button type="submit">Add action item</button>
      </form>
      <ErrorMessage error={error} />
    </section>
  );
}
