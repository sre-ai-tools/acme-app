import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import type { Incident } from "../api/types";
import { IncidentDetail } from "./IncidentDetail";
import { IncidentForm, validate } from "./IncidentForm";
import { IncidentList } from "./IncidentList";

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "i1",
    title: "Checkout API returning 503s",
    severity: 1,
    status: "open",
    started_at: "2026-10-01T14:02:00Z",
    resolved_at: null,
    owner: null,
    created_at: "2026-10-01T14:03:00Z",
    updated_at: "2026-10-01T14:03:00Z",
    ...overrides,
  };
}

function renderAt(path: string, routePath: string, element: JSX.Element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("IncidentList", () => {
  it("shows severity as text, filters through the URL, and pages with the cursor", async () => {
    const list = vi
      .spyOn(api, "listIncidents")
      .mockResolvedValueOnce({ items: [incident()], next_cursor: "c1" })
      .mockResolvedValueOnce({ items: [incident({ id: "i2", title: "Search slow", severity: 3 })], next_cursor: null })
      .mockResolvedValue({ items: [], next_cursor: null });

    renderAt("/incidents", "/incidents", <IncidentList />);

    const row = await screen.findByRole("row", { name: /Checkout API/ });
    expect(within(row).getByText("SEV1")).toBeInTheDocument();
    expect(within(row).getByText("Open")).toBeInTheDocument();
    expect(within(row).getByText("Unassigned")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Search slow")).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "c1" }));
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status"), "resolved");
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "resolved", cursor: undefined })),
    );
    expect(await screen.findByText("No incidents match these filters.")).toBeInTheDocument();
  });

  it("announces errors", async () => {
    const { ApiError } = await import("../api/client");
    vi.spyOn(api, "listIncidents").mockRejectedValue(new ApiError(0, "network_error", "Could not reach the server."));
    renderAt("/incidents", "/incidents", <IncidentList />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server.");
  });
});

describe("IncidentForm validation", () => {
  const base = { title: "x", severity: "2", status: "open" as const, startedAt: "2026-10-01T14:00", resolvedAt: "", owner: "" };

  it("mirrors the API's resolve rules and names the failing field", () => {
    expect(validate(base)).toBeNull();
    expect(validate({ ...base, title: "  " })).toEqual({ field: "title", message: expect.stringMatching(/Title is required/) });
    expect(validate({ ...base, startedAt: "" })?.field).toBe("startedAt");
    expect(validate({ ...base, status: "resolved" })?.message).toMatch(/need a resolve time/);
    expect(validate({ ...base, resolvedAt: "2026-10-01T15:00" })?.message).toMatch(/Only resolved incidents/);
    expect(validate({ ...base, status: "resolved", resolvedAt: "2026-10-01T13:00" })).toEqual({
      field: "resolvedAt",
      message: expect.stringMatching(/before the start/),
    });
    expect(validate({ ...base, status: "resolved", resolvedAt: "2026-10-01T15:00" })).toBeNull();
  });

  it("marks and focuses the failing field, and doesn't call the API", async () => {
    const create = vi.spyOn(api, "createIncident");
    renderAt("/incidents/new", "/incidents/new", <IncidentForm />);
    expect(document.title).toBe("New incident · Incident Log");

    await userEvent.click(screen.getByRole("button", { name: "Create incident" }));

    const title = screen.getByLabelText("Title");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAccessibleDescription("Title is required.");
    expect(title).toHaveFocus();
    expect(create).not.toHaveBeenCalled();
  });

  it("shows a loading state, not an empty form, while an incident loads for editing", async () => {
    let resolve!: (i: Incident) => void;
    vi.spyOn(api, "getIncident").mockReturnValue(new Promise((r) => (resolve = r)));
    renderAt("/incidents/i1/edit", "/incidents/:incidentId/edit", <IncidentForm />);

    expect(screen.getByText("Loading incident…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();

    resolve(incident());
    expect(await screen.findByLabelText("Title")).toHaveValue("Checkout API returning 503s");
  });
});

describe("IncidentList ordering", () => {
  it("ignores a slow response for a filter that has since changed", async () => {
    let resolveFirst!: (p: { items: Incident[]; next_cursor: null }) => void;
    vi.spyOn(api, "listIncidents")
      .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ items: [incident({ id: "r1", title: "Resolved one", status: "resolved" })], next_cursor: null });

    renderAt("/incidents", "/incidents", <IncidentList />);
    await userEvent.selectOptions(screen.getByLabelText("Status"), "resolved");
    expect(await screen.findByText("Resolved one")).toBeInTheDocument();

    // The first, unfiltered request finishes last; its results must not replace the newer ones.
    resolveFirst({ items: [incident({ id: "old", title: "Stale result" })], next_cursor: null });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
    expect(screen.getByText("Resolved one")).toBeInTheDocument();
  });
});

