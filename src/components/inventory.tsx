"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, WandSparkles, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";
import type { Product, Shop } from "@/lib/types";
import { Media } from "./media";
import { Button } from "./ui/button";

export function Inventory({
  onTryOn,
}: {
  onTryOn: (product: Product) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: () => api<{ products: Product[] }>("/catalog"),
  });
  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: () => api<{ stores: Shop[] }>("/stores"),
  });
  const products = (catalog.data?.products || []).filter(
    (p) =>
      (!category || p.category === category) &&
      (!query ||
        `${p.name} ${p.category} ${p.description}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!availableOnly ||
        p.variants.some((v) => v.stock.some((s) => s.quantity > 0))),
  );
  return (
    <div className="page-content inventory-page">
      <div className="eyebrow">A THOUGHTFUL ADDITION</div>
      <h1>Find your next favourite.</h1>
      <p className="page-subtitle">
        Browse the inventory. Choose a piece and see a 2D style preview on your
        own photo.
      </p>
      <div className="notice">
        <p>
          Sample catalogue · These photographs, prices and store quantities are
          for the prototype. They are not a live retailer offer. Previews use
          Google AI and your chosen photo.
        </p>
      </div>
      <div className="inventory-filters">
        <label className="field">
          <span>
            <Search size={15} /> Search inventory
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A shirt, a jacket, a fresh possibility…"
          />
        </label>
        <label className="field">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {[
              "jacket",
              "top",
              "bottom",
              "dress",
              "shoes",
              "bag",
              "accessory",
            ].map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />{" "}
          In stock only
        </label>
      </div>
      {catalog.isLoading && <p role="status">Loading the inventory…</p>}
      {catalog.error && (
        <p role="alert" className="error">
          {catalog.error.message}
        </p>
      )}
      <p className="small-note">{products.length} pieces</p>
      <div className="inventory-grid">
        {products.map((p) => {
          const variants = p.variants.filter((v) =>
            v.stock.some((s) => s.quantity > 0),
          );
          const storeIds = [
            ...new Set(
              variants.flatMap((v) =>
                v.stock.filter((s) => s.quantity > 0).map((s) => s.store_id),
              ),
            ),
          ];
          return (
            <article className="white-panel inventory-card" key={p.id}>
              <div className="inventory-photo">
                <Media src={p.image} alt={p.name} catalog />
                {p.sample && <span className="pill">Sample item</span>}
              </div>
              <div className="inventory-card-body">
                <div className="section-line">
                  <span className="eyebrow">{p.category}</span>
                  <strong>{money(p.price)}</strong>
                </div>
                <h3>{p.name}</h3>
                <p className="small-note">
                  {variants.length
                    ? `Available sizes: ${[...new Set(variants.map((v) => v.size))].join(", ")}`
                    : "Currently unavailable"}
                </p>
                <p className="small-note">
                  <MapPin size={14} />
                  {storeIds
                    .map(
                      (id) =>
                        stores.data?.stores.find((s) => s.id === id)?.name ||
                        id,
                    )
                    .join(" · ")}
                </p>
                <Button
                  disabled={!variants.length || !p.try_on_supported}
                  onClick={() => onTryOn(p)}
                >
                  <WandSparkles size={16} />
                  {p.try_on_supported
                    ? "Try this on"
                    : "Preview unavailable for this item"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!catalog.isLoading && !products.length && (
        <div className="empty-state">
          <h2>No pieces match yet.</h2>
          <p>Try another category or search term.</p>
        </div>
      )}
    </div>
  );
}
