"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { api, post, put } from "@/lib/api";
import type { Config, Product, Profile, Photo, Reference } from "@/lib/types";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Media } from "./media";
import { UploadZone } from "./onboarding";

export function TryOnDialog({
  products,
  outfitId,
  config,
  profile,
  onClose,
  onQueued,
  onSignIn,
}: {
  products: Product[];
  outfitId?: string;
  config: Config;
  profile: Profile;
  onClose: () => void;
  onQueued: () => void;
  onSignIn: () => void;
}) {
  const qc = useQueryClient();
  const photos = useQuery({
    queryKey: ["photos"],
    queryFn: () => api<{ photos: Photo[]; references: Reference[] }>("/photos"),
  });
  const eligible = products.filter((p) =>
    ["jacket", "top", "bottom", "dress"].includes(p.category),
  );
  const [productId, setProductId] = useState(eligible[0]?.id || "");
  const [referenceId, setReferenceId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [allow, setAllow] = useState(profile.consent.ai_photo_processing);
  const [layering, setLayering] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refs = photos.data?.references || [];
  const linked = new Set(refs.map((r) => r.source_photo_id));
  const choices = [
    ...refs.map((r) => ({
      id: r.id,
      media_id: r.media_id,
      label: r.kind === "full_body" ? "Your outfit reference" : "Your portrait",
    })),
    ...(photos.data?.photos || [])
      .filter((p) => !linked.has(p.id))
      .map((p, i) => ({
        id: "photo:" + p.id,
        media_id: p.media_id,
        label: `Outfit photo ${i + 1}`,
      })),
  ];
  const selectedId =
    referenceId ||
    choices.find((p) => p.id === "full_body")?.id ||
    choices.find((p) => p.id.startsWith("photo:"))?.id ||
    choices[0]?.id ||
    "";
  const selected = choices.find((p) => p.id === selectedId);
  const product = eligible.find((p) => p.id === productId);
  const variants =
    product?.variants.filter((v) => v.stock.some((s) => s.quantity > 0)) || [];
  const selectedVariant =
    variantId ||
    variants.find((v) => v.size === profile.clothing_size)?.id ||
    variants[0]?.id;
  async function consent() {
    if (!allow)
      throw new Error("Allow Google AI photo processing to continue.");
    if (!profile.consent.ai_photo_processing) {
      const { admin, demo, ...data } = profile;
      await put("/profile", {
        ...data,
        consent: { ...data.consent, ai_photo_processing: true },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
    }
  }
  async function request() {
    setBusy(true);
    setError("");
    try {
      await consent();
      await post("/generate/try_on", {
        outfit_id: outfitId,
        product_id: productId,
        variant_id: selectedVariant,
        reference_id: selectedId,
        layering,
        request_key: crypto.randomUUID(),
      });
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      onQueued();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      wide
      title="A possibility, on you."
      description="A private 2D preview made with Google AI. Your face and garment details need your review; this does not predict exact fit."
    >
      {profile.demo ? (
        <div className="empty-state">
          <Sparkles size={30} />
          <h2>Use your own photo with Google AI.</h2>
          <p>
            Sign in to detect your wardrobe and generate personalized previews.
            The anonymous demo uses sample data and does not run paid
            generation.
          </p>
          <Button onClick={onSignIn}>Sign in for real previews</Button>
        </div>
      ) : (
        <div className="form-stack">
          <div className="try-on-inputs">
            <div>
              <h3>Your photo</h3>
              {selected ? (
                <Media
                  key={selected.media_id}
                  src={"media:" + selected.media_id}
                  alt="Selected photo for your preview"
                  className="try-on-reference"
                />
              ) : (
                <div className="notice">
                  <p>
                    Upload a well-lit photo with your face and clothes visible.
                    A full-body photo gives the model more to work with.
                  </p>
                </div>
              )}
              <label className="field">
                Choose an uploaded photo
                <select
                  value={selectedId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  disabled={!choices.length}
                >
                  {!choices.length && (
                    <option value="">No photo uploaded yet</option>
                  )}
                  {choices.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <h3>The garment</h3>
              {product && (
                <Media
                  src={product.image}
                  alt={product.name}
                  catalog
                  className="try-on-reference"
                />
              )}
              <label className="field">
                Choose a garment
                <select
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setVariantId("");
                  }}
                >
                  {eligible.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Available size
                <select
                  value={selectedVariant || ""}
                  onChange={(e) => setVariantId(e.target.value)}
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.size} · {v.colour}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={allow}
              onChange={(e) => setAllow(e.target.checked)}
            />
            I allow Google AI to process my photos for garment detection and
            requested style previews.
          </label>
          <details className="photo-upload-details" open={!choices.length}>
            <summary>Add or replace my outfit photo</summary>
            <p className="fine-print">
              Upload a photo of just you. It will also be checked for visible
              garments, which you can confirm in My Wardrobe.
            </p>
            <UploadZone
              kind="full_body"
              disabled={!allow}
              beforeUpload={consent}
              onDone={() => {
                setReferenceId("full_body");
                qc.invalidateQueries({ queryKey: ["photos"] });
                qc.invalidateQueries({ queryKey: ["jobs"] });
              }}
            />
          </details>
          {product?.category === "jacket" && (
            <label className="check-line">
              <input
                type="checkbox"
                checked={layering}
                onChange={(e) => setLayering(e.target.checked)}
              />
              Keep my visible top under this jacket
            </label>
          )}
          {product?.sample && (
            <p className="fine-print">
              Sample catalogue photograph · This preview uses the pictured
              garment as inspiration, not a verified retailer product.
            </p>
          )}
          {!config.try_on && (
            <div className="notice">
              <p>Google image generation is unavailable in this environment.</p>
            </div>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button
            disabled={
              busy ||
              !allow ||
              !selected ||
              !product ||
              !selectedVariant ||
              !config.try_on
            }
            onClick={request}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Sparkles size={17} />
            )}
            Generate my 2D preview
          </Button>
          <p className="fine-print">
            <Check size={13} />
            Your source photo remains private. Generation starts only when you
            request it.
          </p>
        </div>
      )}
    </Modal>
  );
}
