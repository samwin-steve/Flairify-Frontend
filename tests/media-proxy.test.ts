import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/[...path]/route";

afterEach(() => vi.unstubAllGlobals());

it("preserves authorized browser caching and conditional 304 responses for catalogue images", async () => {
  const fetcher = vi.fn(async () => new Response(null, { status: 304, headers: {
    "Cache-Control": "private, max-age=300, must-revalidate", ETag: '"image"', Vary: "Authorization",
  } }));
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(new NextRequest("http://localhost:3000/api/catalog/media/image?width=384", {
    headers: { Authorization: "Bearer account", "If-None-Match": '"image"' },
  }), { params: Promise.resolve({ path: ["catalog", "media", "image"] }) });
  expect(response.status).toBe(304);
  expect(response.headers.get("cache-control")).toBe("private, max-age=300, must-revalidate");
  expect(response.headers.get("vary")).toBe("Authorization");
  const [url, options] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
  expect(url.search).toBe("?width=384");
  expect(new Headers(options.headers).get("if-none-match")).toBe('"image"');
  expect(options.cache).toBe("no-store");
});

it("private images and unrelated API data cannot acquire a public response cache", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("image", { headers: { "Cache-Control": "private, no-store" } })));
  const privateImage = await GET(new NextRequest("http://localhost:3000/api/media/image"), { params: Promise.resolve({ path: ["media", "image"] }) });
  expect(privateImage.headers.get("cache-control")).toBe("private, no-store");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("profile", { headers: { "Cache-Control": "public, max-age=3600" } })));
  const profile = await GET(new NextRequest("http://localhost:3000/api/profile"), { params: Promise.resolve({ path: ["profile"] }) });
  expect(profile.headers.get("cache-control")).toContain("no-store");
});
