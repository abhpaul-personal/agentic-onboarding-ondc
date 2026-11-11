import { z } from "zod";

export const SOURCE_FORMATS = ["csv", "excel", "whatsapp_text", "price_list_photo"] as const;
export const sourceFormatSchema = z.enum(SOURCE_FORMATS);
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

/** 2. Extraction agent: reads raw rows, chat text or a photo into draft items. */
export const extractionInputSchema = z.object({
  source_format: sourceFormatSchema,
  raw_text: z.string().optional(), // whatsapp_text, or OCR output for price_list_photo
  rows: z.array(z.record(z.string(), z.string())).optional(), // csv, excel
});
export type ExtractionInput = z.infer<typeof extractionInputSchema>;

export const extractedItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  net_qty: z.string().optional(),
  price: z.number().nonnegative().optional(),
  mrp: z.number().nonnegative().optional(),
  confidence: z.number().min(0).max(1),
  // What the agent read this from (a chat line, a row), so G1 can show it and
  // a guardrail test can confirm every value traces to the source.
  source_excerpt: z.string().optional(),
});
export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export const extractionOutputSchema = z.object({
  items: z.array(extractedItemSchema),
});
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
