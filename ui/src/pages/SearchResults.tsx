import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import type { SearchResult } from "../api/types";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { ErrorMessage } from "../components/ErrorMessage";
import { usePageTitle } from "../usePageTitle";

const MIN_QUERY = 3;

export function SearchResults() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  // The API needs at least 3 characters; a shorter query would only come back as a 422.
  const tooShort = q.trim().length < MIN_QUERY;
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  usePageTitle(`Search: ${q}`);

  let status = "";
  if (!tooShort && !error) {
    if (results === null) status = "Searching…";
    else if (results.length === 0) status = "No incidents mention this.";
    else status = `${results.length} ${results.length === 1 ? "incident" : "incidents"} found.`;
  }

  useEffect(() => {
    let current = true;
    setResults(null);
    setError(null);
    if (tooShort) return;
    api
      .search(q)
      .then((r) => current && setResults(r))
      .catch((e) => current && setError(e));
    return () => {
      current = false;
    };
  }, [q, tooShort]);

  return (
    <section aria-labelledby="search-heading">
      <h1 id="search-heading">Timelines mentioning “{q}”</h1>
      <ErrorMessage error={error} />
      {tooShort && <p>Type at least {MIN_QUERY} characters to search.</p>}
      {/* Always mounted, so screen readers announce each change of status. */}
      <p aria-live="polite" className="status-line">
        {status}
      </p>
      {results && results.length > 0 && (
        <ul>
          {results.map((r) => (
            <li key={r.id}>
              <SeverityBadge severity={r.severity} /> <StatusBadge status={r.status} />{" "}
              <Link to={`/incidents/${r.id}`}>{r.title}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
