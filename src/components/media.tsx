"use client";
import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { mediaBlob } from "@/lib/api";
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
  const [url, setUrl] = useState(src.startsWith("media:") ? "" : src);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!src.startsWith("media:")) {
      setUrl(src);
      return;
    }
    let active = true;
    let blob = "";
    mediaBlob(src.slice(6), catalog)
      .then((v) => {
        blob = v;
        if (active) setUrl(v);
        else URL.revokeObjectURL(v);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [src, catalog]);
  return url && !failed ? (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={"media-placeholder " + className}
      role="img"
      aria-label={alt}
    >
      <ImageOff size={26} />
      <span>{failed ? "Image unavailable" : "Your garment"}</span>
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
