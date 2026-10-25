import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

const HINT_ID = "search-bar-hint";

export function SearchBar() {
  const [q, setQ] = useState("");
  const [tooShort, setTooShort] = useState(false);
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) {
      setTooShort(true);
      return;
    }
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <form role="search" onSubmit={onSubmit} className="search-bar">
      <label>
        <span className="visually-hidden">Search timelines</span>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setTooShort(false);
          }}
          minLength={3}
          maxLength={200}
          aria-invalid={tooShort || undefined}
          aria-describedby={tooShort ? HINT_ID : undefined}
        />
      </label>
      {tooShort && (
        <p id={HINT_ID} role="alert" className="error">
          Type at least 3 characters to search.
        </p>
      )}
      <button type="submit" aria-label="Search">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </form>
  );
}
