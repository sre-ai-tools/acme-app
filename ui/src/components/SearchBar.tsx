import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

export function SearchBar() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length >= 3) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <form role="search" onSubmit={onSubmit} className="search-bar">
      <label>
        <span className="visually-hidden">Search timelines</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          minLength={3}
          maxLength={200}
        />
      </label>
      <button type="submit">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </form>
  );
}
