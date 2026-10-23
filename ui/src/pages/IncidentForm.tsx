import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import type { IncidentInput, Severity, Status } from "../api/types";
import { STATUS_LABELS } from "../components/Badges";
import { ErrorMessage } from "../components/ErrorMessage";
import { isoToUtcInput, utcInputToIso } from "../format";

interface FormState {
  title: string;
  severity: string;
  status: Status;
  startedAt: string;
  resolvedAt: string;
}

const EMPTY: FormState = { title: "", severity: "3", status: "open", startedAt: "", resolvedAt: "" };

/** Same rules as the API and the table constraints, checked before submitting. */
export function validate(form: FormState): string | null {
  if (!form.title.trim()) return "Title is required.";
  if (form.title.length > 200) return "Title must be 200 characters or fewer.";
  if (!form.startedAt) return "Start time is required.";
  if (form.status === "resolved" && !form.resolvedAt)
    return "Resolved incidents need a resolve time.";
  if (form.status !== "resolved" && form.resolvedAt)
    return "Only resolved incidents have a resolve time. Clear it or set the status to Resolved.";
  if (form.resolvedAt && form.resolvedAt < form.startedAt)
    return "Resolve time can't be before the start time.";
  return null;
}

function toInput(form: FormState): IncidentInput {
  return {
    title: form.title.trim(),
    severity: Number(form.severity) as Severity,
    status: form.status,
    started_at: utcInputToIso(form.startedAt),
    resolved_at: form.resolvedAt ? utcInputToIso(form.resolvedAt) : null,
  };
}

export function IncidentForm() {
  const { incidentId } = useParams();
  const editing = incidentId !== undefined;
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!incidentId) return;
    api
      .getIncident(incidentId)
      .then((i) =>
        setForm({
          title: i.title,
          severity: String(i.severity),
          status: i.status,
          startedAt: isoToUtcInput(i.started_at),
          resolvedAt: i.resolved_at ? isoToUtcInput(i.resolved_at) : "",
        }),
      )
      .catch(setError);
  }, [incidentId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validate(form);
    if (problem) {
      setError(new Error(problem));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = incidentId
        ? await api.updateIncident(incidentId, toInput(form))
        : await api.createIncident(toInput(form));
      navigate(`/incidents/${saved.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="form-heading">
      <h1 id="form-heading">{editing ? "Edit incident" : "New incident"}</h1>
      <form onSubmit={onSubmit} noValidate>
        <label>
          Title
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            maxLength={200}
            required
          />
        </label>
        <label>
          Severity
          <select value={form.severity} onChange={(e) => update("severity", e.target.value)}>
            {[1, 2, 3, 4].map((s) => (
              <option key={s} value={s}>
                SEV{s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={form.status} onChange={(e) => update("status", e.target.value as Status)}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Started (UTC)
          <input
            type="datetime-local"
            value={form.startedAt}
            onChange={(e) => update("startedAt", e.target.value)}
            required
          />
        </label>
        <label>
          Resolved (UTC)
          <input
            type="datetime-local"
            value={form.resolvedAt}
            onChange={(e) => update("resolvedAt", e.target.value)}
          />
        </label>

        <ErrorMessage error={error} />

        <div className="actions">
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create incident"}
          </button>
          <button type="button" className="secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
