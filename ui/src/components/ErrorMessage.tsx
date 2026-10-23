import { ApiError } from "../api/client";

/** An error announced to screen readers as soon as it appears. */
export function ErrorMessage({ error, id }: { error: unknown; id?: string }) {
  if (!error) return null;
  const message =
    error instanceof ApiError || error instanceof Error ? error.message : "Something went wrong.";
  return (
    <p role="alert" className="error" id={id}>
      {message}
    </p>
  );
}
