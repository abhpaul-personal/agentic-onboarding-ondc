import type { SellerCategory } from "@/lib/schemas/seller-profile";
import type { SourceFormat } from "@/lib/orchestrator/types";

export type SampleSetId = "A" | "B" | "C" | "D" | "E" | "F" | "G";

// Sets B and F's golden catalogs happen to span the same 13 Grocery
// sub-categories; kept as one constant rather than repeated verbatim.
const GROCERY_CATEGORY_IDS = [
  "Atta, Flours and Sooji",
  "Beverages",
  "Cereals and Breakfast",
  "Chocolates and Biscuits",
  "Cooking and Baking Needs",
  "Dals and Pulses",
  "Dry Fruits, Nuts and Seeds",
  "Masala and Seasoning",
  "Oil and Ghee",
  "Pasta, Soup and Noodles",
  "Rice and Rice Products",
  "Sauces, Spreads and Dips",
  "Snacks and Namkeen",
] as const;

export interface SampleSetMeta {
  id: SampleSetId;
  title: string;
  where: string;
  format: string;
  size: string;
  tests: string;
  category: SellerCategory | null; // null for G (bulk sellers, no single catalog category)
  sourceFormat: SourceFormat | null; // null for G
  bulk: boolean;
  /**
   * The ONDC category IDs the category agent may classify this seller's
   * items into — this set's own distinct category_id values from its
   * golden catalog (data/sets/*\/ground_truth/golden_catalog.json), not a
   * client's product data. null for G (no catalog). The single source of
   * truth for both the live demo (catalogRunCategory) and agents:warm:
   * they must agree, or the category step's cache key never matches
   * between what a visitor's click produces and what was warmed.
   */
  allowedCategoryIds: readonly string[] | null;
}

export const SAMPLE_SETS: readonly SampleSetMeta[] = [
  {
    id: "A",
    title: "Tilwari Masala Ghar",
    where: "Spice and pickle maker, Nashik",
    format: "Clean CSV",
    size: "40 items",
    tests: "Baseline mapping on tidy data",
    category: "Grocery",
    sourceFormat: "csv",
    bulk: false,
    allowedCategoryIds: ["Masala and Seasoning", "Sauces, Spreads and Dips"],
  },
  {
    id: "B",
    title: "Rambhau Kirana Stores",
    where: "Kirana store, Pune",
    format: "Messy Excel (Hinglish headers, units inside text)",
    size: "60 items",
    tests: "Header synonyms, unit and price normalisation",
    category: "Grocery",
    sourceFormat: "csv",
    bulk: false,
    allowedCategoryIds: GROCERY_CATEGORY_IDS,
  },
  {
    id: "C",
    title: "Neelkurinji Threads",
    where: "Handloom boutique, Kochi",
    format: "Shopify-style export",
    size: "30 products, 84 variants",
    tests: "Variant handling, size and colour",
    category: "Fashion",
    sourceFormat: "csv",
    bulk: false,
    allowedCategoryIds: ["Dupattas", "Kurtas and Kurta Sets", "Sarees", "Tops"],
  },
  {
    id: "D",
    title: "Butterleaf Home Bakery",
    where: "Home bakery, Indore",
    format: "WhatsApp-style text",
    size: "25 items",
    tests: "Free-text extraction, G1 confirmation",
    category: "Grocery",
    sourceFormat: "whatsapp_text",
    bulk: false,
    allowedCategoryIds: ["Bakery, Cakes and Dairy", "Chocolates and Biscuits"],
  },
  {
    id: "E",
    title: "Kanakchampa Sweets",
    where: "Sweet shop, Kolkata",
    format: "Photo of a handwritten price list",
    size: "20 items",
    tests: "Multimodal extraction, G1 confirmation",
    category: "Grocery",
    sourceFormat: "price_list_photo",
    bulk: false,
    allowedCategoryIds: ["Bakery, Cakes and Dairy", "Indian Sweets"],
  },
  {
    id: "F",
    title: "Trapline Traders",
    where: "Test seller, Nagpur",
    format: "CSV with planted errors",
    size: "30 rows",
    tests: "Validation recall, no-invention guardrail",
    category: "Grocery",
    sourceFormat: "csv",
    bulk: false,
    allowedCategoryIds: GROCERY_CATEGORY_IDS,
  },
  {
    id: "G",
    title: "Sakhi Annapurna cooperative",
    where: "Women-led food cooperative, Satara",
    format: "Bulk seller CSV",
    size: "12 sellers",
    tests: "Bulk Stage 1 and G0",
    category: null,
    sourceFormat: null,
    bulk: true,
    allowedCategoryIds: null,
  },
];

export function getSampleSet(id: string): SampleSetMeta | undefined {
  return SAMPLE_SETS.find((s) => s.id === id);
}
