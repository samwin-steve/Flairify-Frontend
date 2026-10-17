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
export const del = (path: string) => api(path, { method: "DELETE" });
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
