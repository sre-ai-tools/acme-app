import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import type { IncidentInput, Severity, Status } from "../api/types";
import { STATUS_LABELS } from "../components/Badges";
import { ErrorMessage } from "../components/ErrorMessage";
import { isoToUtcInput, utcInputToIso } from "../format";
import { usePageTitle } from "../usePageTitle";

interface FormState {
  title: string;
  severity: string;
  status: Status;
  startedAt: string;
  resolvedAt: string;
  owner: string;
}

type Field = keyof FormState;

export interface Problem {
  field: Field;
  message: string;
}

const EMPTY: FormState = {
  title: "",
  severity: "3",
  status: "open",
  startedAt: "",
  resolvedAt: "",
  owner: "",
};
const ERROR_ID = "incident-form-error";

/** Same rules as the API and the table constraints, checked before submitting. */
export function validate(form: FormState): Problem | null {
  if (!form.title.trim()) return { field: "title", message: "Title is required." };
  if (form.title.length > 200)
    return { field: "title", message: "Title must be 200 characters or fewer." };
  if (form.owner.trim().length > 200)
    return { field: "owner", message: "Owner must be 200 characters or fewer." };
  if (!form.startedAt) return { field: "startedAt", message: "Start time is required." };
  if (form.status === "resolved" && !form.resolvedAt)
    return { field: "resolvedAt", message: "Resolved incidents need a resolve time." };
  if (form.status !== "resolved" && form.resolvedAt)
    return {
      field: "resolvedAt",
      message: "Only resolved incidents have a resolve time. Clear it or set the status to Resolved.",
    };
  if (form.resolvedAt && form.resolvedAt < form.startedAt)
    return { field: "resolvedAt", message: "Resolve time can't be before the start time." };
  return null;
}

function toInput(form: FormState): IncidentInput {
  return {
    title: form.title.trim(),
    severity: Number(form.severity) as Severity,
    status: form.status,
    started_at: utcInputToIso(form.startedAt),
    resolved_at: form.resolvedAt ? utcInputToIso(form.resolvedAt) : null,
    // Blank means unassigned.
    owner: form.owner.trim() || null,
  };
}

export function IncidentForm() {
  const { incidentId } = useParams();
  const editing = incidentId !== undefined;
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState | null>(editing ? null : EMPTY);
  const [error, setError] = useState<unknown>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);
  usePageTitle(editing ? "Edit incident" : "New incident");

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
          owner: i.owner ?? "",
        }),
      )
      .catch(setError);
  }, [incidentId]);

  // Don't show an editable empty form while the incident loads, or if it failed to.
  if (!form) {
    return error ? <ErrorMessage error={error} /> : <p aria-live="polite">Loading incident…</p>;
  }

  function update<K extends Field>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  // Ties the error message to the field it is about, for screen readers.
  function invalidProps(field: Field) {
    return problem?.field === field
      ? { "aria-invalid": true as const, "aria-describedby": ERROR_ID }
      : {};
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const found = validate(form);
    setProblem(found);
    if (found) {
      setError(new Error(found.message));
      document.getElementById(`incident-${found.field}`)?.focus();
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
            id="incident-title"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            maxLength={200}
            required
            {...invalidProps("title")}
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
          On-call owner
          <input
            id="incident-owner"
            value={form.owner}
            onChange={(e) => update("owner", e.target.value)}
            maxLength={200}
            placeholder="Unassigned"
            {...invalidProps("owner")}
          />
        </label>
        <label>
          Started (UTC)
          <input
            id="incident-startedAt"
            type="datetime-local"
            value={form.startedAt}
            onChange={(e) => update("startedAt", e.target.value)}
            required
            {...invalidProps("startedAt")}
          />
        </label>
        <label>
          Resolved (UTC)
          <input
            id="incident-resolvedAt"
            type="datetime-local"
            value={form.resolvedAt}
            onChange={(e) => update("resolvedAt", e.target.value)}
            {...invalidProps("resolvedAt")}
          />
        </label>

        <ErrorMessage error={error} id={ERROR_ID} />

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
