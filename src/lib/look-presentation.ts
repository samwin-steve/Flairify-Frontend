import type { Outfit, Product, WardrobeItem } from "./types";

function describe(piece: Product | WardrobeItem) {
  const category = piece.category;
  const name = piece.name.toLowerCase();
  const garment =
    (category === "jacket" && name.match(/blazer|overshirt|cardigan|coat/)) ||
    (category === "top" && name.match(/shirt|blouse|sweater|tee/)) ||
    (category === "bottom" && name.match(/jeans|trousers|skirt|shorts/)) ||
    (category === "shoes" && name.match(/sneakers|loafers|boots|sandals|heels|flats/));
  const label = garment ? garment[0] : category === "bottom" ? "bottoms" : category;
  const colour = "variants" in piece
    ? (piece.variants.find((v) => v.id === piece.availability?.variant_id) || piece.variants[0])?.colour
    : piece.colour;
  const pattern = "pattern" in piece ? piece.pattern : piece.attributes?.pattern;
  const detail = pattern && !/^(unknown|solid|plain|none)$/i.test(pattern)
    ? pattern
    : colour && !/^(unknown|none)$/i.test(colour) ? colour : "";
  return [detail, label].filter(Boolean).join(" ").toLowerCase();
}

export function lookPresentation(outfit: Outfit) {
  const pieces = [...outfit.owned, ...outfit.products];
  const base = pieces.find((p) => p.category === "dress") || pieces.find((p) => p.category === "top");
  const layer = pieces.find((p) => p.category === "jacket");
  const bottom = pieces.find((p) => p.category === "bottom");
  const shoes = pieces.find((p) => p.category === "shoes");
  const headlinePieces = [base, bottom, layer, shoes].filter((p) => p != null);
  const labels = (headlinePieces.length ? headlinePieces : pieces.slice(0, 3)).map(describe);
  const words = labels.length > 1
    ? labels.slice(0, -1).join(", ") + " & " + labels.at(-1)
    : labels[0] || outfit.title;
  const title = words.charAt(0).toUpperCase() + words.slice(1);
  const relaxedShoes = shoes && /sneaker|trainer/i.test(shoes.name);
  const styling = layer && base
    ? `Wear the layer open over the ${base.category === "dress" ? "dress" : "base"}${relaxedShoes ? ", with sneakers to keep it relaxed" : " to let both pieces show"}.`
    : base?.category === "dress"
      ? "Let the dress lead, keeping the finishing pieces simple."
      : base && bottom
        ? "Try a loose front tuck to bring the top and bottoms together."
        : "Keep the finishing touches simple so the selected pieces stand out.";
  return { title, styling };
}
