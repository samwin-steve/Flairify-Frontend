import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Firebase runtime configuration", () => {
  it("shares one pending request across simultaneous initializations", async () => {
    let release!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const { loadFirebaseConfig } = await import("../src/lib/firebase-config");
    const first = loadFirebaseConfig();
    const second = loadFirebaseConfig();
    expect(fetch).toHaveBeenCalledTimes(1);
    release(Response.json({ firebase: { appId: "fixture" } }));
    expect(await first).toEqual(await second);
    await loadFirebaseConfig();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("allows initialization to retry after a failed network request", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Response.json({ firebase: {} }));
    vi.stubGlobal("fetch", fetch);
    const { loadFirebaseConfig } = await import("../src/lib/firebase-config");
    await expect(loadFirebaseConfig()).rejects.toThrow("offline");
    await expect(loadFirebaseConfig()).resolves.toEqual({ firebase: {} });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not cache an unsuccessful HTTP response", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ firebase: {} }));
    vi.stubGlobal("fetch", fetch);
    const { loadFirebaseConfig } = await import("../src/lib/firebase-config");
    await expect(loadFirebaseConfig()).rejects.toThrow("configuration is unavailable");
    await expect(loadFirebaseConfig()).resolves.toEqual({ firebase: {} });
  });
});
