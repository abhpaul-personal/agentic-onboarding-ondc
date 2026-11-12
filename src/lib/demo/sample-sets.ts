import type { SellerCategory } from "@/lib/schemas/seller-profile";
import type { SourceFormat } from "@/lib/orchestrator/types";

export type SampleSetId = "A" | "B" | "C" | "D" | "E" | "F" | "G";

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
  },
];

export function getSampleSet(id: string): SampleSetMeta | undefined {
  return SAMPLE_SETS.find((s) => s.id === id);
}
