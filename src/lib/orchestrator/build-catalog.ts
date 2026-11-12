import type { SellerProfile } from "@/lib/schemas/seller-profile";
import type { OndcItem } from "@/lib/schemas/ondc-item";
import type { CatalogItem } from "./types";
import { isSelfPacked } from "./validate";

/**
 * Raised when a third-party-branded Grocery item reaches the builder
 * with no packer name, address or FSSAI licence. That can only mean G3
 * was skipped — signOffG3 (catalog-run.ts) should have blocked on its
 * packer_missing issue first. A self-packed item (no brand, or one of
 * the seller's own_brands) may legitimately fall back to the seller's
 * own details.
 */
export class MissingPackerDetailsError extends Error {
  constructor(itemId: string) {
    super(
      `Item ${itemId} carries a third-party brand but has no packer name, address or FSSAI licence. ` +
        `G3 must have been skipped for it.`,
    );
    this.name = "MissingPackerDetailsError";
  }
}

/**
 * 6. Catalog builder: turns a validated, signed-off item into the ONDC
 * item shape. A self-packed item falls back to the seller's own packer
 * details; a third-party-branded item never falls back — it must
 * already carry its own, entered by the seller at G3 from the pack
 * label.
 */
export function buildOndcItem(item: CatalogItem, seller: SellerProfile): OndcItem {
  const selfPacked = isSelfPacked(item, seller);
  if (
    !selfPacked &&
    seller.category === "Grocery" &&
    (!item.manufacturerOrPackerName || !item.manufacturerOrPackerAddress || !item.fssaiLicenceNo)
  ) {
    throw new MissingPackerDetailsError(item.id);
  }

  const manufacturerOrPackerName = selfPacked
    ? item.manufacturerOrPackerName ?? seller.business_name
    : item.manufacturerOrPackerName!;
  const manufacturerOrPackerAddress = selfPacked
    ? item.manufacturerOrPackerAddress ?? seller.packer_address
    : item.manufacturerOrPackerAddress!;

  const ondcItem: OndcItem = {
    id: item.id,
    descriptor: {
      name: item.name,
      code: item.gtin ? `1:${item.gtin}` : "",
      ...(item.description ? { short_desc: item.description } : {}),
    },
    category_id: item.category ?? "",
    price: {
      currency: "INR",
      value: (item.price ?? 0).toFixed(2),
      maximum_value: (item.mrp ?? item.price ?? 0).toFixed(2),
    },
    quantity: { available: { count: item.stock ?? 0 } },
    "@ondc/org/returnable": !seller.returns.toLowerCase().startsWith("not"),
    "@ondc/org/cancellable": true,
    "@ondc/org/time_to_ship": seller.time_to_ship,
    tags: [],
    ...(item.brand ? { brand: item.brand } : {}),
    ...(item.netQty ? { net_quantity: item.netQty } : {}),
    ...(item.parentItemId ? { parent_item_id: item.parentItemId } : {}),
    ...(item.colour ? { colour: item.colour } : {}),
    ...(item.size ? { size: item.size } : {}),
    ...(item.material ? { material: item.material } : {}),
    ...(item.gender ? { gender: item.gender } : {}),
  };

  if (seller.category === "Grocery") {
    ondcItem["@ondc/org/statutory_reqs_packaged_commodities"] = {
      manufacturer_or_packer_name: manufacturerOrPackerName,
      manufacturer_or_packer_address: manufacturerOrPackerAddress,
      common_or_generic_name_of_commodity: item.name,
      net_quantity_or_measure_of_commodity_in_pkg: item.netQty ?? "",
      month_year_of_manufacture_packing_import: item.packedMonth ?? "",
    };
    ondcItem["@ondc/org/statutory_reqs_prepackaged_food"] = {
      brand_owner_FSSAI_license_no: selfPacked ? item.fssaiLicenceNo ?? seller.fssai : item.fssaiLicenceNo!,
    };
    ondcItem.tags = [{ code: "veg_nonveg", list: [{ code: item.vegNonVeg ?? "veg", value: "yes" }] }];
  }

  return ondcItem;
}
