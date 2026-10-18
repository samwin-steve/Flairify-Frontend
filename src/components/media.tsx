"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ImageOff } from "lucide-react";
import { mediaBlob, retainMedia, syncMediaSession } from "@/lib/api";
import { EMPTY_MEDIA, mediaCache } from "@/lib/media-cache";
export function Media({
  src,
  alt,
  className = "",
  catalog = false,
}: {
  src: string;
  alt: string;
  className?: string;
  catalog?: boolean;
}) {
  const account = useSyncExternalStore(mediaCache.subscribe, () => mediaCache.account, () => null);
  const revision = useSyncExternalStore(mediaCache.subscribe, () => mediaCache.revision, () => 0);
  const id = src.startsWith("media:") ? src.slice(6) : "";
  const image = useSyncExternalStore(
    mediaCache.subscribe,
    () => id ? mediaCache.snapshot(account, id, catalog) : EMPTY_MEDIA,
    () => EMPTY_MEDIA,
  );
  const url = id ? image.url : src;
  const [failedUrl, setFailedUrl] = useState("");
  const failed = image.error || (!!url && failedUrl === url);
  useEffect(() => {
    if (!id) return;
    syncMediaSession();
    if (account) return retainMedia(account, id, catalog);
  }, [id, catalog, account, revision]);
  return url && !failed ? (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailedUrl(url)}
    />
  ) : (
    <div
      className={"media-placeholder " + className}
      role={failed ? undefined : "img"}
      aria-label={alt}
    >
      <ImageOff size={26} />
      <span>{failed ? "Image unavailable" : "Your garment"}</span>
      {failed && id && <button type="button" className="text-link" onClick={() => {
        setFailedUrl("");
        mediaCache.invalidate(account, id, catalog);
      }}>Try again</button>}
    </div>
  );
}
export function PrivateVideo({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let blob = "";
    let active = true;
    mediaBlob(id).then((u) => {
      blob = u;
      if (active) setUrl(u);
      else URL.revokeObjectURL(u);
    });
    return () => {
      active = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [id]);
  return url ? (
    <div>
      <video src={url} controls playsInline className="generated-video" />
      <a className="text-link" href={url} download="flairify-motion.mp4">
        Download video
      </a>
    </div>
  ) : (
    <p>Loading your private video…</p>
  );
}
