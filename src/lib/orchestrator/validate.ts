import { findDuplicateSkus } from "@/lib/checks/duplicates";
import { gtinCheckDigitValid } from "@/lib/checks/gtin";
import { mrpAtOrAboveSellingPrice } from "@/lib/checks/mrp";
import { findUnsupportedClaim } from "@/lib/checks/claims";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
import type { CatalogItem, ValidationIssue } from "./types";

/**
 * FR-15: pre-fills statutory fields from the approved seller profile,
 * unless the source already supplied its own value (a column mapped to
 * manufacturer_or_packer_name or brand_owner_FSSAI_license_no) — PRD G3:
 * "one profile can cover products with different packers or licences."
 * Never inferred from the item's brand name: a differently-branded item
 * can still be packed by the seller themselves (set B's "Annakosh").
 */
export function preFillFromSellerProfile(item: CatalogItem, seller: SellerProfile): CatalogItem {
  return {
    ...item,
    manufacturerOrPackerName: item.manufacturerOrPackerName ?? seller.business_name,
    fssaiLicenceNo: item.fssaiLicenceNo ?? (seller.fssai || undefined),
  };
}

/** FR-14: deterministic checks, run as real code, not the model. */
export function validateItems(
  items: readonly CatalogItem[],
  seller: SellerProfile,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const duplicateIds = new Set(findDuplicateSkus(items.map((i) => i.id)));
  const grocery = seller.category === "Grocery";

  for (const item of items) {
    if (duplicateIds.has(item.id)) {
      issues.push({ itemId: item.id, type: "duplicate", severity: "queue", message: `Duplicate SKU ${item.id}` });
    }
    if (item.gtin && !gtinCheckDigitValid(item.gtin)) {
      issues.push({ itemId: item.id, type: "gtin", severity: "queue", message: `GTIN ${item.gtin} fails the check digit` });
    }
    if (item.mrp != null && item.price != null && !mrpAtOrAboveSellingPrice(item.mrp, item.price)) {
      issues.push({
        itemId: item.id,
        type: "mrp",
        severity: "g3",
        message: `Selling price ${item.price} is above MRP ${item.mrp}`,
      });
    }
    if (item.description) {
      const claim = findUnsupportedClaim(item.description);
      if (claim) {
        issues.push({
          itemId: item.id,
          type: "claim",
          severity: "queue",
          message: `Description implies "${claim}" with no certification field behind it`,
        });
      }
    }
    if (grocery && !item.fssaiLicenceNo) {
      issues.push({
        itemId: item.id,
        type: "fssai",
        severity: "g3",
        message: "No FSSAI licence for third-party packed item",
      });
    }
  }

  const missingMrp = items.filter((i) => i.mrp == null);
  if (missingMrp.length) {
    issues.push({
      itemId: "*",
      type: "mrp_missing",
      severity: "g3",
      message: `MRP missing on ${missingMrp.length} items`,
    });
  }
  if (grocery) {
    const missingMfg = items.filter((i) => !i.packedMonth);
    if (missingMfg.length) {
      issues.push({
        itemId: "*",
        type: "mfg_missing",
        severity: "g3",
        message: `Month and year of packing missing on ${missingMfg.length} items`,
      });
    }
  }

  return issues;
}
