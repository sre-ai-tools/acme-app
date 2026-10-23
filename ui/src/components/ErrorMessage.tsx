import { ApiError } from "../api/client";

/** An error announced to screen readers as soon as it appears. */
export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof ApiError || error instanceof Error ? error.message : "Something went wrong.";
  return (
    <p role="alert" className="error">
      {message}
    </p>
  );
}
