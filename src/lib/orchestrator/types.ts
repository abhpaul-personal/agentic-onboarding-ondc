import type { MappingProposal } from "@/lib/schemas/field-mapping";
import type { Route } from "@/lib/routing";

/** Every source format the orchestrator accepts (extraction's own type covers only the unstructured two). */
export const SOURCE_FORMATS = ["csv", "excel", "whatsapp_text", "price_list_photo"] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

export interface GateRecord {
  gate: "G0" | "G1" | "G2" | "FQ" | "G3" | "G4";
  outcome: string;
  at: string;
}

/** A column mapping proposal plus the reviewer's resolution, tracked through G2 and the fallback queue. */
export interface MappingDecisionRecord extends MappingProposal {
  route: Route;
  final: string | null;
  edited: boolean;
  resolved: boolean;
}

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  brand?: string;
  category?: string;
  categoryConfidence?: number;
  gtin?: string;
  netQty?: string;
  price?: number;
  mrp?: number;
  stock?: number;
  vegNonVeg?: "veg" | "non_veg";
  packedMonth?: string; // month_year_of_manufacture_packing_import
  // Set explicitly when the source maps a column to these targets, or
  // when the seller enters them at G3 from the pack label. Pre-filled
  // from the seller profile (FR-15) only for a loose item with no brand;
  // a branded item with no explicit packer column is never defaulted to
  // the seller and is flagged for G3 instead (PRD G3, "Branded items
  // packed by someone else").
  manufacturerOrPackerName?: string;
  manufacturerOrPackerAddress?: string;
  fssaiLicenceNo?: string;
  // Fashion variants
  parentItemId?: string;
  colour?: string;
  size?: string;
  material?: string;
  gender?: string;
  // Provenance (extraction sources only)
  extractionConfidence?: number;
  sourceExcerpt?: string;
}

export const VALIDATION_ISSUE_SEVERITIES = ["queue", "g3"] as const;
export type ValidationIssueSeverity = (typeof VALIDATION_ISSUE_SEVERITIES)[number];

export interface ValidationIssue {
  itemId: string;
  type: "duplicate" | "gtin" | "mrp" | "claim" | "fssai" | "packer_missing" | "mrp_missing" | "mfg_missing";
  severity: ValidationIssueSeverity;
  message: string;
}
