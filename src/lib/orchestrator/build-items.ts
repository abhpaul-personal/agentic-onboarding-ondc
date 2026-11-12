import type { MappingTargetKey } from "@/lib/schemas/mapping-target";
import { formatNetQuantityGrams, parseNetQuantityGrams } from "@/lib/parse/net-quantity";
import { parsePackedMonth } from "@/lib/parse/packed-month";
import type { CatalogItem } from "./types";

/**
 * Applies resolved column mappings to raw rows, turning spreadsheet data
 * into structured catalog items. Deterministic code, not a model call:
 * the mapping agent and G2 only decide *which* column goes where, this
 * step just reads the value out.
 */
export function buildItemsFromMappedColumns(
  rows: readonly Record<string, string>[],
  columnTargets: Readonly<Record<string, MappingTargetKey | null>>,
): CatalogItem[] {
  return rows.map((row, index) => {
    const item: CatalogItem = { id: `row-${index + 1}`, name: "" };
    for (const [column, target] of Object.entries(columnTargets)) {
      if (target == null || target === "IGNORE") continue;
      applyField(item, target, row[column] ?? "");
    }
    return item;
  });
}

/**
 * Rule-based price normalisation (PRD: "Rs. 120/-", "₹120.00" -> 120.00
 * INR, handled by a rule, not the model). Takes the first run of digits
 * (with optional comma thousands separators and a decimal part),
 * dropping any currency symbol, "Rs"/"Rs." prefix or "/-" suffix.
 */
function parsePrice(raw: string): number {
  const match = raw.match(/[\d,]+(?:\.\d+)?/);
  return match ? Number(match[0].replace(/,/g, "")) : NaN;
}

function applyField(item: CatalogItem, target: MappingTargetKey, value: string): void {
  const trimmed = value.trim();
  if (trimmed === "") return;
  switch (target) {
    case "id":
      item.id = trimmed;
      break;
    case "descriptor.name":
      item.name = trimmed;
      break;
    case "descriptor.short_desc":
      item.description = trimmed;
      break;
    case "brand":
      item.brand = trimmed;
      break;
    case "category_id":
      item.category = trimmed;
      break;
    case "descriptor.code":
      item.gtin = trimmed;
      break;
    case "net_quantity": {
      // Rule-based unit normalisation ("500gm", "0.5 kg" -> "500 g"). A word
      // form like "aadha kilo" needs the LLM (PRD): kept as the raw value,
      // never blanked, so validateItems can flag it for G2/the fallback queue.
      const grams = parseNetQuantityGrams(trimmed);
      item.netQty = grams != null ? formatNetQuantityGrams(grams) : trimmed;
      break;
    }
    case "price.value":
      item.price = parsePrice(trimmed);
      break;
    case "price.maximum_value":
      item.mrp = parsePrice(trimmed);
      break;
    case "quantity.available.count":
      item.stock = Number(trimmed);
      break;
    case "veg_non_veg":
      item.vegNonVeg = /non[\s_-]?veg/i.test(trimmed) ? "non_veg" : "veg";
      break;
    case "month_year_of_manufacture_packing_import": {
      // Rule-based date normalisation ("Oct-26", "Sept 2026" -> "10/2026").
      // Kept as the raw value when unparseable, never blanked, so
      // validateItems can flag it for the fallback queue.
      const canonical = parsePackedMonth(trimmed);
      item.packedMonth = canonical ?? trimmed;
      break;
    }
    case "brand_owner_FSSAI_license_no":
      item.fssaiLicenceNo = trimmed;
      break;
    case "manufacturer_or_packer_name":
      item.manufacturerOrPackerName = trimmed;
      break;
    case "parent_item_id":
      item.parentItemId = trimmed;
      break;
    case "colour":
      item.colour = trimmed;
      break;
    case "size":
      item.size = trimmed;
      break;
    case "material":
      item.material = trimmed;
      break;
    case "gender":
      item.gender = trimmed;
      break;
    case "descriptor.images":
    case "shelf_life":
    case "@ondc/org/time_to_ship":
      // Not modelled on CatalogItem yet; carried through to the ONDC item builder separately if needed.
      break;
  }
}
