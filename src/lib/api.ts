import { mediaCache, type MediaVariant } from "./media-cache";
import { mediaDownloads } from "./media-download-queue";
import { getAuth } from "firebase/auth";
import { getApps } from "firebase/app";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function sessionIdentity() {
  // Compare the login's user object, not an ID token that can refresh mid-request.
  if (getApps().length && getAuth().currentUser)
    return getAuth().currentUser!;
  return typeof window !== "undefined"
    ? localStorage.getItem("flairify-token")
    : null;
}
let guestIdentity: string | null = null;
let guestNamespace = 0;
export function syncMediaSession() {
  const identity = sessionIdentity();
  if (typeof identity === "string" && identity !== guestIdentity) guestNamespace++;
  guestIdentity = typeof identity === "string" ? identity : null;
  const scope = typeof identity === "string"
    ? "guest:" + guestNamespace
    : identity ? "firebase:" + identity.uid : null;
  mediaCache.setAccount(scope);
  return scope;
}
export function retainMedia(account: string, id: string, catalog: boolean, variant: MediaVariant = "original") {
  const identity = sessionIdentity();
  if (syncMediaSession() !== account) return () => {};
  return mediaCache.retain(account, id, catalog, (signal) => mediaDownloads.run(signal, async () => {
    const credential = typeof identity === "string" ? identity : await identity?.getIdToken();
    if (signal.aborted) throw new Error("Media request cancelled");
    const response = await fetch(
      "/api/" + (catalog ? "catalog/media/" : "media/") + encodeURIComponent(id) +
        (variant === "original" ? "" : `?width=${variant === "thumb" ? 384 : 768}`),
      { headers: { Authorization: "Bearer " + credential }, signal },
    );
    if (!response.ok) throw new Error("Image unavailable");
    return response.blob();
  }), variant);
}
export async function token() {
  const session = sessionIdentity();
  return typeof session === "string" ? session : session?.getIdToken() ?? null;
}
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const t = await token();
  if (t) headers.set("Authorization", "Bearer " + t);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch("/api" + path, { ...init, headers });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Something went wrong" }));
    throw new ApiError(
      typeof error.detail === "string"
        ? error.detail
        : "Please check your entries and try again.",
      response.status,
    );
  }
  return response.json();
}
export const post = <T = unknown>(path: string, data: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
export const put = <T = unknown>(path: string, data: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(data) });
export async function del(path: string) {
  const account = syncMediaSession();
  const result = await api(path, { method: "DELETE" });
  if (/^\/(photos|wardrobe|jobs)\//.test(path)) mediaCache.invalidatePrivate(account);
  return result;
}
export async function mediaBlob(id: string, catalog = false) {
  const t = await token();
  const r = await fetch(
    "/api/" + (catalog ? "catalog/media/" : "media/") + encodeURIComponent(id),
    { headers: { Authorization: "Bearer " + t } },
  );
  if (!r.ok) throw new Error("Image unavailable");
  return URL.createObjectURL(await r.blob());
}
export async function uploadPhoto(
  file: File,
  kind: string,
  onProgress: (n: number) => void,
  admin = false,
): Promise<unknown> {
  const t = await token();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", admin ? "/api/admin/images" : "/api/photos");
    xhr.setRequestHeader("Authorization", "Bearer " + t);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const v = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) reject(new Error(v.detail || "Upload failed"));
        else resolve(v);
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Connection interrupted. Retry this file."));
    const data = new FormData();
    data.append("file", file);
    data.append("kind", kind);
    xhr.send(data);
  });
}
