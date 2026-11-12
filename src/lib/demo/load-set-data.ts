import { readFileSync } from "fs";
import { join } from "path";
import { parseCsvRecords } from "@/lib/parse/csv";
import { registrationFormSchema, type RegistrationForm, type SellerProfile } from "@/lib/schemas/seller-profile";
import type { SellerIntakeInput } from "@/lib/schemas/agents/seller-intake";

const DATA_DIR = join(process.cwd(), "data/sets");

function setDir(setId: string): string {
  return join(DATA_DIR, `set-${setId}`);
}

function imageMediaType(path: string): "image/png" | "image/jpeg" {
  return path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : "image/png";
}

function readImageBase64(absolutePath: string) {
  return { data: readFileSync(absolutePath).toString("base64"), media_type: imageMediaType(absolutePath) };
}

export function loadRegistrationForm(setId: string): RegistrationForm {
  const raw = readFileSync(join(setDir(setId), "seller_pack/registration_form.json"), "utf-8");
  return registrationFormSchema.parse(JSON.parse(raw));
}

/** Builds the exact input the seller-intake agent (and agents:warm) used, for a matching cache lookup. */
export function loadSellerIntakeInput(setId: string): SellerIntakeInput {
  const form = loadRegistrationForm(setId);
  const dir = join(setDir(setId), "seller_pack");
  return {
    registration_form: form,
    documents: {
      gst_certificate: readImageBase64(join(dir, "gst_certificate.png")),
      fssai_licence: form.category === "Grocery" ? readImageBase64(join(dir, "fssai_licence.png")) : undefined,
      cancelled_cheque: readImageBase64(join(dir, "cancelled_cheque.png")),
    },
  };
}

const CATALOG_FILE: Record<string, string> = {
  A: "catalog.csv",
  B: "catalog_flat.csv",
  C: "products_export.csv",
  F: "catalog.csv",
};

/** Raw rows for a structured (CSV/Excel) set. */
export function loadRawRows(setId: string): Record<string, string>[] {
  const file = CATALOG_FILE[setId];
  if (!file) throw new Error(`Set ${setId} has no structured catalog file.`);
  const raw = readFileSync(join(setDir(setId), file), "utf-8");
  return parseCsvRecords(raw);
}

/** The ground-truth column -> target mapping, for the /scorecard comparison (never shown as the agent's own output). */
export function loadFieldMappingTruth(setId: string): Record<string, string> {
  const raw = readFileSync(join(setDir(setId), "ground_truth/field_mapping.json"), "utf-8");
  return JSON.parse(raw);
}

export function loadWhatsappText(setId: string): string {
  return readFileSync(join(setDir(setId), "whatsapp_export.txt"), "utf-8");
}

export function loadPriceListPhoto(setId: string) {
  return readImageBase64(join(setDir(setId), "price_list_photo.png"));
}

export function loadBulkSellerRows(): Record<string, string>[] {
  const raw = readFileSync(join(setDir("G"), "cooperative_sellers.csv"), "utf-8");
  return parseCsvRecords(raw);
}

/**
 * Bulk Stage 1 (set G) is pure CSV parsing, not a model call (PRD: bulk
 * onboarding from one CSV). The cooperative's CSV has no packer address,
 * return terms or time-to-ship column, so those are left as a clearly
 * labelled placeholder rather than invented; PAN is the GSTIN's own
 * embedded PAN (characters 3-12), not a new value.
 */
export function buildBulkSellerProfiles(rows: readonly Record<string, string>[]): SellerProfile[] {
  return rows.map((row, index) => ({
    seller_id: `COOP-${index + 1}`,
    business_name: row["business_name"] ?? "",
    owner: row["member_name"] ?? "",
    city: row["city"] ?? "",
    state: row["state"] ?? "",
    category: row["category"] === "Fashion" ? "Fashion" : "Grocery",
    gstin: row["gstin"] ?? "",
    pan: (row["gstin"] ?? "").slice(2, 12),
    fssai: row["fssai_no"] ?? "",
    fssai_expiry: row["fssai_expiry"] ?? "",
    ifsc: row["bank_ifsc"] ?? "",
    account: row["account_no"] ?? "",
    packer_address: "Not collected in bulk onboarding",
    returns: "Not collected in bulk onboarding",
    time_to_ship: "P2D",
    own_brands: [],
  }));
}
