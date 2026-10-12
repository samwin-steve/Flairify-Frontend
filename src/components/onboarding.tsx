"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Check,
  CheckCheck,
  CloudUpload,
  ImagePlus,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { api, post, put, del, uploadPhoto } from "@/lib/api";
import { pollingMilliseconds, CLOTHING_SIZES, SHOE_SIZES } from "@/lib/utils";
import type {
  Box,
  Config,
  Duplicate,
  Job,
  Photo,
  Profile,
  Reference,
  Shop,
  WardrobeItem,
} from "@/lib/types";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Media } from "./media";

const profileSchema = z.object({
  name: z.string().min(1).max(80),
  clothing_size: z.string().min(1, "Choose your clothing size"),
  shoe_size: z.string().min(1, "Choose your shoe size"),
  fit: z.string(),
  budget: z.coerce.number().min(0).max(1000000),
  remember: z.boolean(),
  processing: z.boolean(),
  keep_background: z.boolean(),
  department: z.enum(["all", "women", "men", "unisex"]),
  preferred_store_id: z.string(),
  include_wardrobe: z.boolean(),
});
type Basics = z.infer<typeof profileSchema>;
export function ProfileForm({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [styles, setStyles] = useState(profile.styles);
  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: () => api<{ stores: Shop[] }>("/stores"),
  });
  const form = useForm<Basics>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile.name === "Friend" ? "" : profile.name,
      clothing_size: profile.clothing_size,
      shoe_size: profile.shoe_size,
      fit: profile.fit,
      budget: profile.budget,
      remember: profile.consent.remember_preferences,
      processing: profile.consent.ai_photo_processing,
      keep_background: profile.keep_background ?? false,
      department: profile.department || "all",
      preferred_store_id: profile.preferred_store_id || "",
      include_wardrobe: profile.include_wardrobe ?? false,
    },
  });
  async function submit(data: Basics) {
    setBusy(true);
    setError("");
    try {
      await put("/profile", {
        name: data.name,
        keep_background: data.keep_background,
        department: data.department,
        preferred_store_id: data.preferred_store_id || null,
        include_wardrobe: data.include_wardrobe,
        styles,
        colours: [],
        clothing_size: data.clothing_size,
        shoe_size: data.shoe_size,
        fit: data.fit,
        budget: data.budget,
        consent: {
          remember_preferences: data.remember,
          ai_photo_processing: data.processing,
        },
        onboarding_complete: profile.onboarding_complete,
      });
      await post("/onboarding/complete");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={form.handleSubmit(submit)} className="form-stack">
      <div className="field">
        <label htmlFor="name">What should we call you?</label>
        <input
          id="name"
          placeholder="Your first name"
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <small className="error">Please enter your name.</small>
        )}
      </div>
      <div className="field">
        <label>
          A little about your style <span className="muted">(optional)</span>
        </label>
        <div className="chips">
          {["Minimal", "Classic", "Relaxed", "Colourful", "Tailored"].map(
            (s) => (
              <button
                type="button"
                className={"chip " + (styles.includes(s) ? "selected" : "")}
                key={s}
                onClick={() =>
                  setStyles(
                    styles.includes(s)
                      ? styles.filter((t) => t !== s)
                      : [...styles, s],
                  )
                }
              >
                {s}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="department">Shopping department</label>
          <select id="department" {...form.register("department")}>
            <option value="all">All departments</option>
            <option value="women">Women + unisex</option>
            <option value="men">Men + unisex</option>
            <option value="unisex">Unisex</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="preferred-store">Preferred store</label>
          <select id="preferred-store" {...form.register("preferred_store_id")}>
            <option value="">All available stores</option>
            {stores.data?.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="size">Clothing size</label>
          <select id="size" required {...form.register("clothing_size")}>
            <option value="">Choose your size</option>
            {CLOTHING_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="shoes">Shoe size (EU)</label>
          <select id="shoes" required {...form.register("shoe_size")}>
            <option value="">Choose your size</option>
            {SHOE_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fit">Fit preference</label>
          <select id="fit" {...form.register("fit")}>
            {["Comfortable", "Relaxed", "Tailored"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="budget">Typical budget (₹)</label>
          <input
            id="budget"
            type="number"
            min="0"
            {...form.register("budget")}
          />
        </div>
      </div>
      <label className="check-line">
        <input type="checkbox" {...form.register("include_wardrobe")} />
        Pair recommendations with my wardrobe by default
      </label>
      <p className="fine-print">
        Optional. We’ll only use confirmed pieces that suit the occasion. You
        can switch pairing on or off in chat.
      </p>
      <div className="background-preference">
        <label className="check-line">
          <input type="checkbox" {...form.register("keep_background")} />
          Keep my generated outfits in the same background
        </label>
        <p className="fine-print">
          Checked: keep the background from your reference photo. Unchecked: use
          a plain white background. Saved for future previews; you can change
          this in Profile.
        </p>
      </div>
      <label className="check-line">
        <input type="checkbox" {...form.register("remember")} />
        Remember my optional style and colour preferences
      </label>
      <label className="check-line">
        <input type="checkbox" {...form.register("processing")} />I agree to
        process my selected photos with Google Cloud AI to identify clothes and
        create shop-style garment images and requested outfit previews when
        connected
      </label>
      <p className="fine-print">
        Sizes come from you. Photos do not give us accurate body measurements.
        Your department, sizes, store and budget are saved to your account.
        Review them in Profile anytime and confirm the size again at checkout.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={16} /> : null}Save and
        continue <ArrowRight size={16} />
      </Button>
    </form>
  );
}

export function UploadZone({
  kind = "wardrobe",
  onDone,
  beforeUpload,
  disabled = false,
}: {
  kind?: string;
  onDone: () => void;
  beforeUpload?: () => Promise<void>;
  disabled?: boolean;
}) {
  const [files, setFiles] = useState<
    { name: string; progress: number; error?: string; done?: boolean }[]
  >([]);
  const ref = useRef<HTMLInputElement>(null);
  async function upload(list: FileList | null) {
    if (!list) return;
    const selected = Array.from(list).slice(0, 12);
    setFiles(selected.map((f) => ({ name: f.name, progress: 0 })));
    for (let i = 0; i < selected.length; i++) {
      try {
        const f = selected[i];
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size > 10 * 1024 * 1024
        )
          throw new Error("Use JPEG, PNG or WebP, up to 10 MB.");
        if (beforeUpload) await beforeUpload();
        await uploadPhoto(f, kind, (n) =>
          setFiles((old) =>
            old.map((x, j) => (j === i ? { ...x, progress: n } : x)),
          ),
        );
        setFiles((old) =>
          old.map((x, j) => (j === i ? { ...x, done: true } : x)),
        );
        onDone();
      } catch (e) {
        setFiles((old) =>
          old.map((x, j) =>
            j === i ? { ...x, error: (e as Error).message } : x,
          ),
        );
      }
    }
  }
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={kind === "wardrobe"}
        disabled={disabled}
        className="sr-only"
        aria-label={"Upload " + kind + " photos"}
        onChange={(e) => upload(e.target.files)}
      />
      <button
        className="upload-zone"
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        <span className="circle-icon">
          <CloudUpload size={27} />
        </span>
        <strong>
          {kind === "wardrobe"
            ? "Drop a little of your wardrobe here"
            : "Choose your " + kind.replace("_", " ") + " photo"}
        </strong>
        <span>Choose photos from your phone or computer</span>
        <small>JPEG, PNG or WebP · Up to 10 MB each · 12 per batch</small>
      </button>
      {files.map((f, i) => (
        <div className="upload-progress" key={i}>
          <span>{f.name}</span>
          <span>
            {f.error ? (
              <span className="error">{f.error}</span>
            ) : f.done ? (
              <Check size={16} />
            ) : (
              f.progress + "% uploaded"
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PhotoPicker({
  config,
  onDone,
}: {
  config: Config;
  onDone: () => void;
}) {
  const [status, setStatus] = useState("");
  const [pickerUri, setPickerUri] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useRef<{ id: string; token: string } | null>(null);
  const cancelled = useRef(false);
  async function cancel() {
    setPickerUri("");
    cancelled.current = true;
    const s = session.current;
    if (s) {
      await api("/photos-picker/" + encodeURIComponent(s.id), {
        method: "DELETE",
        headers: { "X-Photos-Token": s.token },
      }).catch(() => {});
      session.current = null;
    }
    setBusy(false);
    setStatus("Selection cancelled. You can upload photos directly.");
  }
  async function start() {
    setBusy(true);
    setStatus("Opening Google Photos authorization…");
    cancelled.current = false;
    try {
      if (!config.photos_client_id)
        throw new Error(
          "Google Photos needs its own OAuth configuration. Please use direct upload for now.",
        );
      if (!document.getElementById("google-identity"))
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.id = "google-identity";
          script.src = "https://accounts.google.com/gsi/client";
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Could not load Google authorization."));
          document.head.appendChild(script);
        });
      const google = (
        window as unknown as {
          google: {
            accounts: {
              oauth2: {
                initTokenClient: (options: Record<string, unknown>) => {
                  requestAccessToken: () => void;
                };
              };
            };
          };
        }
      ).google;
      const access = await new Promise<string>((resolve, reject) => {
        google.accounts.oauth2
          .initTokenClient({
            client_id: config.photos_client_id,
            scope:
              "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
            callback: (r: { access_token?: string; error?: string }) =>
              r.access_token
                ? resolve(r.access_token)
                : reject(
                    new Error("Google Photos authorization was cancelled."),
                  ),
            error_callback: () =>
              reject(new Error("Authorization window closed.")),
          })
          .requestAccessToken();
      });
      const headers = { "X-Photos-Token": access };
      const result = await api<{
        id: string;
        pickerUri: string;
        pollingConfig: { pollInterval: string; timeoutIn: string };
      }>("/photos-picker", { method: "POST", headers });
      session.current = { id: result.id, token: access };
      setPickerUri(result.pickerUri);
      const win = window.open(
        result.pickerUri,
        "_blank",
        "noopener,noreferrer",
      );
      void win;
      setStatus("Choose photos in Google Photos, then return here.");
      let interval = pollingMilliseconds(result.pollingConfig.pollInterval);
      let deadline =
        Date.now() + Number.parseFloat(result.pollingConfig.timeoutIn) * 1000;
      while (!cancelled.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, interval));
        if (cancelled.current) return;
        const state = await api<{
          mediaItemsSet: boolean;
          pollingConfig?: { pollInterval: string; timeoutIn: string };
        }>("/photos-picker/" + encodeURIComponent(result.id), { headers });
        if (state.mediaItemsSet) {
          setStatus("Importing only the photos you selected…");
          await api(
            "/photos-picker/" + encodeURIComponent(result.id) + "/import",
            { method: "POST", headers },
          );
          session.current = null;
          setPickerUri("");
          onDone();
          setStatus(
            "Photos imported. Select the correct person before processing.",
          );
          return;
        }
        if (state.pollingConfig) {
          interval = pollingMilliseconds(state.pollingConfig.pollInterval);
          deadline = Math.min(
            deadline,
            Date.now() +
              Number.parseFloat(state.pollingConfig.timeoutIn) * 1000,
          );
        }
      }
      if (!cancelled.current) {
        await cancel();
        setStatus(
          "Photo selection timed out. Please try again or upload directly.",
        );
      }
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="picker">
      <Button variant="outline" onClick={start} disabled={busy}>
        <span className="google-g">G</span>
        {busy ? "Waiting for your selection…" : "Choose from Google Photos"}
      </Button>
      {busy && (
        <button className="text-link" onClick={cancel}>
          Cancel
        </button>
      )}
      {pickerUri && (
        <a
          className="text-link"
          href={pickerUri}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open photo selection
        </a>
      )}
      <p className="fine-print">
        Separate permission. Only photos you explicitly select.
      </p>
      {status && (
        <p role="status" className="small-note">
          {status}
        </p>
      )}
    </div>
  );
}

export function PersonSelection({
  photo,
  onSaved,
}: {
  photo: Photo;
  onSaved: () => void;
}) {
  const [box, setBox] = useState<Box>(photo.person_box);
  const [group, setGroup] = useState(photo.group_photo);
  const [error, setError] = useState("");
  async function save() {
    try {
      await api("/photos/" + photo.id, {
        method: "PATCH",
        body: JSON.stringify({ person_box: box, group_photo: group }),
      });
      setError(
        "Selection saved. Google AI will find visible garments when enabled.",
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="selection-card">
      <div className="selection-image">
        <Media
          src={"media:" + photo.media_id}
          alt="Your selected source photo"
        />
        <div
          className="person-box"
          style={{
            left: box.x * 100 + "%",
            top: box.y * 100 + "%",
            width: box.width * 100 + "%",
            height: box.height * 100 + "%",
          }}
        />
      </div>
      <div className="selection-controls">
        <label className="check-line">
          <input
            type="checkbox"
            checked={group}
            onChange={(e) => setGroup(e.target.checked)}
          />
          This is a group photo
        </label>
        <p className="fine-print">
          For group photos, frame only the person whose clothes you own.
        </p>
        {(["x", "y", "width", "height"] as const).map((k) => (
          <label className="range-field" key={k}>
            {{ x: "Left", y: "Top", width: "Width", height: "Height" }[k]}
            <input
              aria-label={"Person selection " + k}
              type="range"
              min={k === "width" || k === "height" ? 0.05 : 0}
              max={
                k === "x"
                  ? 1 - box.width
                  : k === "y"
                    ? 1 - box.height
                    : k === "width"
                      ? 1 - box.x
                      : 1 - box.y
              }
              step=".01"
              value={box[k]}
              onChange={(e) => setBox({ ...box, [k]: Number(e.target.value) })}
            />
          </label>
        ))}
        <Button size="sm" variant="outline" onClick={save}>
          Save person selection
        </Button>
        {error && (
          <p role="status" className="fine-print">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function GarmentEditor({
  item,
  onClose,
  onSaved,
}: {
  item: WardrobeItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(item);
  const [error, setError] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const qc = useQueryClient();
  async function imageAction(action: "create" | "retry" | "remove") {
    setImageBusy(true);
    setError("");
    try {
      if (action === "create") await post(`/wardrobe/${item.id}/shop-image`);
      if (action === "retry")
        await post(`/jobs/${item.shop_image_job_id}/retry`);
      if (action === "remove") await del(`/jobs/${item.shop_image_job_id}`);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImageBusy(false);
    }
  }
  async function save() {
    try {
      await put("/wardrobe/" + value.id, value);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Make it yours"
      description="Confirm only what you own. Correct anything that doesn’t look right."
    >
      <div className="editor-grid">
        <div className="garment-evidence">
          {item.generated_image && (
            <figure>
              <Media
                src={item.generated_image}
                alt={`AI-generated shop-style ${item.name}`}
                className="editor-image"
              />
              <figcaption>AI-generated shop-style image</figcaption>
            </figure>
          )}
          <figure>
            <Media
              src={item.image}
              alt={`Original crop of ${item.name}`}
              className="editor-image"
            />
            <figcaption>
              {item.evidence === "original_crop"
                ? "Original photo crop · Evidence"
                : "Garment reference"}
            </figcaption>
          </figure>
          {item.evidence === "original_crop" && (
            <div className="form-stack">
              <p className="fine-print">
                Shop-style images are AI reconstructions. Compare colour and
                details with your original; hidden details may differ.
              </p>
              {["queued", "running"].includes(item.shop_image_status || "") && (
                <p role="status" className="fine-print">
                  Gemini is preparing your shop-style image. You can confirm
                  this garment now.
                </p>
              )}
              {item.shop_image_status === "failed" && (
                <>
                  <p role="status" className="fine-print">
                    {item.shop_image_error ||
                      "The shop-style image could not be created. Your original crop is available."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={imageBusy}
                    onClick={() => imageAction("retry")}
                  >
                    Retry shop-style image
                  </Button>
                </>
              )}
              {!item.shop_image_job_id && !item.generated_image && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={imageBusy}
                  onClick={() => imageAction("create")}
                >
                  Create shop-style image
                </Button>
              )}
              {item.shop_image_job_id &&
                item.shop_image_status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={imageBusy}
                    onClick={() => imageAction("remove")}
                  >
                    Keep original only
                  </Button>
                )}
            </div>
          )}
        </div>
        <div className="form-stack">
          <label className="field">
            Garment name
            <input
              value={value.name}
              onChange={(e) => setValue({ ...value, name: e.target.value })}
            />
          </label>
          <label className="field">
            Category
            <select
              aria-label="Category"
              value={value.category}
              onChange={(e) => setValue({ ...value, category: e.target.value })}
            >
              {[
                "unknown",
                "top",
                "bottom",
                "dress",
                "jacket",
                "shoes",
                "bag",
                "accessory",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Colour
            <input
              value={value.colour}
              onChange={(e) => setValue({ ...value, colour: e.target.value })}
            />
          </label>
          <label className="field">
            Visible details
            <textarea
              value={value.details}
              onChange={(e) => setValue({ ...value, details: e.target.value })}
            />
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={value.confirmed}
              onChange={(e) =>
                setValue({ ...value, confirmed: e.target.checked })
              }
            />
            I own this garment
          </label>
        </div>
      </div>
      {item.uncertainty.map((t, i) => (
        <p key={i} className="fine-print">
          {t}
        </p>
      ))}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button onClick={save}>
        Save garment <Check size={16} />
      </Button>
    </Modal>
  );
}

export function WardrobeReview({
  items,
  duplicates,
  onRefresh,
}: {
  items: WardrobeItem[];
  duplicates: Duplicate[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<WardrobeItem | null>(null);
  const [error, setError] = useState("");
  async function confirm(item: WardrobeItem) {
    if (item.category === "unknown") {
      setEditing(item);
      return;
    }
    try {
      await put("/wardrobe/" + item.id, {
        ...item,
        confirmed: !item.confirmed,
      });
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(id: string) {
    await del("/wardrobe/" + id);
    onRefresh();
  }
  function add() {
    setEditing({
      id: crypto.randomUUID(),
      name: "",
      category: "top",
      colour: "",
      pattern: "Unknown",
      details: "",
      brand: null,
      material: null,
      size: null,
      image: "",
      source_photo_id: null,
      box: null,
      uncertainty: [],
      confirmed: false,
      sample: false,
      evidence: "manual",
      created_at: new Date().toISOString(),
    });
  }
  return (
    <>
      <div className="section-line">
        <span className="muted">
          {items.filter((i) => i.confirmed).length} confirmed · {items.length}{" "}
          pieces
        </span>
        <Button variant="outline" size="sm" onClick={add}>
          <Plus size={15} />
          Add a garment
        </Button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="garment-grid">
        {items.map((item) => (
          <article
            className={"garment-card " + (item.confirmed ? "confirmed" : "")}
            key={item.id}
          >
            <button
              className="garment-image"
              onClick={() => setEditing(item)}
              aria-label={"Edit " + item.name}
            >
              <Media src={item.generated_image || item.image} alt={item.name} />
              {item.sample && <span className="image-badge">Sample</span>}
              {item.generated_image && (
                <span className="image-badge">AI-generated</span>
              )}
            </button>
            <div className="garment-info">
              <button className="garment-name" onClick={() => setEditing(item)}>
                {item.name}
              </button>
              <p>
                {item.colour} · {item.category}
              </p>
              {["queued", "running"].includes(item.shop_image_status || "") && (
                <p className="fine-print" role="status">
                  Creating shop-style image…
                </p>
              )}
              {item.shop_image_status === "failed" && (
                <p className="fine-print">
                  Original crop · Image generation needs attention
                </p>
              )}
              <div className="garment-actions">
                <button
                  className={
                    "confirm-button " + (item.confirmed ? "is-confirmed" : "")
                  }
                  onClick={() => confirm(item)}
                >
                  {item.confirmed ? (
                    <CheckCheck size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                  {item.confirmed ? "Confirmed" : "Confirm ownership"}
                </button>
                <button
                  className="icon-button small"
                  onClick={() => remove(item.id)}
                  aria-label={"Remove " + item.name}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {duplicates
        .filter((d) => d.status === "pending")
        .map((d) => (
          <div className="notice" key={d.id}>
            <strong>Possible duplicate</strong>
            <p>{d.reason}</p>
            <div className="button-row">
              <Button
                size="sm"
                onClick={async () => {
                  await post("/duplicates/" + d.id, {
                    action: "merge",
                    keep_id: d.item_ids[0],
                  });
                  onRefresh();
                }}
              >
                Merge; keep first
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await post("/duplicates/" + d.id, { action: "separate" });
                  onRefresh();
                }}
              >
                Keep separate
              </Button>
            </div>
          </div>
        ))}
      {editing && (
        <GarmentEditor
          key={editing.id}
          item={items.find((item) => item.id === editing.id) || editing}
          onClose={() => setEditing(null)}
          onSaved={onRefresh}
        />
      )}
    </>
  );
}

export function Onboarding({
  profile,
  config,
  onComplete,
  onExit,
}: {
  profile: Profile;
  config: Config;
  onComplete: () => void;
  onExit: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const wardrobe = useQuery({
    queryKey: ["wardrobe"],
    queryFn: () =>
      api<{ items: WardrobeItem[]; duplicates: Duplicate[] }>("/wardrobe"),
    refetchInterval: step === 3 ? 2000 : false,
  });
  const photoQuery = useQuery({
    queryKey: ["photos"],
    queryFn: () => api<{ photos: Photo[]; references: Reference[] }>("/photos"),
  });
  const jobQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api<{ jobs: Job[] }>("/jobs"),
    refetchInterval: step >= 2 ? 2000 : false,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["wardrobe"] });
    qc.invalidateQueries({ queryKey: ["photos"] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };
  const active =
    jobQuery.data?.jobs.filter(
      (j) => j.kind === "wardrobe" && ["queued", "running"].includes(j.status),
    ) || [];
  async function process() {
    try {
      if (photoQuery.data?.photos.length) {
        await post("/wardrobe/import", {
          photo_ids: photoQuery.data.photos.map((p) => p.id).slice(0, 12),
        });
        qc.invalidateQueries({ queryKey: ["jobs"] });
      }
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function finish() {
    try {
      await post("/onboarding/complete");
      // Keep the first chat gated until the confirmed server state has arrived.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["profile"] }),
        qc.invalidateQueries({ queryKey: ["wardrobe"] }),
      ]);
      onComplete();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="onboarding">
      <header className="onboarding-header">
        {config.mode === "demo" && <span className="pill">Demo data</span>}
        <button className="wordmark" onClick={onExit}>
          flairify<span>✧</span>
        </button>
        <button
          className="button button-ghost"
          onClick={onExit}
          aria-label="Browse clothes first"
        >
          Browse clothes first
        </button>
      </header>
      <div className="onboarding-progress">
        {["Your style", "Your reference", "Your wardrobe", "Make it yours"].map(
          (s, i) => (
            <div
              className={i === step ? "active" : i < step ? "done" : ""}
              key={s}
            >
              <span>{i < step ? <Check size={13} /> : i + 1}</span>
              {s}
            </div>
          ),
        )}
      </div>
      <main className="onboarding-content">
        <div className="eyebrow">A GOOD OUTFIT STARTS WITH YOU</div>
        <h1>
          {
            [
              "Let’s get to know your style.",
              "A familiar face. Yours.",
              "Your wardrobe, a new perspective.",
              "A few pieces. So many possibilities.",
            ][step]
          }
        </h1>
        <p className="page-subtitle">
          {
            [
              "Save your shopping preferences once. Photos and wardrobe pairing are optional.",
              "Clear light, a simple background, and your whole outfit in the frame.",
              "Share a few outfit photos. We’ll help you find pieces that work with what you already wear.",
              "Keep what you own. Correct the details. You’re always the final say.",
            ][step]
          }
        </p>
        {step === 0 && (
          <div className="narrow-form">
            <ProfileForm
              profile={profile}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["profile"] });
                setStep(1);
              }}
            />
          </div>
        )}
        {step === 1 && (
          <>
            <div className="notice">
              <p>
                Your shopping preferences are saved. You can add photos later.
              </p>
              <Button onClick={finish}>Start shopping without photos</Button>
            </div>
            {config.analysis === "gemini" &&
              !profile.consent.ai_photo_processing && (
                <label className="check-line notice">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={async (e) => {
                      if (e.target.checked) {
                        const { admin, demo, seller, ...data } = profile;
                        await put("/profile", {
                          ...data,
                          consent: {
                            ...data.consent,
                            ai_photo_processing: true,
                          },
                        });
                        qc.invalidateQueries({ queryKey: ["profile"] });
                      }
                    }}
                  />
                  Allow Google AI to automatically find visible garments in my
                  outfit photos and create previews when I request them.
                </label>
              )}
            <div className="reference-grid">
              {["portrait", "full_body"].map((kind) => (
                <div className="white-panel" key={kind}>
                  <h3>
                    {kind === "portrait"
                      ? "Your portrait"
                      : "Your full-body photo"}
                  </h3>
                  <p>
                    {kind === "portrait"
                      ? "Face clearly visible, without sunglasses."
                      : "Head to toe, standing naturally, clothes visible."}
                  </p>
                  {photoQuery.data?.references.find((r) => r.kind === kind) ? (
                    <div className="reference-thumb">
                      <Media
                        src={
                          "media:" +
                          photoQuery.data.references.find(
                            (r) => r.kind === kind,
                          )!.media_id
                        }
                        alt={kind}
                      />
                      <button
                        className="text-link"
                        onClick={async () => {
                          await del("/photos/" + kind);
                          refresh();
                        }}
                      >
                        Delete photo
                      </button>
                    </div>
                  ) : null}
                  <UploadZone kind={kind} onDone={refresh} />
                </div>
              ))}
            </div>
            <div className="notice">
              <ShieldCheck size={20} />
              <p>
                Your full-body photo is also checked for visible garments when
                you allow Google AI processing. Reference photos stay private;
                style previews are generated only on request. They do not
                provide accurate body measurements. You can replace or delete
                them anytime.
              </p>
            </div>
            <Button
              onClick={() =>
                photoQuery.data?.photos.length ? process() : setStep(2)
              }
            >
              {photoQuery.data?.photos.length
                ? "Review detected garments"
                : "Continue"}{" "}
              <ArrowRight size={16} />
            </Button>
            <button className="text-link" onClick={() => setStep(2)}>
              Add reference photos later
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <div className="import-grid">
              <div>
                <UploadZone onDone={refresh} />
                <PhotoPicker config={config} onDone={refresh} />
              </div>
              <div className="import-tips">
                <ImagePlus size={30} />
                <h3>A small start is a good start.</h3>
                <p>
                  A few clear photos are plenty. Choose outfits you still own
                  and love.
                </p>
                <ul>
                  <li>Good light helps us see details.</li>
                  <li>Include as much of each garment as possible.</li>
                  <li>For group photos, select yourself below.</li>
                </ul>
                {profile.demo && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await post("/wardrobe/sample");
                      refresh();
                      setStep(3);
                    }}
                  >
                    Explore with a sample wardrobe
                  </Button>
                )}
              </div>
            </div>
            {photoQuery.data?.photos.map((p) => (
              <PersonSelection key={p.id} photo={p} onSaved={refresh} />
            ))}
            <Button
              onClick={process}
              disabled={!photoQuery.data?.photos.length}
            >
              Review my wardrobe <ArrowRight size={16} />
            </Button>
          </>
        )}
        {step === 3 && (
          <>
            {active.map((j) => (
              <div className="notice" role="status" key={j.id}>
                <LoaderCircle className="spin" size={20} />
                <span>{j.stage} — this page will update when ready.</span>
              </div>
            ))}
            {jobQuery.data?.jobs
              .filter((j) => j.kind === "wardrobe" && j.status === "failed")
              .map((j) => (
                <div className="notice error" key={j.id}>
                  {j.error}
                </div>
              ))}
            {config.analysis === "manual" && (
              <div className="notice">
                <p>
                  Automatic photo analysis is not connected in demo mode.
                  Uploaded photos need your descriptions; the sample wardrobe
                  uses labeled fixtures.
                </p>
              </div>
            )}
            <WardrobeReview
              items={wardrobe.data?.items || []}
              duplicates={wardrobe.data?.duplicates || []}
              onRefresh={refresh}
            />
            <div className="completion-line">
              <div>
                <h3>Your wardrobe, ready for more.</h3>
                <p>
                  {wardrobe.data?.items.filter((i) => i.confirmed).length || 0}{" "}
                  confirmed garments
                </p>
              </div>
              <Button
                disabled={
                  !wardrobe.data?.items.some((i) => i.confirmed) ||
                  active.length > 0
                }
                onClick={finish}
              >
                Meet your stylist <ArrowRight size={17} />
              </Button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {step > 0 && (
          <button
            className="text-link back-link"
            onClick={() => setStep(step - 1)}
          >
            ← Back
          </button>
        )}
      </main>
      <footer className="onboarding-footer">
        <ShieldCheck size={15} />
        Your wardrobe. Your choices. Always.
      </footer>
    </div>
  );
}
