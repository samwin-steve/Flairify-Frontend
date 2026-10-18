import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  if (path.some((p) => p === ".." || p.includes("/") || p.includes("\\")))
    return new Response("Invalid path", { status: 400 });
  const url = new URL(
    "/api/" + path.map(encodeURIComponent).join("/"),
    backend,
  );
  url.search = req.nextUrl.search;
  const headers = new Headers();
  for (const key of [
    "authorization",
    "content-type",
    "x-photos-token",
    "accept",
    "if-none-match",
  ]) {
    const v = req.headers.get(key);
    if (v) headers.set(key, v);
  }
  try {
    const response = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : await req.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(120000)]),
    });
    const out = new Headers({
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    });
    for (const key of ["content-type", "content-disposition"]) {
      const v = response.headers.get(key);
      if (v) out.set(key, v);
    }
    const imageRoute = req.method === "GET" && (
      (path[0] === "media" && path.length === 2) ||
      (path[0] === "catalog" && path[1] === "media" && path.length === 3)
    );
    if (imageRoute) {
      // Browser-only caching; the server proxy still never caches authenticated bytes.
      for (const key of ["cache-control", "etag", "vary", "x-content-type-options"]) {
        const value = response.headers.get(key);
        if (value) out.set(key, value);
      }
    }
    return new Response(response.body, {
      status: response.status,
      headers: out,
    });
  } catch {
    return Response.json(
      { detail: "The wardrobe service is unavailable. Please try again." },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
