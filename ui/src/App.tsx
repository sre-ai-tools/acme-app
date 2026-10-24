import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { completeSignIn, onSessionExpired, signIn, signOut } from "./auth/session";
import { ErrorMessage } from "./components/ErrorMessage";
import { IncidentDetail } from "./pages/IncidentDetail";
import { IncidentForm } from "./pages/IncidentForm";
import { IncidentList } from "./pages/IncidentList";
import { SearchResults } from "./pages/SearchResults";

type AuthState = "checking" | "signed-in" | "signed-out";

export function App() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [error, setError] = useState<unknown>(null);
  // StrictMode runs effects twice in development; the code exchange must happen once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    completeSignIn()
      .then((ok) => setAuth(ok ? "signed-in" : "signed-out"))
      .catch((err) => {
        setError(err);
        setAuth("signed-out");
      });
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        setError(new Error("Your session has expired. Sign in again."));
        setAuth("signed-out");
      }),
    [],
  );

  if (auth === "checking") return <p aria-live="polite">Signing in…</p>;

  if (auth === "signed-out") {
    return (
      <main className="signin">
        <h1>Incident Log</h1>
        <ErrorMessage error={error} />
        <button type="button" onClick={() => void signIn()}>
          Sign in
        </button>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <SignedInApp />
    </BrowserRouter>
  );
}

function SignedInApp() {
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new page's content on navigation, so keyboard and screen-reader users
  // start there instead of on the link they just used.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    main.current?.focus();
  }, [location.pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <Link to="/" className="brand">
          Incident Log
        </Link>
        <button type="button" className="secondary" onClick={signOut}>
          Sign out
        </button>
      </header>
      <main id="main" tabIndex={-1} ref={main}>
        <Routes>
          <Route path="/" element={<Navigate to="/incidents" replace />} />
          <Route path="/incidents" element={<IncidentList />} />
          <Route path="/incidents/new" element={<IncidentForm />} />
          <Route path="/incidents/:incidentId" element={<IncidentDetail />} />
          <Route path="/incidents/:incidentId/edit" element={<IncidentForm />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
