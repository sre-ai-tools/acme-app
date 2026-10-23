// Display and form helpers. Times are shown and entered in UTC, the convention for incidents.

export function formatUtc(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** "2026-10-01T14:05" from a datetime-local input, read as UTC, to an ISO timestamp. */
export function utcInputToIso(value: string): string {
  return new Date(`${value}:00Z`).toISOString();
}

/** An ISO timestamp to the "YYYY-MM-DDTHH:MM" a datetime-local input expects, in UTC. */
export function isoToUtcInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}
