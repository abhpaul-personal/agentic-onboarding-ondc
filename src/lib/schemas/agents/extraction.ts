import { z } from "zod";

export const UNSTRUCTURED_SOURCE_FORMATS = ["whatsapp_text", "price_list_photo"] as const;
export const unstructuredSourceFormatSchema = z.enum(UNSTRUCTURED_SOURCE_FORMATS);
export type UnstructuredSourceFormat = (typeof UNSTRUCTURED_SOURCE_FORMATS)[number];

/**
 * 2. Extraction agent. Only unstructured sources (WhatsApp text, a photo of
 * a price list) go through the model; CSV and Excel are parsed as rows by
 * deterministic code and go straight to the mapping agent (PRD pipeline).
 */
export const extractionInputSchema = z.discriminatedUnion("source_format", [
  z.object({ source_format: z.literal("whatsapp_text"), raw_text: z.string().min(1) }),
  z.object({
    source_format: z.literal("price_list_photo"),
    image: z.object({
      data: z.string().min(1), // base64
      media_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
    }),
  }),
]);
export type ExtractionInput = z.infer<typeof extractionInputSchema>;

/** The model's output: no "id" (the caller assigns stable ids once items are confirmed). */
export const extractedItemSchema = z.object({
  name: z.string().min(1),
  net_qty: z.string().optional(),
  price: z.number().nonnegative().optional(),
  mrp: z.number().nonnegative().optional(),
  confidence: z.number().min(0).max(1),
  source_excerpt: z.string().min(1),
});
export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export const extractionOutputSchema = z.object({
  items: z.array(extractedItemSchema),
});
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
