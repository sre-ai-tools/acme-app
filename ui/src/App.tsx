import { useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import { completeSignIn, signIn, signOut } from "./auth/session";
import { ErrorMessage } from "./components/ErrorMessage";
import { IncidentDetail } from "./pages/IncidentDetail";
import { IncidentForm } from "./pages/IncidentForm";
import { IncidentList } from "./pages/IncidentList";

type AuthState = "checking" | "signed-in" | "signed-out";

export function App() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    completeSignIn()
      .then((ok) => setAuth(ok ? "signed-in" : "signed-out"))
      .catch((err) => {
        setError(err);
        setAuth("signed-out");
      });
  }, []);

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
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Navigate to="/incidents" replace />} />
          <Route path="/incidents" element={<IncidentList />} />
          <Route path="/incidents/new" element={<IncidentForm />} />
          <Route path="/incidents/:incidentId" element={<IncidentDetail />} />
          <Route path="/incidents/:incidentId/edit" element={<IncidentForm />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
