import { z } from "zod";

/**
 * Local ONDC retail item schema, built in M0/M1 from the public retail v1.2
 * keys and cross-checked against the eval kit's golden catalogs
 * (data/sets/*\/ground_truth/golden_catalog.json, sets A-F). Simplified for
 * this project: it covers what the demo and the eval kit exercise, not the
 * full ONDC spec. Verify against the official spec before publishing any
 * schema extract (PRD "IP and confidentiality" and "Open questions").
 */

export const statutoryPackagedCommoditiesSchema = z.object({
  manufacturer_or_packer_name: z.string(),
  manufacturer_or_packer_address: z.string(),
  common_or_generic_name_of_commodity: z.string(),
  net_quantity_or_measure_of_commodity_in_pkg: z.string(),
  month_year_of_manufacture_packing_import: z.string(),
});
export type StatutoryPackagedCommodities = z.infer<
  typeof statutoryPackagedCommoditiesSchema
>;

export const statutoryPrepackagedFoodSchema = z.object({
  brand_owner_FSSAI_license_no: z.string(),
});
export type StatutoryPrepackagedFood = z.infer<
  typeof statutoryPrepackagedFoodSchema
>;

export const vegNonVegSchema = z.enum(["veg", "non_veg"]);
export type VegNonVeg = z.infer<typeof vegNonVegSchema>;

const tagListEntrySchema = z.object({
  code: z.string(),
  value: z.string(),
});

const tagSchema = z.object({
  code: z.string(),
  list: z.array(tagListEntrySchema),
});

export const ondcItemSchema = z.object({
  id: z.string().min(1),
  descriptor: z.object({
    name: z.string().min(1),
    code: z.string(), // "1:<gtin13>", or "" when the seller has no barcode yet
    short_desc: z.string().optional(),
    images: z.array(z.string()).optional(),
  }),
  category_id: z.string().min(1),
  price: z.object({
    currency: z.literal("INR"),
    value: z.string(), // decimal string, e.g. "160.00"
    maximum_value: z.string(),
  }),
  quantity: z.object({
    available: z.object({
      count: z.number().int().nonnegative(),
    }),
  }),
  "@ondc/org/returnable": z.boolean(),
  "@ondc/org/cancellable": z.boolean(),
  "@ondc/org/time_to_ship": z.string(), // ISO 8601 duration, e.g. "P1D"
  tags: z.array(tagSchema),
  brand: z.string().optional(),
  net_quantity: z.string().optional(),
  "@ondc/org/statutory_reqs_packaged_commodities":
    statutoryPackagedCommoditiesSchema.optional(),
  "@ondc/org/statutory_reqs_prepackaged_food":
    statutoryPrepackagedFoodSchema.optional(),
  // Fashion variants (set C)
  parent_item_id: z.string().optional(),
  colour: z.string().optional(),
  size: z.string().optional(),
  material: z.string().optional(),
  gender: z.string().optional(),
});
export type OndcItem = z.infer<typeof ondcItemSchema>;

export const ondcCatalogSchema = z.object({
  context: z.object({
    domain: z.string(), // e.g. "ONDC:RET10" (Grocery), "ONDC:RET12" (Fashion)
    action: z.literal("on_search"),
  }),
  message: z.object({
    catalog: z.object({
      "bpp/providers": z.array(
        z.object({
          id: z.string(),
          descriptor: z.object({ name: z.string() }),
          items: z.array(ondcItemSchema),
        }),
      ),
    }),
  }),
});
export type OndcCatalog = z.infer<typeof ondcCatalogSchema>;
