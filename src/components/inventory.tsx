"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, WandSparkles, MapPin, ShoppingBag, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { money } from "@/lib/utils";
import type { Product, Shop } from "@/lib/types";
import { Media } from "./media";
import { Button } from "./ui/button";

export function Inventory({
  onTryOn,
  onBuy,
  onSell,
  onSetup,
  onReference,
  onSignIn,
}: {
  onTryOn: (product: Product) => Promise<void>;
  onSetup: () => void;
  onReference: () => void;
  onSignIn?: () => void;
  onBuy: (product: Product) => void;
  onSell: () => void;
}) {
  const [previewError, setPreviewError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [generating, setGenerating] = useState("");
  const lock = useRef(false);
  async function generate(product: Product) {
    if (lock.current) return;
    lock.current = true;
    setGenerating(product.id);
    setPreviewError(null);
    try {
      await onTryOn(product);
    } catch (e) {
      setPreviewError({ id: product.id, message: (e as Error).message });
    } finally {
      setGenerating("");
      lock.current = false;
    }
  }
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);
  const [availableOnly, setAvailableOnly] = useState(true);
  const catalog = useQuery({
    queryKey: ["catalog"],
    refetchInterval: 15000,
    queryFn: () => api<{ products: Product[] }>("/catalog"),
  });
  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: () => api<{ stores: Shop[] }>("/stores"),
  });
  const products = (catalog.data?.products || []).filter(
    (p) =>
      (!category || p.category === category) &&
      (!department ||
        p.attributes.department === department ||
        p.attributes.department === "unisex") &&
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
        Browse, try a piece on your photo, or place a mock order. No
        conversation needed.
      </p>
      <div className="notice">
        <p>
          Sample items use archived product photos with simulated prices, sizes
          and stock. They are not live retailer offers. Seller listings use
          supplied details. All purchases are mock orders: no payment or
          delivery.
        </p>
      </div>
      <Button variant="outline" onClick={onSell}>
        <Plus size={16} />
        Sell on Flairify
      </Button>
      <div className="inventory-filters">
        <label className="field">
          <span>
            <Search size={15} /> Search inventory
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleCount(24);
            }}
            placeholder="A shirt, a jacket, a fresh possibility…"
          />
        </label>
        <label className="field">
          Category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setVisibleCount(24);
            }}
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
        <label className="field">
          Department
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setVisibleCount(24);
            }}
          >
            <option value="">All departments</option>
            <option value="women">Women + unisex</option>
            <option value="men">Men + unisex</option>
            <option value="unisex">Unisex</option>
          </select>
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => {
              setAvailableOnly(e.target.checked);
              setVisibleCount(24);
            }}
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
      <p className="small-note" role="status">
        {products.length} pieces · Showing{" "}
        {Math.min(visibleCount, products.length)}
        {catalog.data &&
          ` of ${catalog.data.products.length} catalogue options`}
      </p>
      <div className="inventory-grid">
        {products.slice(0, visibleCount).map((p) => {
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
                  <span className="eyebrow">
                    {p.attributes.department
                      ? `${p.attributes.department} · `
                      : ""}
                    {p.category}
                  </span>
                  <strong>{money(p.price)}</strong>
                </div>
                <h3>{p.name}</h3>
                <p className="small-note">
                  {variants.length
                    ? `${p.sample ? "Sample sizes" : "Available sizes"}: ${[...new Set(variants.map((v) => v.size))].join(", ")}`
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
                <Button onClick={() => onBuy(p)} disabled={!variants.length}>
                  <ShoppingBag size={16} />
                  Mock buy
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !!generating || !variants.length || !p.try_on_supported
                  }
                  onClick={() => generate(p)}
                >
                  <WandSparkles size={16} />
                  {generating === p.id
                    ? "Starting preview…"
                    : p.try_on_supported
                      ? "Try this on"
                      : "Preview unavailable for this item"}
                </Button>
                {previewError?.id === p.id && (
                  <div className="notice">
                    <p className="error" role="alert">
                      {previewError.message}
                    </p>
                    {onSignIn ? (
                      <Button size="sm" onClick={onSignIn}>
                        Sign in for real previews
                      </Button>
                    ) : (
                      <div className="button-row">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={onReference}
                        >
                          Manage reference photos
                        </Button>
                        <Button size="sm" variant="outline" onClick={onSetup}>
                          Open Profile settings
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {visibleCount < products.length && (
        <div className="catalog-load-more">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((count) => count + 24)}
          >
            Show more clothes
          </Button>
          <p className="small-note">
            Search and filters include the entire catalogue.
          </p>
        </div>
      )}
      {!catalog.isLoading && !products.length && (
        <div className="empty-state">
          <h2>No pieces match yet.</h2>
          <p>Try another category or search term.</p>
        </div>
      )}
    </div>
  );
}
