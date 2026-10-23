import { beforeEach, describe, expect, it, vi } from "vitest";

import { accessToken } from "../auth/session";
import { api, ApiError } from "./client";

vi.mock("../auth/session", () => ({ accessToken: vi.fn() }));

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("api client", () => {
  beforeEach(() => {
    vi.mocked(accessToken).mockReturnValue("tok");
  });

  it("sends the bearer token and only the filters that are set", async () => {
    const fetchMock = respond(200, { items: [], next_cursor: null });
    vi.stubGlobal("fetch", fetchMock);

    await api.listIncidents({ status: "open", severity: undefined, limit: 20 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/incidents?status=open&limit=20");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("encodes ids in paths", async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal("fetch", fetchMock);
    await api.getIncident("a/b");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/incidents/a%2Fb");
  });

  it("turns the API error shape into an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      respond(422, { error: { code: "validation_error", message: "title: too short" } }),
    );
    const err = await api.createIncident({} as never).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: "validation_error", message: "title: too short" });
  });

  it("reports network failures and missing sessions clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.listIncidents()).rejects.toMatchObject({ code: "network_error" });

    vi.mocked(accessToken).mockReturnValue(null);
    await expect(api.listIncidents()).rejects.toMatchObject({ status: 401 });
  });
});
