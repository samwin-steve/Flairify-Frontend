"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Check,
  Clapperboard,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { api, post, del } from "@/lib/api";
import type { Job, Reference } from "@/lib/types";
import { Button } from "./ui/button";
import { Media, PrivateVideo } from "./media";
import { UploadZone } from "./onboarding";

function ModelViewer() {
  const ref = useRef<
    HTMLElement & { canActivateAR?: boolean; activateAR?: () => Promise<void> }
  >(null);
  const [ready, setReady] = useState(false);
  const [ar, setAr] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    import("@google/model-viewer")
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => setError("3D rendering is unavailable in this browser."));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || !ref.current) return;
    const el = ref.current;
    const loaded = () =>
      setAr(Boolean(el.canActivateAR) && window.isSecureContext);
    const failed = () =>
      setError("This device could not load the sample 3D form.");
    el.addEventListener("load", loaded);
    el.addEventListener("error", failed);
    return () => {
      el.removeEventListener("load", loaded);
      el.removeEventListener("error", failed);
    };
  }, [ready]);
  return (
    <div className="viewer-panel">
      <div className="section-line">
        <span className="pill">Experimental · sample asset</span>
        <Box size={20} />
      </div>
      <h2>A new dimension. Still exploring.</h2>
      <p>
        Rotate this sample studio form. Personalized avatar reconstruction and
        garment fitting are not connected.
      </p>
      {ready ? (
        <model-viewer
          ref={ref}
          src="/models/flairify-form.glb"
          alt="Original sample mannequin, not a reconstruction of the customer"
          camera-controls
          ar
          ar-modes="webxr scene-viewer quick-look"
          shadow-intensity="1"
          exposure="1.1"
          camera-orbit="25deg 85deg 3m"
          touch-action="pan-y"
          style={{
            width: "100%",
            height: 390,
            background: "#f6eee8",
            borderRadius: 16,
          }}
        />
      ) : (
        <div className="viewer-loading">
          <LoaderCircle className="spin" />
          Loading 3D viewer…
        </div>
      )}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : (
        <p className="fine-print">
          {ar
            ? "Your device supports AR placement."
            : "AR is unavailable on this device. Drag to rotate the 3D form; pinch or scroll to zoom."}
        </p>
      )}
      {ar && (
        <Button
          variant="outline"
          onClick={() =>
            ref.current
              ?.activateAR?.()
              .catch(() =>
                setError(
                  "Could not launch AR. You can still use the 3D viewer.",
                ),
              )
          }
        >
          Place sample in your space
        </Button>
      )}
      <p className="fine-print">
        Original Flairify sample asset · CC0. This form does not represent your
        face, body, or physical fit.
      </p>
    </div>
  );
}

export function FittingRoom() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"previews" | "references" | "3d">("previews");
  const [error, setError] = useState("");
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api<{ jobs: Job[] }>("/jobs"),
    refetchInterval: (q) =>
      q.state.data?.jobs.some((j) => ["queued", "running"].includes(j.status))
        ? 2000
        : false,
  });
  const photos = useQuery({
    queryKey: ["photos"],
    queryFn: () => api<{ references: Reference[] }>("/photos"),
  });
  const list =
    jobs.data?.jobs.filter(
      (j) =>
        ["try_on", "video", "avatar"].includes(j.kind) &&
        j.status !== "cancelled",
    ) || [];
  async function action(fn: () => Promise<unknown>) {
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["jobs"] });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="page-content">
      <div className="eyebrow">A LITTLE IMAGINATION, MADE PERSONAL</div>
      <h1>Your fitting room.</h1>
      <p className="page-subtitle">
        See a possibility. Keep what feels like you.
      </p>
      <div className="tabs">
        {(
          [
            ["previews", "My previews"],
            ["references", "Reference photos"],
            ["3d", "3D / AR lab"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {tab === "previews" && (
        <>
          {!list.length && (
            <div className="empty-state">
              <div className="circle-icon">
                <ImagePlus size={30} />
              </div>
              <h2>Your next look starts here.</h2>
              <p>
                Choose “See it on me” on a stylist recommendation.
                <br />
                Real generation needs your reference and a verified product
                photo.
              </p>
              <span className="pill">
                AI style visualizations · Not exact fit predictions
              </span>
            </div>
          )}
          <div className="generation-grid">
            {list.map((j) => (
              <article className="white-panel generation-card" key={j.id}>
                <div className="section-line">
                  <span className="pill">
                    {j.kind === "video" ? "Show in motion" : "Style preview"}
                  </span>
                  <span className={"status " + j.status}>{j.status}</span>
                </div>
                <h3>{j.stage}</h3>
                {["queued", "running"].includes(j.status) && (
                  <p className="small-note">
                    <LoaderCircle size={17} className="spin" />
                    You can leave and come back. This job is saved.
                  </p>
                )}
                {j.error && (
                  <p className="error" role="alert">
                    {j.error}
                  </p>
                )}
                {j.result?.media_id &&
                  (j.kind === "video" ? (
                    <PrivateVideo id={j.result.media_id} />
                  ) : (
                    <Media
                      src={"media:" + j.result.media_id}
                      alt="AI-generated style visualization"
                      className="preview-image"
                    />
                  ))}
                {j.result?.label && (
                  <p className="fine-print">{j.result.label}</p>
                )}
                <div className="button-row">
                  {j.status === "succeeded" && !j.result?.accepted && (
                    <Button
                      size="sm"
                      onClick={() =>
                        action(() => post("/jobs/" + j.id + "/accept"))
                      }
                    >
                      <Check size={15} />
                      Accept preview
                    </Button>
                  )}
                  {j.kind === "try_on" && j.result?.accepted && (
                    <Button
                      size="sm"
                      onClick={() =>
                        action(() =>
                          post("/generate/video", {
                            source_job_id: j.id,
                            accepted_preview: true,
                            request_key: crypto.randomUUID(),
                            duration: 4,
                          }),
                        )
                      }
                    >
                      <Clapperboard size={15} />
                      Show in motion
                    </Button>
                  )}
                  {j.status === "failed" && j.attempts < 3 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        action(() => post("/jobs/" + j.id + "/retry"))
                      }
                    >
                      <RotateCcw size={15} />
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => action(() => del("/jobs/" + j.id))}
                  >
                    <Trash2 size={15} />
                    {["queued", "running"].includes(j.status)
                      ? "Cancel"
                      : "Delete"}
                  </Button>
                </div>
                <p className="fine-print">
                  {new Date(j.created_at).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
          <div className="notice">
            <p>
              Review face likeness, garment details, and proportions before
              accepting. Videos show simple generated motion, not interactive
              AR. No sample video is presented as a new generation.
            </p>
          </div>
        </>
      )}
      {tab === "references" && (
        <div className="reference-grid">
          {["portrait", "full_body"].map((kind) => (
            <div className="white-panel" key={kind}>
              <h3>{kind === "portrait" ? "Portrait" : "Full-body photo"}</h3>
              {photos.data?.references.find((r) => r.kind === kind) && (
                <>
                  <Media
                    src={
                      "media:" +
                      photos.data.references.find((r) => r.kind === kind)!
                        .media_id
                    }
                    alt={kind}
                    className="reference-image"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await del("/photos/" + kind);
                      qc.invalidateQueries({ queryKey: ["photos"] });
                    }}
                  >
                    Delete reference
                  </Button>
                </>
              )}
              <UploadZone
                kind={kind}
                onDone={() => qc.invalidateQueries({ queryKey: ["photos"] })}
              />
            </div>
          ))}
        </div>
      )}
      {tab === "3d" && <ModelViewer />}
    </div>
  );
}
