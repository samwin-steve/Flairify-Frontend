export interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  colour: string;
  pattern: string;
  details: string;
  brand: string | null;
  material: string | null;
  size: string | null;
  image: string;
  generated_image?: string | null;
  generated_image_model?: string | null;
  generated_image_version?: string | null;
  shop_image_job_id?: string | null;
  shop_image_status?: string | null;
  shop_image_error?: string | null;
  source_photo_id: string | null;
  box: Box | null;
  uncertainty: string[];
  confirmed: boolean;
  sample: boolean;
  evidence: string;
  created_at: string;
}
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Shop {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  sample: boolean;
  distance_km?: number;
  distance_label?: string;
}
export interface Stock {
  store_id: string;
  quantity: number;
  aisle?: string;
  rack?: string;
}
export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  image: string;
  variants: { id: string; size: string; colour: string; stock: Stock[] }[];
  attributes: Record<string, string>;
  ai_attributes: Record<string, string>;
  delivery: string[];
  sample: boolean;
  indexed: boolean;
  updated_at: string;
  content_hash: string;
  product_url?: string;
  try_on_supported?: boolean;
  active?: boolean;
  seller_id?: string;
  availability?: Stock & { size: string; variant_id: string };
  store?: Shop;
}
export interface Assessment {
  id: string;
  score: number;
  source: string;
  reason: string;
  version: string;
}
export interface Outfit {
  graph_evidence?: {
    status: string;
    source?: string;
    counts: Record<string, number>;
  };
  id: string;
  title: string;
  occasion: string;
  owned: WardrobeItem[];
  products: Product[];
  total: number;
  explanation: string;
  complete: boolean;
  sample: boolean;
  assessment: Assessment;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  outfits: Outfit[];
  created_at: string;
}
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updated_at: string;
}
export interface Job {
  id: string;
  kind: string;
  status: string;
  stage: string;
  attempts: number;
  error: string | null;
  result: {
    media_id?: string;
    label?: string;
    accepted?: boolean;
    item_ids?: string[];
    review_required?: boolean;
    reference_media_id?: string;
    product_id?: string;
    product_name?: string;
    product_image?: string;
    provider?: string;
    sample_product?: boolean;
    keep_background?: boolean;
    pieces?: {
      kind: "product" | "wardrobe";
      id: string;
      name: string;
      category: string;
      image: string;
      sample: boolean;
    }[];
    selection_adjustments?: string[];
  } | null;
  created_at: string;
  updated_at: string;
}
export interface Profile {
  department?: "all" | "women" | "men" | "unisex";
  preferred_store_id?: string | null;
  include_wardrobe?: boolean;
  name: string;
  styles: string[];
  colours: string[];
  clothing_size: string;
  shoe_size: string;
  fit: string;
  budget: number;
  consent: { remember_preferences: boolean; ai_photo_processing: boolean };
  onboarding_complete: boolean;
  keep_background?: boolean;
  admin?: boolean;
  seller?: boolean;
  demo?: boolean;
}
export interface Photo {
  id: string;
  media_id: string;
  source: string;
  person_box: Box;
  group_photo: boolean;
}
export interface Reference {
  id: string;
  kind: string;
  media_id: string;
  source_photo_id?: string;
}
export interface Config {
  mode: string;
  analysis: string;
  chat: string;
  try_on: boolean;
  video: boolean;
  photos_client_id: string;
  demo_admin: boolean;
  sample_try_on?: boolean;
  avatar: { asset: string; status: string; personalized: boolean };
}
export interface Duplicate {
  id: string;
  item_ids: string[];
  reason: string;
  status: string;
}

export interface OrderSelection {
  product_id: string;
  variant_id: string;
  store_id: string;
  quantity: number;
}
export interface OrderLine extends OrderSelection {
  sku: string;
  name: string;
  image: string;
  size: string;
  colour: string;
  store_name: string;
  unit_price: number;
  line_total: number;
  sample: boolean;
}
export interface OrderQuote {
  items: OrderLine[];
  total: number;
  currency: string;
  mock: true;
  payment_status: string;
  fulfillment_status: string;
  notice: string;
}
export interface MockOrder extends OrderQuote {
  id: string;
  status: string;
  created_at: string;
  source: "inventory" | "stylist" | "fitting_room";
}
