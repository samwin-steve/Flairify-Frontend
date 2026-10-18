"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Skeleton } from "./ui/loading";
import { ImageOff } from "lucide-react";
import { mediaBlob, retainMedia, syncMediaSession } from "@/lib/api";
import { EMPTY_MEDIA, mediaCache, type MediaVariant } from "@/lib/media-cache";
export function Media({
  src,
  alt,
  className = "",
  catalog = false,
  variant = catalog ? "thumb" : "detail",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  catalog?: boolean;
  variant?: MediaVariant;
  priority?: boolean;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const bind = useCallback((node: HTMLImageElement | HTMLDivElement | null) => {
    if (node) setTarget(node);
  }, []);
  const [nearViewport, setNearViewport] = useState(false);
  const shouldLoad = priority || nearViewport;
  useEffect(() => {
    if (shouldLoad || !target) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [target, shouldLoad]);
  const account = useSyncExternalStore(mediaCache.subscribe, () => mediaCache.account, () => null);
  const revision = useSyncExternalStore(mediaCache.subscribe, () => mediaCache.revision, () => 0);
  const id = src.startsWith("media:") ? src.slice(6) : "";
  const image = useSyncExternalStore(
    mediaCache.subscribe,
    () => id ? mediaCache.snapshot(account, id, catalog, variant) : EMPTY_MEDIA,
    () => EMPTY_MEDIA,
  );
  const url = id ? image.url : src;
  const [failedUrl, setFailedUrl] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  const failed = image.error || (!!url && failedUrl === url);
  useEffect(() => {
    if (!id || !shouldLoad) return;
    syncMediaSession();
    if (account) return retainMedia(account, id, catalog, variant);
  }, [id, catalog, account, revision, variant, shouldLoad]);
  const imageProps = {
    ref: bind,
    alt,
    className: className + (loadedUrl !== url ? " shimmer media-loading" : ""),
    onLoad: () => setLoadedUrl(url),
    loading: priority ? "eager" as const : "lazy" as const,
    decoding: "async" as const,
    onError: () => setFailedUrl(url),
  };
  return url && !failed ? (
    src.startsWith("/images/") ? (
      <Image {...imageProps} src={src} width={768} height={1024}
        sizes="(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 320px" />
    ) : <img {...imageProps} src={url} />
  ) : (
    <div
      ref={bind}
      className={"media-placeholder " + className + (!failed && src ? " shimmer" : "")}
      role={failed ? undefined : src ? "status" : "img"}
      aria-label={!failed && src ? `Loading ${alt}` : alt}
      aria-busy={!failed && !!src}
    >
      {failed || !src ? <><ImageOff size={26} /><span>{failed ? "Image unavailable" : "No image"}</span></> : <span className="sr-only">Loading image</span>}
      {failed && id && <button type="button" className="text-link" onClick={() => {
        setFailedUrl("");
        mediaCache.invalidate(account, id, catalog);
      }}>Try again</button>}
    </div>
  );
}
export function PrivateVideo({ id }: { id: string }) {
  const [video, setVideo] = useState({ id: "", url: "", error: false });
  const url = video.id === id ? video.url : "";
  useEffect(() => {
    let blob = "";
    let active = true;
    mediaBlob(id).then((u) => {
      blob = u;
      if (active) setVideo({ id, url: u, error: false });
      else URL.revokeObjectURL(u);
    }).catch(() => { if (active) setVideo({ id, url: "", error: true }); });
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
    video.id === id && video.error ? <p role="alert">Video unavailable. Try reopening this preview.</p> : <Skeleton label="Loading video" media />
  );
}
