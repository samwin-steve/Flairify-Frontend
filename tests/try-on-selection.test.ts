import { describe, expect, it } from "vitest";
import {
  togglePiece,
  selections,
  productPiece,
  type PreviewPiece,
} from "../src/lib/try-on-selection";
import type { Product } from "../src/lib/types";
const piece = (
  id: string,
  category: string,
  kind: "product" | "wardrobe" = "product",
): PreviewPiece => ({ id, category, kind, name: id, available: true });
describe("preview selections", () => {
  it("starts empty, toggles off and submits only validated request fields", () => {
    const shirt = piece("shirt", "top");
    expect(selections([])).toEqual([]);
    const next = togglePiece([], shirt);
    expect(selections(next.selected)).toEqual([
      { kind: "product", id: "shirt" },
    ]);
    expect(togglePiece(next.selected, shirt).selected).toEqual([]);
    expect(togglePiece([], { ...shirt, available: false }).selected).toEqual(
      [],
    );
  });
  it.each(["bottom", "shoes", "top", "jacket", "bag", "accessory"])(
    "keeps the newest %s across owned and new pieces",
    (slot) => {
      const old = piece("old", slot, "wardrobe"),
        next = piece("new", slot);
      const result = togglePiece([old], next);
      expect(result.selected).toEqual([next]);
      expect(result.removed).toEqual([old]);
    },
  );
  it("resolves dresses and separates while allowing a jacket and one pair of shoes", () => {
    const top = piece("top", "top"),
      bottom = piece("bottom", "bottom"),
      dress = piece("dress", "dress");
    const jacket = piece("jacket", "jacket"),
      shoes = piece("shoes", "shoes");
    expect(togglePiece([top, bottom, jacket, shoes], dress).selected).toEqual([
      jacket,
      shoes,
      dress,
    ]);
    const next = togglePiece([dress, jacket, shoes], bottom);
    expect(next.selected).toEqual([jacket, shoes, bottom]);
    expect(togglePiece(next.selected, top).selected).toEqual([
      jacket,
      shoes,
      bottom,
      top,
    ]);
  });
  it("does not switch a recommended size silently when that variant sells out", () => {
    const p = {
      id: "x",
      name: "Top",
      category: "top",
      image: "media:photo",
      availability: { variant_id: "M" },
      variants: [
        { id: "M", stock: [{ quantity: 0 }] },
        { id: "L", stock: [{ quantity: 2 }] },
      ],
    } as Product;
    expect(productPiece(p).available).toBe(false);
    expect(productPiece({ ...p, availability: undefined }).variant_id).toBe(
      "L",
    );
  });
});
