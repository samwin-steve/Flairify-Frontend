import { afterEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ currentUser: null as null | { uid: string; getIdToken: () => Promise<string> } }));
vi.mock("firebase/app", () => ({ getApps: () => [{}] }));
vi.mock("firebase/auth", () => ({ getAuth: () => auth }));
import { del, retainMedia, syncMediaSession } from "../src/lib/api";
import { mediaCache } from "../src/lib/media-cache";
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
afterEach(() => { mediaCache.setAccount(null); auth.currentUser = null; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("uses the stable UID while access tokens rotate, and clears when account changes", async () => {
  auth.currentUser = { uid: "one", getIdToken: vi.fn().mockResolvedValue("token1") };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["image"]))));
  const account = syncMediaSession()!;
  const release = retainMedia(account, "image", false);
  await settle();
  const url = mediaCache.snapshot(account, "image").url;
  expect(url).toBeTruthy();
  auth.currentUser = { uid: "one", getIdToken: async () => "token2" };
  expect(syncMediaSession()).toBe(account);
  expect(mediaCache.snapshot(account, "image").url).toBe(url);
  auth.currentUser = { uid: "two", getIdToken: async () => "token3" };
  syncMediaSession();
  expect(mediaCache.snapshot(account, "image").url).toBe("");
  release();
});

it("invalidates private media only after successful cascading deletion", async () => {
  auth.currentUser = { uid: "one", getIdToken: async () => "token" };
  const fetcher = vi.fn(async () => new Response(new Blob(["image"])));
  vi.stubGlobal("fetch", fetcher);
  const account = syncMediaSession()!;
  retainMedia(account, "image", false);
  await settle();
  fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ detail: "Failed" }), { status: 500 }));
  await expect(del("/photos/photo")).rejects.toThrow("Failed");
  expect(mediaCache.snapshot(account, "image").url).toBeTruthy();
  fetcher.mockImplementationOnce(async () => new Response('{"deleted":true}'));
  await del("/photos/photo");
  expect(mediaCache.snapshot(account, "image").url).toBe("");
});

it("assigns guest namespaces without putting bearer tokens in cache keys", () => {
  let token: string | null = "guest-secret";
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", { getItem: () => token });
  const first = syncMediaSession();
  expect(first).toMatch(/^guest:\d+$/);
  expect(syncMediaSession()).toBe(first);
  token = "another-guest";
  expect(syncMediaSession()).not.toBe(first);
  token = null;
  expect(syncMediaSession()).toBe(null);
});
