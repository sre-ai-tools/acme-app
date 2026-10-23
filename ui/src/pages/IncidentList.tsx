import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import type { Incident, Severity, Status } from "../api/types";
import { SeverityBadge, STATUS_LABELS, StatusBadge } from "../components/Badges";
import { ErrorMessage } from "../components/ErrorMessage";
import { formatUtc } from "../format";
import { usePageTitle } from "../usePageTitle";

const PAGE_SIZE = 20;

export function IncidentList() {
  // Filters live in the URL, so a filtered list can be bookmarked and shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get("status") || undefined) as Status | undefined;
  const severity = searchParams.get("severity")
    ? (Number(searchParams.get("severity")) as Severity)
    : undefined;

  const [items, setItems] = useState<Incident[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  usePageTitle("Incidents");

  // Only the latest request may update the list: a slow response for an old filter or page
  // must not overwrite or append to newer results.
  const latestRequest = useRef(0);

  const load = useCallback(
    async (after?: string) => {
      const request = ++latestRequest.current;
      setLoading(true);
      setError(null);
      try {
        const page = await api.listIncidents({ status, severity, cursor: after, limit: PAGE_SIZE });
        if (request !== latestRequest.current) return;
        setItems((prev) => (after ? [...prev, ...page.items] : page.items));
        setCursor(page.next_cursor);
      } catch (e) {
        if (request === latestRequest.current) setError(e);
      } finally {
        if (request === latestRequest.current) setLoading(false);
      }
    },
    [status, severity],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function setFilter(name: "status" | "severity", value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next);
  }

  return (
    <section aria-labelledby="incidents-heading">
      <div className="page-header">
        <h1 id="incidents-heading">Incidents</h1>
        <Link className="button" to="/incidents/new">
          New incident
        </Link>
      </div>

      <div className="filters">
        <label>
          Status
          <select value={status ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select
            value={severity ?? ""}
            onChange={(e) => setFilter("severity", e.target.value)}
          >
            <option value="">All</option>
            {[1, 2, 3, 4].map((s) => (
              <option key={s} value={s}>
                SEV{s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ErrorMessage error={error} />

      {items.length > 0 ? (
        <table>
          <caption className="visually-hidden">Incidents, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Severity</th>
              <th scope="col">Title</th>
              <th scope="col">Status</th>
              <th scope="col">Started</th>
            </tr>
          </thead>
          <tbody>
            {items.map((incident) => (
              <tr key={incident.id}>
                <td>
                  <SeverityBadge severity={incident.severity} />
                </td>
                <td>
                  <Link to={`/incidents/${incident.id}`}>{incident.title}</Link>
                </td>
                <td>
                  <StatusBadge status={incident.status} />
                </td>
                <td>{formatUtc(incident.started_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !loading && !error && <p>No incidents match these filters.</p>
      )}

      <p aria-live="polite" className="status-line">
        {loading ? "Loading incidents…" : ""}
      </p>

      {cursor && !loading && (
        <button type="button" onClick={() => void load(cursor)}>
          Load more
        </button>
      )}
    </section>
  );
}
