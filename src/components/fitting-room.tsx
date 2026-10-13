"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Check,
  Clapperboard,
  ImagePlus,
  Download,
  LoaderCircle,
  RotateCcw,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { api, post, del, mediaBlob } from "@/lib/api";
import type { Job, Reference, Photo, Config, Product } from "@/lib/types";
import { money } from "@/lib/utils";
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
          camera-orbit="25deg 85deg 105%"
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
            ? "Try AR placement on this device. Availability depends on the browser and installed viewer."
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

export function FittingRoom({
  onShop,
  onBuy,
  onWardrobe,
  showReferences = false,
}: {
  showReferences?: boolean;
  onShop: () => void;
  onBuy: (products: Product[], previewJobId: string) => void;
  onWardrobe: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"previews" | "references" | "3d">(
    showReferences ? "references" : "previews",
  );
  const [error, setError] = useState("");
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api<{ jobs: Job[] }>("/jobs"),
    refetchInterval: (q) =>
      q.state.data?.jobs.some((j) => ["queued", "running"].includes(j.status))
        ? 2000
        : false,
  });
  const config = useQuery({
    queryKey: ["config", "account"],
    queryFn: ({ signal }) => api<Config>("/config", { signal }),
  });
  const photos = useQuery({
    queryKey: ["photos"],
    queryFn: () => api<{ references: Reference[]; photos: Photo[] }>("/photos"),
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
  async function download(id: string) {
    await action(async () => {
      const url = await mediaBlob(id);
      const link = document.createElement("a");
      link.href = url;
      link.download = "flairify-style-preview.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
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
                Your uploaded outfit photos can be used directly. Choose a
                garment from Inventory to get started.
              </p>
              <Button onClick={onShop}>Browse inventory</Button>
              <span className="pill">
                Google AI · 2D style previews · Not exact fit predictions
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
                    <figure className="generated-preview">
                      <figcaption>Your Google AI preview</figcaption>
                      <Media
                        src={"media:" + j.result.media_id}
                        alt="AI-generated style visualization"
                        className="preview-image"
                      />
                    </figure>
                  ))}
                {!j.result?.pieces?.length && j.result?.product_name && (
                  <p>
                    <strong>{j.result.product_name}</strong>
                    {j.result.sample_product
                      ? " · Sample catalogue garment"
                      : ""}
                  </p>
                )}
                {!!j.result?.pieces?.length && (
                  <div className="preview-used-pieces">
                    <h4>Included in this preview</h4>
                    <ul>
                      {j.result.pieces.map((piece) => (
                        <li key={piece.kind + piece.id}>
                          {piece.name} ·{" "}
                          {piece.kind === "wardrobe" ? "Owned" : "New"}
                          {piece.sample ? " · Sample" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {j.kind === "try_on" &&
                  j.result?.keep_background !== undefined && (
                    <p className="fine-print">
                      Background requested:{" "}
                      {j.result.keep_background
                        ? "same as your photo"
                        : "plain white"}
                      . Regenerate uses your current Profile setting.
                    </p>
                  )}
                {j.result?.selection_adjustments?.map((message, index) => (
                  <p className="fine-print" key={index}>
                    {message}
                  </p>
                ))}
                {j.result?.label && (
                  <p className="fine-print">{j.result.label}</p>
                )}
                {j.kind === "try_on" &&
                  j.status === "succeeded" &&
                  j.result?.media_id && (
                    <PreviewShopping jobId={j.id} onBuy={onBuy} />
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
                  {j.kind === "try_on" &&
                    j.result?.accepted &&
                    config.data?.video && (
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
                  {j.status === "succeeded" &&
                    j.kind === "try_on" &&
                    j.result?.media_id && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => download(j.result!.media_id!)}
                        >
                          <Download size={15} />
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            action(() => post("/jobs/" + j.id + "/regenerate"))
                          }
                        >
                          <RotateCcw size={15} />
                          Regenerate
                        </Button>
                      </>
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
        <>
          <div className="notice">
            <p>
              Your wardrobe uploads are available for previews too. Full-body
              references also create garment suggestions when you have allowed
              Google AI processing.
            </p>
            <Button size="sm" variant="outline" onClick={onWardrobe}>
              Review detected garments
            </Button>
          </div>
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
                  onDone={() => {
                    qc.invalidateQueries({ queryKey: ["photos"] });
                    qc.invalidateQueries({ queryKey: ["jobs"] });
                    qc.invalidateQueries({ queryKey: ["wardrobe"] });
                  }}
                />
              </div>
            ))}
          </div>
          <h2>Your outfit photos</h2>
          <div className="source-photo-grid">
            {photos.data?.photos.map((p) => (
              <article key={p.id} className="white-panel">
                <Media
                  src={"media:" + p.media_id}
                  alt="Uploaded outfit photo"
                />
                <Button size="sm" variant="outline" onClick={onShop}>
                  Try a garment
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    action(async () => {
                      await del("/photos/" + p.id);
                      qc.invalidateQueries({ queryKey: ["photos"] });
                      qc.invalidateQueries({ queryKey: ["wardrobe"] });
                    })
                  }
                >
                  Delete photo
                </Button>
              </article>
            ))}
          </div>
        </>
      )}
      {tab === "3d" && <ModelViewer />}
    </div>
  );
}

function PreviewShopping({
  jobId,
  onBuy,
}: {
  jobId: string;
  onBuy: (products: Product[], previewJobId: string) => void;
}) {
  const shopping = useQuery({
    queryKey: ["preview-shopping", jobId],
    queryFn: () =>
      api<{ products: Product[]; unavailable: { id: string; name: string }[] }>(
        `/jobs/${jobId}/shopping`,
      ),
    retry: false,
  });
  return (
    <section className="preview-shopping" aria-label="Shop this look">
      <h4>Shop this look</h4>
      {shopping.isLoading && (
        <p role="status">Finding your recommended items…</p>
      )}
      {shopping.error && (
        <p role="alert" className="error">
          {shopping.error.message}{" "}
          <button className="text-link" onClick={() => shopping.refetch()}>
            Try again
          </button>
        </p>
      )}
      {!!shopping.data?.unavailable.length && (
        <p className="small-note">
          Unavailable and not included:{" "}
          {shopping.data.unavailable.map((p) => p.name).join(", ")}.
        </p>
      )}
      {!!shopping.data?.products.length && (
        <>
          <p className="fine-print">
            All available new items from this recommendation. Confirm your sizes
            and selections at checkout.
          </p>
          <ul className="preview-shopping-items">
            {shopping.data.products.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <strong>{money(p.price)}</strong>
              </li>
            ))}
          </ul>
          <Button onClick={() => onBuy(shopping.data!.products, jobId)}>
            <ShoppingBag size={17} />
            Buy
          </Button>
        </>
      )}
      {shopping.data && !shopping.data.products.length && (
        <p className="fine-print">
          There are no available new items to buy in this look.
        </p>
      )}
    </section>
  );
}
