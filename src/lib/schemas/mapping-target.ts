import { z } from "zod";

/**
 * The local target schema smart mapping maps seller columns onto. Pulled
 * from the case-study demo and cross-checked against the eval kit's golden
 * catalogs (data/sets/*\/ground_truth/golden_catalog.json) and field
 * mappings. Dot-separated keys address nested paths in the ONDC item shape
 * (see ondc-item.ts); "IGNORE" means the column maps to nothing.
 */
export const RISK_CLASSES = ["low", "medium", "high"] as const;
export const riskClassSchema = z.enum(RISK_CLASSES);
export type RiskClass = (typeof RISK_CLASSES)[number];

export const MAPPING_TARGETS = {
  "id": { label: "Item ID (SKU)", risk: "low" },
  "descriptor.name": { label: "Item name", risk: "low" },
  "descriptor.short_desc": { label: "Short description", risk: "low" },
  "descriptor.code": { label: "GTIN", risk: "medium" },
  "descriptor.images": { label: "Image URL", risk: "medium" },
  "brand": { label: "Brand", risk: "low" },
  "category_id": { label: "ONDC category", risk: "medium" },
  "price.value": { label: "Selling price (INR)", risk: "high" },
  "price.maximum_value": { label: "MRP (INR)", risk: "high" },
  "net_quantity": { label: "Net quantity", risk: "high" },
  "quantity.available.count": { label: "Stock count", risk: "low" },
  "veg_non_veg": { label: "Veg or non-veg mark", risk: "high" },
  "month_year_of_manufacture_packing_import": {
    label: "Month and year of packing",
    risk: "high",
  },
  "brand_owner_FSSAI_license_no": { label: "FSSAI licence", risk: "high" },
  "manufacturer_or_packer_name": {
    label: "Manufacturer or packer",
    risk: "high",
  },
  "colour": { label: "Colour", risk: "low" },
  "size": { label: "Size", risk: "medium" },
  "material": { label: "Material", risk: "low" },
  "gender": { label: "Gender", risk: "low" },
  "parent_item_id": { label: "Variant group", risk: "medium" },
  "shelf_life": { label: "Shelf life", risk: "low" },
  "@ondc/org/time_to_ship": { label: "Time to ship", risk: "medium" },
  "IGNORE": { label: "Not mapped (ignore)", risk: "low" },
} as const satisfies Record<string, { label: string; risk: RiskClass }>;

export type MappingTargetKey = keyof typeof MAPPING_TARGETS;

export const mappingTargetKeySchema = z.enum(
  Object.keys(MAPPING_TARGETS) as [MappingTargetKey, ...MappingTargetKey[]],
);

export function targetLabel(key: string | null): string {
  if (key == null) return "No match";
  return key in MAPPING_TARGETS
    ? MAPPING_TARGETS[key as MappingTargetKey].label
    : key;
}

export function targetRisk(key: string | null): RiskClass {
  if (key == null) return "low";
  return key in MAPPING_TARGETS
    ? MAPPING_TARGETS[key as MappingTargetKey].risk
    : "low";
}

/** High-risk fields always go to a human at G2 and again at G3 (PRD routing table). */
export const HIGH_RISK_STATUTORY_KEYS = [
  "price.value",
  "price.maximum_value",
  "net_quantity",
  "veg_non_veg",
  "month_year_of_manufacture_packing_import",
  "brand_owner_FSSAI_license_no",
  "manufacturer_or_packer_name",
] as const satisfies readonly MappingTargetKey[];
