import type { Product, Profile, OrderSelection } from "./types";

export function checkoutDefault(
  product: Product,
  profile: Profile | undefined,
  previous?: Product["availability"],
): OrderSelection {
  const size =
    product.category === "shoes"
      ? profile?.shoe_size
      : ["bag", "accessory"].includes(product.category)
        ? "One size"
        : profile?.clothing_size;
  const variant =
    product.variants.find(
      (v) =>
        v.id === previous?.variant_id && v.stock.some((s) => s.quantity > 0),
    ) ||
    product.variants.find(
      (v) => (!size || v.size === size) && v.stock.some((s) => s.quantity > 0),
    );
  const preferred = previous?.store_id || profile?.preferred_store_id;
  const stock =
    variant?.stock.find((s) => s.store_id === preferred && s.quantity > 0) ||
    variant?.stock.find((s) => s.quantity > 0);
  return {
    product_id: product.id,
    variant_id: variant?.id || "",
    store_id: stock?.store_id || "",
    quantity: 1,
  };
}
