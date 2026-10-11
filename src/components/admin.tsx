"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileUp,
  LockKeyhole,
  Plus,
  RefreshCw,
  Store as StoreIcon,
  Trash2,
} from "lucide-react";
import { api, post, put, uploadPhoto } from "@/lib/api";
import type { Job, Product, Profile, Shop, MockOrder } from "@/lib/types";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Media } from "./media";
import { OrderList } from "./checkout";

type SellerRequest = { id: string; email: string; status: string };
type Catalog = {
  products: Product[];
  stores: Shop[];
  editable_store_ids: string[];
};
const categories = [
  "top",
  "bottom",
  "jacket",
  "dress",
  "shoes",
  "bag",
  "accessory",
];

export function Admin({
  profile,
  demoAdmin,
}: {
  profile: Profile;
  demoAdmin: boolean;
}) {
  const qc = useQueryClient();
  const allowed = !!(profile.admin || profile.seller);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [storeEditing, setStoreEditing] = useState<Shop | null>(null);
  const data = useQuery({
    queryKey: ["admin"],
    queryFn: () => api<Catalog>("/admin/catalog"),
    enabled: allowed,
    refetchInterval: 5000,
  });
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api<{ jobs: Job[] }>("/jobs"),
    enabled: allowed,
    refetchInterval: 5000,
  });
  const incoming = useQuery({
    queryKey: ["seller-orders"],
    queryFn: () => api<{ orders: MockOrder[] }>("/admin/orders"),
    enabled: allowed,
    refetchInterval: 15000,
  });
  const access = useQuery({
    queryKey: ["seller-access"],
    queryFn: () =>
      api<{ approved: boolean; request: SellerRequest | null }>(
        "/seller-access",
      ),
    enabled: !allowed,
  });
  const requests = useQuery({
    queryKey: ["seller-requests"],
    queryFn: () => api<{ requests: SellerRequest[] }>("/admin/seller-requests"),
    enabled: !!profile.admin && !profile.demo,
    refetchInterval: 15000,
  });
  const editableStores = (data.data?.stores || []).filter((s) =>
    data.data?.editable_store_ids.includes(s.id),
  );
  function refresh() {
    for (const k of [
      "admin",
      "catalog",
      "stores",
      "jobs",
      "seller-access",
      "seller-requests",
      "profile",
    ])
      qc.invalidateQueries({ queryKey: [k] });
  }
  async function action(fn: () => Promise<unknown>, message = "") {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      refresh();
      setSuccess(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function addProduct() {
    setCreating(true);
    setEditing({
      id: "p-" + crypto.randomUUID(),
      sku: "",
      name: "",
      brand: "",
      description: "",
      category: "top",
      price: 0,
      currency: "INR",
      image: "",
      variants: [
        {
          id: crypto.randomUUID(),
          size: "M",
          colour: "",
          stock: [
            {
              store_id: editableStores[0]?.id || "",
              quantity: 0,
              aisle: "",
              rack: "",
            },
          ],
        },
      ],
      attributes: {},
      ai_attributes: {},
      delivery: [],
      sample: !!profile.demo,
      indexed: false,
      active: true,
      content_hash: "",
      updated_at: new Date().toISOString(),
    });
  }
  if (!allowed)
    return (
      <main className="page-content">
        <span className="eyebrow">FOR OWNERS & SELLERS</span>
        <h1>Seller Studio.</h1>
        <p className="page-subtitle">
          Bring your clothes into the conversation.
        </p>
        <div className="white-panel seller-access">
          <LockKeyhole size={32} />
          <h2>A space for your collection.</h2>
          <p>
            Add product photos, sizes, prices and store stock. Once indexed,
            your listings appear in Inventory and can be considered by the
            stylist. Review saved mock orders here too.
          </p>
          {profile.demo ? (
            <p>
              Sign in with Google or email, then request seller access. The
              website owner approves sellers before they can change the shared
              inventory.
            </p>
          ) : (
            <>
              <p>
                {access.data?.request?.status === "pending"
                  ? "Your request is waiting for the website owner’s approval."
                  : access.data?.request?.status === "revoked"
                    ? "Your previous access was revoked. You may request access again."
                    : "Request access from the website owner to manage your listings."}
              </p>
              <div className="button-row">
                <Button
                  disabled={busy || access.data?.request?.status === "pending"}
                  onClick={() =>
                    action(
                      () => post("/seller-access/request"),
                      "Seller access requested.",
                    )
                  }
                >
                  Request seller access
                </Button>
                <Button variant="outline" onClick={refresh}>
                  Check access
                </Button>
              </div>
            </>
          )}
          {profile.demo && demoAdmin && (
            <div className="form-stack">
              <p className="fine-print">
                Local demo only: edit your isolated sample catalogue.
              </p>
              <label className="field">
                Demo administrator key
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              </label>
              <Button
                disabled={busy || !key}
                onClick={() => action(() => post("/admin/unlock", { key }))}
              >
                Unlock workspace
              </Button>
            </div>
          )}
          {(error || access.error) && (
            <p role="alert" className="error">
              {error || access.error?.message}
            </p>
          )}
          {success && <p role="status">{success}</p>}
        </div>
      </main>
    );
  return (
    <main className="page-content seller-page">
      <span className="eyebrow">
        {profile.admin ? "OWNER" : "SELLER"} WORKSPACE
      </span>
      <h1>Your collection, considered.</h1>
      <p className="page-subtitle">
        Add clothes. Keep availability current. Help someone find their next
        favourite.
      </p>
      <div className="notice">
        <p>
          All orders on Flairify are mock purchases. They are saved for review,
          with no payment, delivery, or stock reservation.
          {profile.demo
            ? " You are editing only your private demo catalogue."
            : " New listings are indexed automatically for Inventory and stylist recommendations."}
        </p>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="notice" role="status">
          {success}
        </p>
      )}
      <div className="button-row">
        <Button onClick={addProduct} disabled={busy}>
          <Plus size={17} />
          Add clothes
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setStoreEditing({
              id: "store-" + crypto.randomUUID(),
              name: "",
              address: "",
              latitude: null,
              longitude: null,
              sample: !!profile.demo,
            })
          }
        >
          <StoreIcon size={17} />
          Add store
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            action(
              () => post("/admin/reindex"),
              "Indexing requested. Check activity below.",
            )
          }
        >
          <RefreshCw size={16} />
          Reindex listings
        </Button>
      </div>
      {!editableStores.length && (
        <p className="notice">
          Start by adding a store or seller location, then add your clothes and
          sizes.
        </p>
      )}
      {data.error && (
        <p className="error" role="alert">
          {data.error.message}
        </p>
      )}
      <div className="inventory-grid seller-products">
        {data.data?.products.map((p) => (
          <article className="white-panel inventory-card" key={p.id}>
            <div className="inventory-photo">
              <Media src={p.image} alt={p.name} catalog />
              <span className="pill">
                {p.active === false
                  ? "Archived"
                  : p.indexed
                    ? "Searchable"
                    : "Indexing"}
              </span>
            </div>
            <div className="inventory-card-body">
              <div className="section-line">
                <h3>{p.name}</h3>
                <strong>{money(p.price)}</strong>
              </div>
              <p className="small-note">
                {p.sku} · {p.variants.length} sizes ·{" "}
                {p.variants
                  .flatMap((v) => v.stock)
                  .reduce((n, s) => n + s.quantity, 0)}{" "}
                units{p.sample ? " · Sample item" : ""}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setEditing(structuredClone(p));
                }}
              >
                Edit listing
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!data.isLoading && !data.data?.products.length && (
        <div className="empty-state">
          <h2>Make room for your first piece.</h2>
          <p>A clear photo and accurate sizes make a useful listing.</p>
        </div>
      )}
      <h2>Your stores</h2>
      <div className="store-grid">
        {editableStores.map((s) => (
          <button
            className="white-panel store-card"
            key={s.id}
            onClick={() => setStoreEditing({ ...s })}
          >
            <StoreIcon size={20} />
            <h3>{s.name}</h3>
            <p>{s.address}</p>
            <small>Edit store</small>
          </button>
        ))}
      </div>
      <details className="seller-import">
        <summary>Import several products from CSV or JSON</summary>
        <p className="fine-print">
          Required fields: id, sku, name, category, price, image, variants.
          Upload product images first; use their returned media references.
          Stock must reference your stores. Existing IDs update your listings.
        </p>
        <label className="button button-outline">
          <FileUp size={16} />
          Choose import file
          <input
            disabled={busy}
            type="file"
            className="sr-only"
            accept=".csv,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                action(async () => {
                  const form = new FormData();
                  form.append("file", file);
                  await api("/admin/import", { method: "POST", body: form });
                }, "Import queued. Check indexing activity.");
              e.target.value = "";
            }}
          />
        </label>
      </details>
      <h2>Indexing activity</h2>
      {jobs.error && (
        <p role="alert" className="error">
          {jobs.error.message}
        </p>
      )}
      {jobs.data?.jobs
        .filter((j) => j.kind === "index")
        .slice(-6)
        .reverse()
        .map((j) => (
          <div className="job-row" key={j.id}>
            <span>{j.stage}</span>
            <span className="pill">{j.status}</span>
            {j.error && <span className="error">{j.error}</span>}
          </div>
        ))}
      <h2>Mock orders received</h2>
      <p className="small-note">
        {profile.admin
          ? "Orders across the catalogue."
          : "Only items from your own listings are shown."}{" "}
        No customer payment or delivery details are collected.
      </p>
      {incoming.error && (
        <p role="alert" className="error">
          {incoming.error.message}
        </p>
      )}
      <OrderList orders={incoming.data?.orders || []} seller={!profile.admin} />
      {!incoming.isLoading && !incoming.data?.orders.length && (
        <p className="small-note">No mock orders yet.</p>
      )}
      {profile.admin && !profile.demo && (
        <section className="seller-requests">
          <h2>Seller access requests</h2>
          {requests.error && (
            <p className="error" role="alert">
              {requests.error.message}
            </p>
          )}
          {!requests.data?.requests.length && (
            <p className="small-note">No requests yet.</p>
          )}
          {requests.data?.requests.map((r) => (
            <div className="white-panel seller-request" key={r.id}>
              <div>
                <strong>{r.email || "Signed-in account"}</strong>
                <p className="small-note">{r.status}</p>
              </div>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() =>
                  action(() =>
                    post(
                      `/admin/seller-requests/${encodeURIComponent(r.id)}/${r.status === "approved" ? "revoke" : "approve"}`,
                    ),
                  )
                }
              >
                {r.status === "approved"
                  ? "Revoke seller access"
                  : "Approve seller"}
              </Button>
            </div>
          ))}
        </section>
      )}
      {editing && (
        <ProductEditor
          product={editing}
          creating={creating}
          stores={editableStores}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            setSuccess(
              "Listing saved. It will appear in Inventory and recommendations after indexing succeeds.",
            );
          }}
        />
      )}
      {storeEditing && (
        <StoreEditor
          value={storeEditing}
          onClose={() => setStoreEditing(null)}
          onSaved={() => {
            setStoreEditing(null);
            refresh();
            setSuccess("Store saved.");
          }}
        />
      )}
    </main>
  );
}

