import { afterEach, describe, expect, it, vi } from "vitest";

import { codeChallenge, randomString } from "./pkce";
import { accessToken, completeSignIn, signIn } from "./session";

describe("pkce", () => {
  it("matches the RFC 7636 example", async () => {
    expect(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("makes URL-safe random strings", () => {
    const s = randomString();
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomString()).not.toBe(s);
  });
});

describe("session", () => {
  afterEach(() => vi.unstubAllGlobals());

  async function startSignIn(): Promise<URL> {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, origin: "http://localhost:5173" });
    await signIn();
    return new URL(assign.mock.calls[0][0] as string);
  }

  it("redirects to the hosted UI with PKCE and never stores tokens", async () => {
    const url = await startSignIn();
    expect(url.origin + url.pathname).toBe("https://auth.test/oauth2/authorize");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(window.localStorage.length).toBe(0);
  });

  it("rejects a returned state that doesn't match", async () => {
    await startSignIn();
    const back = new URL("http://localhost:5173/?code=abc&state=forged");
    await expect(completeSignIn(back)).rejects.toThrow(/state mismatch/);
    expect(accessToken()).toBeNull();
  });

  it("exchanges the code and keeps the token in memory only", async () => {
    const url = await startSignIn();
    const state = url.searchParams.get("state")!;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const back = new URL(`http://localhost:5173/?code=abc&state=${state}`);
    expect(await completeSignIn(back)).toBe(true);

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(accessToken()).toBe("tok");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0); // the one-time verifier is gone
  });
});
