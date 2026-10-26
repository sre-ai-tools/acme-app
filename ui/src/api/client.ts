// Typed client for the Incident Log API (design D3).

import { accessToken, sessionExpired } from "../auth/session";
import { config } from "../config";
import type {
  ActionItem,
  EventKind,
  Incident,
  IncidentEvent,
  IncidentInput,
  IncidentPage,
  ListFilters,
  Postmortem,
  SearchResult,
} from "./types";

/** An error response in the API's {"error": {"code", "message"}} shape, or a network failure. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = accessToken();
  if (!token) {
    sessionExpired();
    throw new ApiError(401, "unauthorized", "Your session has expired. Sign in again.");
  }

  let resp: Response;
  try {
    resp = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server. Check your connection.");
  }

  if (resp.ok) return (await resp.json()) as T;
  if (resp.status === 401) sessionExpired();
  const error = await resp
    .json()
    .then((b: { error?: { code?: string; message?: string } }) => b.error)
    .catch(() => undefined);
  throw new ApiError(resp.status, error?.code ?? "http_error", error?.message ?? resp.statusText);
}

const id = encodeURIComponent;

export const api = {
  search: (q: string): Promise<SearchResult[]> =>
    request("GET", `/search?${new URLSearchParams({ q })}`),
  listIncidents(filters: ListFilters = {}): Promise<IncidentPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const query = params.toString() ? `?${params}` : "";
    return request("GET", `/incidents${query}`);
  },
  getIncident: (incidentId: string): Promise<Incident> =>
    request("GET", `/incidents/${id(incidentId)}`),
  createIncident: (input: IncidentInput): Promise<Incident> => request("POST", "/incidents", input),
  updateIncident: (incidentId: string, changes: Partial<IncidentInput>): Promise<Incident> =>
    request("PATCH", `/incidents/${id(incidentId)}`, changes),

  listEvents: (incidentId: string): Promise<IncidentEvent[]> =>
    request("GET", `/incidents/${id(incidentId)}/events`),
  addEvent: (
    incidentId: string,
    event: { occurred_at: string; kind: EventKind; body: string },
  ): Promise<IncidentEvent> => request("POST", `/incidents/${id(incidentId)}/events`, event),

  getPostmortem: (incidentId: string): Promise<Postmortem> =>
    request("GET", `/incidents/${id(incidentId)}/postmortem`),
  putPostmortem: (
    incidentId: string,
    postmortem: { summary: string; impact: string; root_cause: string },
  ): Promise<Postmortem> => request("PUT", `/incidents/${id(incidentId)}/postmortem`, postmortem),

  listActionItems: (incidentId: string): Promise<ActionItem[]> =>
    request("GET", `/incidents/${id(incidentId)}/action-items`),
  addActionItem: (
    incidentId: string,
    item: { description: string; owner: string; due_date: string | null },
  ): Promise<ActionItem> => request("POST", `/incidents/${id(incidentId)}/action-items`, item),
  updateActionItem: (
    itemId: string,
    changes: Partial<Pick<ActionItem, "description" | "owner" | "due_date" | "done">>,
  ): Promise<ActionItem> => request("PATCH", `/action-items/${id(itemId)}`, changes),
};