function ProductEditor({
  product,
  creating,
  stores,
  onClose,
  onSaved,
}: {
  product: Product;
  creating: boolean;
  stores: Shop[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [p, setP] = useState(product);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  function variant(index: number, value: Partial<Product["variants"][number]>) {
    setP((old) => ({
      ...old,
      variants: old.variants.map((v, i) =>
        i === index ? { ...v, ...value } : v,
      ),
    }));
  }
  async function upload(file: File) {
    setError("");
    setProgress(0);
    try {
      const result = (await uploadPhoto(
        file,
        "product",
        setProgress,
        true,
      )) as { image: string };
      setP((old) => ({ ...old, image: result.image }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!p.image) {
      setError("Upload a clear product photo first.");
      return;
    }
    if (
      !stores.length ||
      p.variants.some(
        (v) => !v.stock.length || v.stock.some((s) => !s.store_id),
      )
    ) {
      setError("Add a store and stock for every size.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...p,
        attributes: { ...p.attributes, colour: p.variants[0]?.colour || "" },
      };
      delete payload.try_on_supported;
      delete payload.availability;
      delete payload.store;
      await (creating
        ? post("/admin/products", payload)
        : put("/admin/products/" + encodeURIComponent(p.id), payload));
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      wide
      onOpenChange={(v) => !v && !busy && progress === null && onClose()}
      title={creating ? "Add clothes to your collection" : "Edit your listing"}
      description="Supply the product facts. We’ll index the listing for discovery and recommendations."
    >
      <form className="form-stack" onSubmit={save}>
        <fieldset
          disabled={busy || progress !== null}
          className="seller-fields"
        >
          <div className="seller-photo-upload">
            {p.image && <Media src={p.image} alt="Product photo" catalog />}
            <label className="field">
              Product photo
              <input
                type="file"
                aria-label="Product photo"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                  e.target.value = "";
                }}
              />
              <small>
                Use a photo you have permission to publish. JPEG, PNG or WebP.
              </small>
            </label>
          </div>
          {progress !== null && (
            <p role="status">Uploading photo: {progress}%</p>
          )}
          <div className="form-grid">
            <label className="field">
              Product name
              <input
                required
                maxLength={150}
                value={p.name}
                onChange={(e) => setP({ ...p, name: e.target.value })}
              />
            </label>
            <label className="field">
              SKU
              <input
                required
                maxLength={100}
                value={p.sku}
                onChange={(e) => setP({ ...p, sku: e.target.value })}
              />
            </label>
            <label className="field">
              Brand (optional)
              <input
                maxLength={100}
                value={p.brand}
                onChange={(e) => setP({ ...p, brand: e.target.value })}
              />
            </label>
            <label className="field">
              Category
              <select
                value={p.category}
                onChange={(e) => setP({ ...p, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option value={c} key={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Price (INR)
              <input
                required
                type="number"
                min="0"
                max="10000000"
                step="1"
                value={Number.isNaN(p.price) ? "" : p.price}
                onChange={(e) => setP({ ...p, price: e.target.valueAsNumber })}
              />
            </label>
          </div>
          <label className="field">
            Description
            <textarea
              maxLength={2000}
              value={p.description}
              onChange={(e) => setP({ ...p, description: e.target.value })}
              placeholder="Visible details, construction, and any verified product facts."
            />
          </label>
          <h3>Sizes and availability</h3>
          <p className="small-note">
            Enter supplied stock quantities. Use zero for unavailable sizes.
          </p>
          {p.variants.map((v, index) => (
            <section className="variant-editor" key={v.id}>
              <div className="section-line">
                <h4>Size option {index + 1}</h4>
                {p.variants.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove size option ${index + 1}`}
                    onClick={() =>
                      setP({
                        ...p,
                        variants: p.variants.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
              <div className="form-grid">
                <label className="field">
                  Size
                  <input
                    required
                    maxLength={20}
                    value={v.size}
                    onChange={(e) => variant(index, { size: e.target.value })}
                  />
                </label>
                <label className="field">
                  Colour
                  <input
                    required
                    maxLength={60}
                    value={v.colour}
                    onChange={(e) => variant(index, { colour: e.target.value })}
                  />
                </label>
              </div>
              {v.stock.map((stock, si) => (
                <div className="stock-editor" key={si}>
                  <div className="form-grid">
                    <label className="field">
                      Store
                      <select
                        required
                        value={stock.store_id}
                        onChange={(e) =>
                          variant(index, {
                            stock: v.stock.map((s, i) =>
                              i === si ? { ...s, store_id: e.target.value } : s,
                            ),
                          })
                        }
                      >
                        <option value="">Choose a store</option>
                        {stores
                          .filter(
                            (s) =>
                              s.id === stock.store_id ||
                              !v.stock.some((other) => other.store_id === s.id),
                          )
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="field">
                      Stock quantity
                      <input
                        required
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        value={
                          Number.isNaN(stock.quantity) ? "" : stock.quantity
                        }
                        onChange={(e) =>
                          variant(index, {
                            stock: v.stock.map((s, i) =>
                              i === si
                                ? { ...s, quantity: e.target.valueAsNumber }
                                : s,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      Aisle (optional)
                      <input
                        value={stock.aisle || ""}
                        onChange={(e) =>
                          variant(index, {
                            stock: v.stock.map((s, i) =>
                              i === si ? { ...s, aisle: e.target.value } : s,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      Rack (optional)
                      <input
                        value={stock.rack || ""}
                        onChange={(e) =>
                          variant(index, {
                            stock: v.stock.map((s, i) =>
                              i === si ? { ...s, rack: e.target.value } : s,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                  {v.stock.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        variant(index, {
                          stock: v.stock.filter((_, i) => i !== si),
                        })
                      }
                    >
                      Remove store stock
                    </Button>
                  )}
                </div>
              ))}
              {v.stock.length < stores.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    variant(index, {
                      stock: [
                        ...v.stock,
                        {
                          store_id:
                            stores.find(
                              (s) => !v.stock.some((v) => v.store_id === s.id),
                            )?.id || "",
                          quantity: 0,
                        },
                      ],
                    })
                  }
                >
                  Add stock at another store
                </Button>
              )}
            </section>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={p.variants.length >= 50}
            onClick={() =>
              setP({
                ...p,
                variants: [
                  ...p.variants,
                  {
                    id: crypto.randomUUID(),
                    size: "",
                    colour: p.variants[0]?.colour || "",
                    stock: [{ store_id: stores[0]?.id || "", quantity: 0 }],
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            Add another size
          </Button>
          <label className="check-line">
            <input
              type="checkbox"
              checked={p.active !== false}
              onChange={(e) => setP({ ...p, active: e.target.checked })}
            />
            Active listing (uncheck to archive)
          </label>
          {p.sample && (
            <p className="fine-print">This listing is marked as sample data.</p>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="button-row">
          <Button
            type="submit"
            disabled={busy || progress !== null || !stores.length}
          >
            {busy ? "Saving…" : "Save and index listing"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || progress !== null}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StoreEditor({
  value,
  onClose,
  onSaved,
}: {
  value: Shop;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [s, setS] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title="Store or seller location"
      description="Use a real supplied address. Location coordinates are optional."
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await put("/admin/stores/" + encodeURIComponent(s.id), s);
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Store name
          <input
            required
            maxLength={150}
            value={s.name}
            onChange={(e) => setS({ ...s, name: e.target.value })}
          />
        </label>
        <label className="field">
          Address
          <input
            required
            maxLength={400}
            value={s.address}
            onChange={(e) => setS({ ...s, address: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Latitude (optional)
            <input
              type="number"
              min="-90"
              max="90"
              step="any"
              value={s.latitude ?? ""}
              onChange={(e) =>
                setS({
                  ...s,
                  latitude: e.target.value ? e.target.valueAsNumber : null,
                })
              }
            />
          </label>
          <label className="field">
            Longitude (optional)
            <input
              type="number"
              min="-180"
              max="180"
              step="any"
              value={s.longitude ?? ""}
              onChange={(e) =>
                setS({
                  ...s,
                  longitude: e.target.value ? e.target.valueAsNumber : null,
                })
              }
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : "Save store"}
        </Button>
      </form>
    </Modal>
  );
}
