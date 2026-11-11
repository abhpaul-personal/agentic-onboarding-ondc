import type { SellerCategory } from "@/lib/schemas/seller-profile";

/**
 * The statutory fields G3 must have an answer for, after the seller-profile
 * pre-fill has already run (PRD G3 table). `has*` flags are supplied by the
 * caller rather than computed here, since "present" differs for a boolean
 * like veg_non_veg versus a non-empty string.
 */
export interface StatutoryFieldPresence {
  net_quantity: boolean;
  mrp: boolean;
  manufacturer_or_packer_name: boolean;
  month_year_of_manufacture_packing_import: boolean;
  fssai_license_no: boolean;
  veg_non_veg: boolean;
}

export type RequiredStatutoryField = keyof StatutoryFieldPresence;

const GROCERY_REQUIRED_FIELDS: readonly RequiredStatutoryField[] = [
  "net_quantity",
  "mrp",
  "manufacturer_or_packer_name",
  "month_year_of_manufacture_packing_import",
  "fssai_license_no",
  "veg_non_veg",
];

/** Fashion carries no packaged-commodity statutory block in this project's scope. */
const FASHION_REQUIRED_FIELDS: readonly RequiredStatutoryField[] = [
  "manufacturer_or_packer_name",
];

export function requiredStatutoryFields(
  category: SellerCategory,
): readonly RequiredStatutoryField[] {
  return category === "Grocery" ? GROCERY_REQUIRED_FIELDS : FASHION_REQUIRED_FIELDS;
}

/** Returns every required field that is missing, given what is present. */
export function findMissingStatutoryFields(
  category: SellerCategory,
  presence: StatutoryFieldPresence,
): RequiredStatutoryField[] {
  return requiredStatutoryFields(category).filter((field) => !presence[field]);
}
