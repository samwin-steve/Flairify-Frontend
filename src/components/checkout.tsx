"use client";
import { Skeleton } from "./ui/loading";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, PackageCheck } from "lucide-react";
import { api, post } from "@/lib/api";
import { checkoutDefault } from "@/lib/checkout-defaults";
import { money } from "@/lib/utils";
import type {
  Product,
  Profile,
  Shop,
  MockOrder,
  OrderQuote,
  OrderSelection,
} from "@/lib/types";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
import { Media } from "./media";

export function Checkout({
  products,
  outfitId,
  previewJobId,
  onClose,
  onPlaced,
}: {
  products: Product[];
  outfitId?: string;
  previewJobId?: string;
  onClose: () => void;
  onPlaced: (order: MockOrder) => void;
}) {
  const qc = useQueryClient();
  const [choices, setChoices] = useState<Record<string, OrderSelection>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const catalog = useQuery({
    queryKey: ["checkout-catalog", products.map((p) => p.id).join(",")],
    queryFn: () => api<{ products: Product[] }>("/catalog?ids=" + encodeURIComponent(products.map((p) => p.id).join(","))),
    staleTime: 0,
  });
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<Profile>("/profile"),
  });
  const stores = useQuery({
    queryKey: ["stores"],
    queryFn: () => api<{ stores: Shop[] }>("/stores"),
  });
  const current = useMemo(
    () =>
      products
        .filter((p) => !removed.includes(p.id))
        .map((p) => catalog.data?.products.find((v) => v.id === p.id))
        .filter((p): p is Product => !!p),
    [products, catalog.data, removed],
  );
  const items = useMemo(
    () =>
      current.map((p) => {
        if (choices[p.id]) return choices[p.id];
        const previous = products.find((v) => v.id === p.id)?.availability;
        return checkoutDefault(p, profile.data, previous);
      }),
    [current, choices, products, profile.data],
  );
  const missing = products.some(
    (p) =>
      !removed.includes(p.id) &&
      catalog.data &&
      !catalog.data.products.some((v) => v.id === p.id),
  );
  const valid =
    !missing &&
    !profile.isLoading &&
    items.length > 0 &&
    items.every((i) => i.variant_id && i.store_id);
  const body = {
    items,
    source: previewJobId ? "fitting_room" : outfitId ? "stylist" : "inventory",
    outfit_id: outfitId || null,
    preview_job_id: previewJobId || null,
  };
  const quote = useQuery({
    queryKey: ["order-quote", items, outfitId, previewJobId],
    queryFn: () => post<OrderQuote>("/orders/quote", body),
    enabled: valid,
    retry: false,
    staleTime: 0,
  });
  function change(id: string, value: OrderSelection) {
    setChoices((old) => ({ ...old, [id]: value }));
    setAcknowledged(false);
    setError("");
    setRequestKey(crypto.randomUUID());
  }
  async function place() {
    if (!quote.data || !acknowledged || busy || quote.isFetching) return;
    setBusy(true);
    setError("");
    try {
      const order = await post<MockOrder>("/orders", {
        ...body,
        request_key: requestKey,
        expected_total: quote.data.total,
        acknowledge_mock: true,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["orders"] }),
        qc.invalidateQueries({ queryKey: ["seller-orders"] }),
      ]);
      onPlaced(order);
    } catch (e) {
      setError((e as Error).message);
      setAcknowledged(false);
      await quote.refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title="Your checkout"
      description="Confirm your sizes, colours and store before placing your order."
      wide
    >
      {(outfitId || previewJobId) && (
        <p className="small-note">
          Only new pieces from this look are included. Clothes you already own
          stay in your wardrobe.
        </p>
      )}
      {catalog.isLoading && <Skeleton label="Checking inventory" />}
      {catalog.error && (
        <p role="alert" className="error">
          {catalog.error.message}
        </p>
      )}
      {missing && (
        <p role="alert" className="error">
          A piece is no longer listed. Close checkout and choose another from
          Inventory.
        </p>
      )}
      <div className="checkout-items">
        {current.map((p, index) => {
          const selection = items[index];
          const variant = p.variants.find((v) => v.id === selection.variant_id);
          const stock = variant?.stock.find(
            (s) => s.store_id === selection.store_id,
          );
          return (
            <section className="checkout-item" key={p.id}>
              <Media src={p.image} alt={p.name} catalog />
              <div className="checkout-item-fields">
                <div className="section-line">
                  <h3>{p.name}</h3>
                  <strong>{money(p.price)}</strong>
                </div>
                <div className="form-grid">
                  <label className="field">
                    Size and colour
                    <select
                      aria-label={`Size for ${p.name}`}
                      value={selection.variant_id}
                      disabled={busy}
                      onChange={(e) => {
                        const v = p.variants.find(
                          (v) => v.id === e.target.value,
                        )!;
                        change(p.id, {
                          ...selection,
                          variant_id: v.id,
                          store_id:
                            v.stock.find((s) => s.quantity > 0)?.store_id || "",
                          quantity: 1,
                        });
                      }}
                    >
                      {!variant && <option value="">Unavailable</option>}
                      {p.variants
                        .filter((v) => v.stock.some((s) => s.quantity > 0))
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.size} · {v.colour}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    Store
                    <select
                      aria-label={`Store for ${p.name}`}
                      value={selection.store_id}
                      disabled={busy}
                      onChange={(e) =>
                        change(p.id, {
                          ...selection,
                          store_id: e.target.value,
                          quantity: 1,
                        })
                      }
                    >
                      {variant?.stock
                        .filter((s) => s.quantity > 0)
                        .map((s) => (
                          <option key={s.store_id} value={s.store_id}>
                            {stores.data?.stores.find(
                              (v) => v.id === s.store_id,
                            )?.name || s.store_id}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    Quantity
                    <select
                      aria-label={`Quantity for ${p.name}`}
                      value={selection.quantity}
                      disabled={busy}
                      onChange={(e) =>
                        change(p.id, {
                          ...selection,
                          quantity: Number(e.target.value),
                        })
                      }
                    >
                      {Array.from(
                        { length: Math.min(stock?.quantity || 1, 10) },
                        (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
                {current.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setRemoved([...removed, p.id]);
                      setAcknowledged(false);
                      setRequestKey(crypto.randomUUID());
                    }}
                  >
                    Remove from this order
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {quote.error && (
        <p className="error" role="alert">
          {quote.error.message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="checkout-total">
        <span>Order total</span>
        <strong>
          {quote.isFetching
            ? "Checking…"
            : valid && quote.data
              ? money(quote.data.total)
              : "—"}
        </strong>
      </div>
      <label className="check-line">
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={busy}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        I confirm the items, sizes and quantities.
      </label>
      <div className="button-row">
        <Button
          onClick={place}
          disabled={
            busy ||
            !valid ||
            !quote.data ||
            !!quote.error ||
            quote.isFetching ||
            !acknowledged
          }
        >
          <PackageCheck size={17} />
          {busy ? "Saving your order…" : "Buy"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Keep browsing
        </Button>
      </div>
    </Modal>
  );
}

export function OrderList({
  orders,
  seller = false,
}: {
  orders: MockOrder[];
  seller?: boolean;
}) {
  return (
    <div className="order-list">
      {orders.map((order) => (
        <article className="white-panel order-card" key={order.id}>
          <div className="section-line">
            <div>
              <span className="pill">Order placed</span>
              <h3>{order.id}</h3>
              <p className="small-note">
                {new Date(order.created_at).toLocaleString()} ·{" "}
                {order.source === "fitting_room"
                  ? "From the Fitting Room"
                  : order.source === "stylist"
                    ? "From the stylist"
                    : "From Inventory"}
              </p>
            </div>
            <strong>{money(order.total)}</strong>
          </div>
          {order.items.map((line) => (
            <div
              className="order-line"
              key={`${line.product_id}-${line.variant_id}-${line.store_id}`}
            >
              <Media src={line.image} alt={line.name} catalog />
              <div>
                <strong>{line.name}</strong>
                <p className="small-note">
                  {line.size} · {line.colour} · Qty {line.quantity}
                  <br />
                  {line.store_name}
                </p>
              </div>
              <span>{money(line.line_total)}</span>
            </div>
          ))}
          {seller && <p className="fine-print">Your listed items only.</p>}
        </article>
      ))}
    </div>
  );
}

export function Orders({ onShop }: { onShop: () => void }) {
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<{ orders: MockOrder[] }>("/orders"),
  });
  return (
    <main className="page-content">
      <h1>My orders</h1>
      {orders.isLoading && <Skeleton label="Loading orders" cards={3} />}
      {orders.error && (
        <p className="error" role="alert">
          {orders.error.message}
        </p>
      )}
      {!orders.isLoading && !orders.error && !orders.data?.orders.length && (
        <div className="empty-state">
          <ShoppingBag size={32} />
          <h2>No orders yet</h2>
          <Button onClick={onShop}>Explore inventory</Button>
        </div>
      )}
      <OrderList orders={orders.data?.orders || []} />
    </main>
  );
}
