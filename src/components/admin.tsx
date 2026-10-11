"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileUp,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  Store as StoreIcon,
} from "lucide-react";
import { api, post, put, uploadPhoto } from "@/lib/api";
import type { Job, Product, Profile, Shop } from "@/lib/types";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { Media } from "./media";

export function Admin({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [key, setKey] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [storeEditing, setStoreEditing] = useState<Shop | null>(null);
  const [json, setJson] = useState("");
  const data = useQuery({
    queryKey: ["admin"],
    queryFn: () =>
      api<{ products: Product[]; stores: Shop[] }>("/admin/catalog"),
    enabled: !!profile.admin,
  });
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api<{ jobs: Job[] }>("/jobs"),
    enabled: !!profile.admin,
    refetchInterval: 3000,
  });
  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["catalog"] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
  }
  async function doAction(fn: () => Promise<unknown>) {
    try {
      setError("");
      await fn();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importFile(file: File) {
    await doAction(async () => {
      const form = new FormData();
      form.append("file", file);
      await api("/admin/import", { method: "POST", body: form });
    });
  }
  if (!profile.admin)
    return (
      <div className="page-content">
        <div className="empty-state">
          <LockKeyhole size={32} />
          <h1>Retailer workspace.</h1>
          <p>
            Inventory tools require administrator access.
            <br />
            Demo changes affect only your own sample catalogue.
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
            onClick={() =>
              doAction(async () => {
                await post("/admin/unlock", { key });
                qc.invalidateQueries({ queryKey: ["profile"] });
              })
            }
          >
            Unlock workspace
          </Button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  return (
    <div className="page-content">
      <div className="eyebrow">RETAILER WORKSPACE</div>
      <h1>Thoughtfully stocked.</h1>
      <p className="page-subtitle">
        Products, variants, and availability. One source of truth.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <label className="button button-primary">
          <FileUp size={17} />
          Import CSV / JSON
          <input
            type="file"
            className="sr-only"
            accept=".csv,.json"
            onChange={(e) =>
              e.target.files?.[0] && importFile(e.target.files[0])
            }
          />
        </label>
        <Button
          variant="outline"
          onClick={() => doAction(() => post("/admin/reindex"))}
        >
          <RefreshCw size={16} />
          Reindex changed products
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setStoreEditing({
              id: "",
              name: "",
              address: "",
              latitude: null,
              longitude: null,
              sample: true,
            });
          }}
        >
          {" "}
          <Plus size={16} />
          Add store
        </Button>
      </div>
      <p className="fine-print">
        CSV fields: id, sku, name, category, price, image, variants (JSON).
        Existing store IDs are required. Images must be uploaded; remote
        fetching is disabled.
      </p>
      <div className="inventory-table-wrap">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Variants / stock</th>
              <th>Index</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {data.data?.products.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="table-product">
                    <Media src={p.image} alt={p.name} catalog />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {p.sku} · {p.sample ? "Sample" : "Retailer"}
                      </small>
                    </div>
                  </div>
                </td>
                <td>{money(p.price)}</td>
                <td>
                  {p.variants.length} sizes ·{" "}
                  {p.variants
                    .flatMap((v) => v.stock)
                    .reduce((n, s) => n + s.quantity, 0)}{" "}
                  units
                </td>
                <td>
                  <span className="pill">
                    {p.indexed ? "Searchable" : "Pending"}
                  </span>
                </td>
                <td>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(p);
                      setJson(JSON.stringify(p.variants, null, 2));
                    }}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Stores</h2>
      <div className="store-grid">
        {data.data?.stores.map((s) => (
          <button
            className="white-panel store-card"
            key={s.id}
            onClick={() => setStoreEditing(s)}
          >
            <StoreIcon size={20} />
            <h3>{s.name}</h3>
            <p>{s.address}</p>
            <small>{s.id} · Edit store</small>
          </button>
        ))}
      </div>
      <h2>Indexing activity</h2>
      {jobs.data?.jobs
        .filter((j) => j.kind === "index")
        .slice(0, 6)
        .map((j) => (
          <div className="job-row" key={j.id}>
            <span>{j.stage}</span>
            <span className="pill">{j.status}</span>
            {j.error && <span className="error">{j.error}</span>}
          </div>
        ))}
      {editing && (
        <Modal
          open
          onOpenChange={(v) => !v && setEditing(null)}
          title="Edit product and availability"
          description="Retailer facts stay distinct from AI suggestions."
        >
          <div className="form-stack">
            <label className="field">
              Name
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label className="field">
              Price (INR)
              <input
                type="number"
                min="0"
                value={editing.price}
                onChange={(e) =>
                  setEditing({ ...editing, price: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              Description
              <textarea
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </label>
            <label className="field">
              Product image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    doAction(async () => {
                      const r = (await uploadPhoto(
                        f,
                        "product",
                        () => {},
                        true,
                      )) as { image: string };
                      setEditing({ ...editing, image: r.image });
                    });
                }}
              />
            </label>
            <label className="field">
              Variants and stock (JSON)
              <textarea
                rows={10}
                className="code-input"
                value={json}
                onChange={(e) => setJson(e.target.value)}
              />
            </label>
            <Button
              onClick={() =>
                doAction(async () => {
                  await put("/admin/products/" + editing.id, {
                    ...editing,
                    variants: JSON.parse(json),
                  });
                  setEditing(null);
                })
              }
            >
              <Save size={16} />
              Save and index
            </Button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {storeEditing && (
        <Modal
          open
          onOpenChange={(v) => !v && setStoreEditing(null)}
          title="Store details"
        >
          <div className="form-stack">
            {(["id", "name", "address"] as const).map((field) => (
              <label className="field" key={field}>
                {field}
                <input
                  value={storeEditing[field]}
                  onChange={(e) =>
                    setStoreEditing({
                      ...storeEditing,
                      [field]: e.target.value,
                    })
                  }
                />
              </label>
            ))}
            {(["latitude", "longitude"] as const).map((field) => (
              <label className="field" key={field}>
                {field}
                <input
                  type="number"
                  value={storeEditing[field] ?? ""}
                  onChange={(e) =>
                    setStoreEditing({
                      ...storeEditing,
                      [field]:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
            <Button
              onClick={() =>
                doAction(async () => {
                  await put("/admin/stores/" + storeEditing.id, storeEditing);
                  setStoreEditing(null);
                })
              }
            >
              Save store
            </Button>
            {error && <p className="error">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
