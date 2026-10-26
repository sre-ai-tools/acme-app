import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import type { SearchResult } from "../api/types";
import { SearchBar } from "../components/SearchBar";
import { SearchResults } from "./SearchResults";

const RESULT: SearchResult = {
  id: "i1",
  title: "Checkout down",
  severity: 1,
  status: "open",
  started_at: "2026-10-01T14:00:00Z",
  resolved_at: null,
  owner: "Alice",
  created_at: "2026-10-01T14:00:00Z",
  updated_at: "2026-10-01T14:00:00Z",
  owner_handle: "alice",
};

function renderSearch(q: string) {
  return render(
    <MemoryRouter initialEntries={[`/search?q=${q}`]}>
      <Routes>
        <Route path="/search" element={<SearchResults />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SearchResults", () => {
  it("links only to incidents, never to an external escalation URL", async () => {
    // Even if an older API still sent a credential-bearing URL, the page must not render it.
    const legacy = { ...RESULT, escalation_url: "https://pager.example.com/escalate?token=x" };
    vi.spyOn(api, "search").mockResolvedValue([legacy as SearchResult]);
    renderSearch("pool");

    expect(await screen.findByRole("link", { name: "Checkout down" })).toHaveAttribute(
      "href",
      "/incidents/i1",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(document.body.innerHTML).not.toContain("token=");
  });

  it("doesn't call the API for a query under 3 characters", async () => {
    const search = vi.spyOn(api, "search");
    renderSearch("ab");
    expect(await screen.findByText("Type at least 3 characters to search.")).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("SearchResults announcements", () => {
  it("keeps one live region mounted and announces the result count", async () => {
    let resolve!: (r: SearchResult[]) => void;
    vi.spyOn(api, "search").mockReturnValue(new Promise((r) => (resolve = r)));
    const { container } = renderSearch("pool");

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent("Searching…");
    resolve([RESULT]);
    await screen.findByRole("link", { name: "Checkout down" });
    expect(container.querySelector('[aria-live="polite"]')).toBe(live);
    expect(live).toHaveTextContent("1 incident found.");
  });
});

describe("SearchBar", () => {
  it("has a search button with an accessible name", () => {
    render(
      <MemoryRouter>
        <SearchBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search timelines" })).toBeInTheDocument();
  });

  it("explains a too-short search instead of doing nothing", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<SearchBar />} />
          <Route path="/search" element={<p>results page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    const box = screen.getByRole("searchbox", { name: "Search timelines" });
    await userEvent.type(box, "ab");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Type at least 3 characters to search.");
    expect(screen.queryByText("results page")).not.toBeInTheDocument();
  });
});
