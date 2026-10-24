import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import type { SearchResult } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { ErrorMessage } from "../components/ErrorMessage";
import { usePageTitle } from "../usePageTitle";

export function SearchResults() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  usePageTitle(`Search: ${q}`);

  useEffect(() => {
    let current = true;
    setResults(null);
    setError(null);
    api
      .search(q)
      .then((r) => current && setResults(r))
      .catch((e) => current && setError(e));
    return () => {
      current = false;
    };
  }, [q]);

  return (
    <section aria-labelledby="search-heading">
      <h1 id="search-heading">Timelines mentioning “{q}”</h1>
      <ErrorMessage error={error} />
      {results === null && !error && <p aria-live="polite">Searching…</p>}
      {results?.length === 0 && <p>No incidents mention this.</p>}
      {results && results.length > 0 && (
        <ul>
          {results.map((r) => (
            <li key={r.id}>
              <SeverityBadge severity={r.severity} /> <StatusBadge status={r.status} />{" "}
              <Link to={`/incidents/${r.id}`}>{r.title}</Link>
              {r.escalation_url && (
                <>
                  {" "}
                  <a href={r.escalation_url}>Escalate {r.owner_handle}</a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