describe("IncidentDetail", () => {
  it("renders the timeline in time order and toggles action items by keyboard", async () => {
    vi.spyOn(api, "getIncident").mockResolvedValue(incident());
    vi.spyOn(api, "listEvents").mockResolvedValue([
      { id: "e1", incident_id: "i1", occurred_at: "2026-10-01T14:02:00Z", kind: "detection", body: "Alarm fired", created_at: "" },
    ]);
    vi.spyOn(api, "getPostmortem").mockRejectedValue(
      new (await import("../api/client")).ApiError(404, "not_found", "Postmortem not found"),
    );
    vi.spyOn(api, "listActionItems").mockResolvedValue([
      { id: "a1", incident_id: "i1", description: "Add alarm", owner: "oncall", due_date: null, done: false, created_at: "", updated_at: "" },
    ]);
    const update = vi.spyOn(api, "updateActionItem").mockResolvedValue({
      id: "a1", incident_id: "i1", description: "Add alarm", owner: "oncall", due_date: null, done: true, created_at: "", updated_at: "",
    });
    const addEvent = vi.spyOn(api, "addEvent").mockResolvedValue({
      id: "e0", incident_id: "i1", occurred_at: "2026-10-01T14:00:00Z", kind: "note", body: "Earlier note", created_at: "",
    });

    renderAt("/incidents/i1", "/incidents/:incidentId", <IncidentDetail />);

    expect(await screen.findByRole("heading", { level: 1, name: /Checkout API/ })).toBeInTheDocument();
    // A missing postmortem is normal, not an error.
    expect(await screen.findByRole("button", { name: "Save postmortem" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const timeline = screen.getByRole("region", { name: "Timeline" });
    expect(await within(timeline).findByText("Alarm fired")).toBeInTheDocument();

    const form = screen.getByRole("form", { name: "Add timeline event" });
    await userEvent.type(within(form).getByLabelText("Time (UTC)"), "2026-10-01T14:00");
    await userEvent.type(within(form).getByLabelText("What happened"), "Earlier note");
    await userEvent.click(within(form).getByRole("button", { name: "Add event" }));
    expect(addEvent).toHaveBeenCalledWith("i1", { occurred_at: "2026-10-01T14:00:00.000Z", kind: "note", body: "Earlier note" });
    await waitFor(() => {
      const entries = within(timeline).getAllByRole("listitem");
      expect(entries.map((li) => li.textContent)).toEqual([
        expect.stringContaining("Earlier note"),
        expect.stringContaining("Alarm fired"),
      ]);
    });

    const checkbox = screen.getByRole("checkbox", { name: "Add alarm" });
    checkbox.focus();
    await userEvent.keyboard(" ");
    expect(update).toHaveBeenCalledWith("a1", { done: true });
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Add alarm" })).toBeChecked());
  });
});

describe("IncidentForm owner", () => {
  it("sends a blank owner as unassigned and a filled one trimmed", async () => {
    const create = vi.spyOn(api, "createIncident").mockResolvedValue(incident({ id: "new" }));
    renderAt("/incidents/new", "/incidents/new", <IncidentForm />);

    await userEvent.type(screen.getByLabelText("Title"), "Search down");
    await userEvent.type(screen.getByLabelText("Started (UTC)"), "2026-10-01T14:00");
    await userEvent.click(screen.getByRole("button", { name: "Create incident" }));
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ owner: null }));
  });

  it("trims the owner", async () => {
    const create = vi.spyOn(api, "createIncident").mockResolvedValue(incident({ id: "new" }));
    renderAt("/incidents/new", "/incidents/new", <IncidentForm />);

    await userEvent.type(screen.getByLabelText("Title"), "Search down");
    await userEvent.type(screen.getByLabelText("On-call owner"), "  bob-oncall ");
    await userEvent.type(screen.getByLabelText("Started (UTC)"), "2026-10-01T14:00");
    await userEvent.click(screen.getByRole("button", { name: "Create incident" }));
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ owner: "bob-oncall" }));
  });
});
