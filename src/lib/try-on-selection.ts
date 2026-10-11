import type { Product, WardrobeItem } from "./types";

export interface PreviewSelection {
  kind: "product" | "wardrobe";
  id: string;
  variant_id?: string;
}
export interface PreviewPiece extends PreviewSelection {
  name: string;
  category: string;
  available: boolean;
}
const slots = new Set([
  "top",
  "bottom",
  "dress",
  "jacket",
  "shoes",
  "bag",
  "accessory",
]);
export const pieceKey = (p: PreviewSelection) => `${p.kind}:${p.id}`;
export function conflicts(a: string, b: string) {
  return (
    a === b ||
    (a === "dress" && ["top", "bottom"].includes(b)) ||
    (b === "dress" && ["top", "bottom"].includes(a))
  );
}
export function togglePiece(selected: PreviewPiece[], piece: PreviewPiece) {
  if (selected.some((p) => pieceKey(p) === pieceKey(piece)))
    return {
      selected: selected.filter((p) => pieceKey(p) !== pieceKey(piece)),
      removed: [],
    };
  if (!piece.available) return { selected, removed: [] };
  return {
    selected: [
      ...selected.filter((p) => !conflicts(p.category, piece.category)),
      piece,
    ],
    removed: selected.filter((p) => conflicts(p.category, piece.category)),
  };
}
export function productPiece(p: Product): PreviewPiece {
  const variant = p.availability?.variant_id
    ? p.variants.find((v) => v.id === p.availability!.variant_id)
    : p.variants.find((v) => v.stock.some((s) => s.quantity > 0));
  return {
    kind: "product",
    id: p.id,
    name: p.name,
    category: p.category,
    variant_id: variant?.id,
    available:
      slots.has(p.category) &&
      p.active !== false &&
      p.try_on_supported !== false &&
      (p.image.startsWith("media:") || /\.jpe?g$/i.test(p.image)) &&
      !!variant?.stock.some((s) => s.quantity > 0),
  };
}
export function wardrobePiece(w: WardrobeItem): PreviewPiece {
  return {
    kind: "wardrobe",
    id: w.id,
    name: w.name,
    category: w.category,
    available:
      w.confirmed &&
      slots.has(w.category) &&
      (w.image.startsWith("media:") || w.sample),
  };
}
export function selections(pieces: PreviewPiece[]): PreviewSelection[] {
  return pieces.map(({ kind, id, variant_id }) => ({
    kind,
    id,
    ...(variant_id ? { variant_id } : {}),
  }));
}
