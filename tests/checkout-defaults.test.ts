import { describe, it, expect } from "vitest";
import { checkoutDefault } from "../src/lib/checkout-defaults";
import type { Product, Profile } from "../src/lib/types";
const product = {
  id: "shirt",
  category: "top",
  variants: [
    {
      id: "s",
      size: "S",
      colour: "white",
      stock: [{ store_id: "a", quantity: 10 }],
    },
    {
      id: "m",
      size: "M",
      colour: "white",
      stock: [
        { store_id: "a", quantity: 3 },
        { store_id: "b", quantity: 4 },
      ],
    },
  ],
} as Product;
const profile = {
  clothing_size: "M",
  shoe_size: "39",
  preferred_store_id: "b",
} as Profile;
describe("checkout uses saved preferences", () => {
  it("defaults to saved size and store, not the first variant", () => {
    expect(checkoutDefault(product, profile)).toEqual({
      product_id: "shirt",
      variant_id: "m",
      store_id: "b",
      quantity: 1,
    });
  });
  it("requires selection if the saved size is unavailable", () => {
    expect(
      checkoutDefault(product, { ...profile, clothing_size: "XL" }).variant_id,
    ).toBe("");
  });
  it("uses shoe size for shoes", () => {
    const shoe = {
      ...product,
      category: "shoes",
      variants: [{ ...product.variants[0], id: "39", size: "39" }],
    };
    expect(checkoutDefault(shoe, profile).variant_id).toBe("39");
  });
  it("keeps an explicitly selected recommendation variant for confirmation", () => {
    expect(
      checkoutDefault(product, profile, {
        variant_id: "s",
        store_id: "a",
        size: "S",
        quantity: 10,
      }).variant_id,
    ).toBe("s");
  });
});
