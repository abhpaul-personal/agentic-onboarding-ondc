import { findDuplicateSkus } from "@/lib/checks/duplicates";
import { gtinCheckDigitValid } from "@/lib/checks/gtin";
import { mrpAtOrAboveSellingPrice } from "@/lib/checks/mrp";
import { findUnsupportedClaim } from "@/lib/checks/claims";
import { NET_QUANTITY_CANONICAL_PATTERN } from "@/lib/parse/net-quantity";
import { PACKED_MONTH_CANONICAL_PATTERN } from "@/lib/parse/packed-month";
import type { SellerProfile } from "@/lib/schemas/seller-profile";
import type { CatalogItem, ValidationIssue } from "./types";

/**
 * An item is self-packed when it carries no brand, or a brand the seller
 * named as their own at intake (own_brands, case-insensitive, trimmed).
 * Anything else is someone else's brand (PRD G3, "Branded items packed
 * by someone else").
 */
export function isSelfPacked(item: CatalogItem, seller: SellerProfile): boolean {
  if (!item.brand) return true;
  const normalized = item.brand.trim().toLowerCase();
  return seller.own_brands.some((brand) => brand.trim().toLowerCase() === normalized);
}

/**
 * FR-15: pre-fills statutory fields from the approved seller profile —
 * but only for a self-packed item. A third-party-branded item is never
 * defaulted to the seller, even when the source gave no explicit packer
 * column: PRD G3, "...the packer and FSSAI licence are the brand owner's,
 * not yours. Copy them from the pack label." Left unset here, it is
 * caught by validateItems' packer_missing/fssai checks and the seller
 * fills it in at G3 (see enterPackerDetailsAtG3/enterPackerDetailsForBrandAtG3
 * in catalog-run.ts). An explicit source-mapped value
 * (manufacturer_or_packer_name or brand_owner_FSSAI_license_no) always
 * wins either way.
 */
export function preFillFromSellerProfile(item: CatalogItem, seller: SellerProfile): CatalogItem {
  if (!isSelfPacked(item, seller)) {
    return item;
  }
  return {
    ...item,
    manufacturerOrPackerName: item.manufacturerOrPackerName ?? seller.business_name,
    manufacturerOrPackerAddress: item.manufacturerOrPackerAddress ?? seller.packer_address,
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
    if (
      grocery &&
      !isSelfPacked(item, seller) &&
      (!item.manufacturerOrPackerName || !item.manufacturerOrPackerAddress)
    ) {
      issues.push({
        itemId: item.id,
        type: "packer_missing",
        severity: "g3",
        message: `No packer name or address for "${item.brand}"-branded item; seller must enter them from the pack label`,
      });
    }
    // A rule couldn't normalise the value (build-items.ts keeps the raw
    // string rather than blanking it): route it to the fallback queue
    // rather than silently publishing an unparsed quantity or date.
    if (item.netQty && !NET_QUANTITY_CANONICAL_PATTERN.test(item.netQty)) {
      issues.push({
        itemId: item.id,
        type: "net_qty_unparsed",
        severity: "queue",
        message: `Net quantity "${item.netQty}" could not be parsed into a standard unit`,
      });
    }
    if (grocery && item.packedMonth && !PACKED_MONTH_CANONICAL_PATTERN.test(item.packedMonth)) {
      issues.push({
        itemId: item.id,
        type: "mfg_date_unparsed",
        severity: "queue",
        message: `Packing date "${item.packedMonth}" could not be parsed into a month and year`,
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
