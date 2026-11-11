/**
 * Runs every agent step once per sample set, against the real model, and
 * writes the outputs to data/cache/. Run it once locally with your own
 * API key, review the outputs, then commit the cache: the deployed public
 * site replays these files and never calls the model.
 *
 * Usage:
 *   npm run agents:warm                 # dry run: set B only (review before --all)
 *   npm run agents:warm -- --set=D      # a specific set
 *   npm run agents:warm -- --all        # every set (A-F; G has no catalog to warm)
 *
 * Needs ANTHROPIC_API_KEY. Costs real money per the PRD's "under $0.50 for
 * a first run of a 50-item catalog" target; running it twice in a row
 * makes no model calls the second time (M2's cache layer).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { createCacheStore } from "@/lib/cache";
import { getAnthropicClient, defaultModelId } from "@/lib/llm/client";
import { parseCsvRecords } from "@/lib/parse/csv";
import { profileColumns } from "@/lib/parse/profile-columns";
import { registrationFormSchema } from "@/lib/schemas/seller-profile";
import { runSellerIntakeAgent } from "@/lib/agents/seller-intake";
import { runMappingAgent } from "@/lib/agents/mapping";
import { runCategoryAgent } from "@/lib/agents/category";
import { runExtractionAgent } from "@/lib/agents/extraction";

const DATA_DIR = join(process.cwd(), "data/sets");

interface StructuredSetConfig {
  kind: "structured";
  set: string;
  catalogFile: string;
  nameColumn: string;
  descriptionColumn?: string;
  categoryIds: string[];
}

interface UnstructuredSetConfig {
  kind: "whatsapp_text" | "price_list_photo";
  set: string;
  sourceFile: string;
}

type SetConfig = StructuredSetConfig | UnstructuredSetConfig;

// Category ids are the distinct category_id values from each set's own
// golden catalog (data/sets/*/ground_truth/golden_catalog.json) — the
// local target list, not a client's product data.
const SET_CONFIGS: Record<string, SetConfig> = {
  A: {
    kind: "structured",
    set: "A",
    catalogFile: "set-A/catalog.csv",
    nameColumn: "product_name",
    categoryIds: ["Masala and Seasoning", "Sauces, Spreads and Dips"],
  },
  B: {
    kind: "structured",
    set: "B",
    catalogFile: "set-B/catalog_flat.csv",
    nameColumn: "Item Naam",
    categoryIds: [
      "Atta, Flours and Sooji",
      "Beverages",
      "Cereals and Breakfast",
      "Chocolates and Biscuits",
      "Cooking and Baking Needs",
      "Dals and Pulses",
      "Dry Fruits, Nuts and Seeds",
      "Masala and Seasoning",
      "Oil and Ghee",
      "Pasta, Soup and Noodles",
      "Rice and Rice Products",
      "Sauces, Spreads and Dips",
      "Snacks and Namkeen",
    ],
  },
  C: {
    kind: "structured",
    set: "C",
    catalogFile: "set-C/products_export.csv",
    nameColumn: "Title",
    descriptionColumn: "Body (HTML)",
    categoryIds: ["Dupattas", "Kurtas and Kurta Sets", "Sarees", "Tops"],
  },
  D: { kind: "whatsapp_text", set: "D", sourceFile: "set-D/whatsapp_export.txt" },
  E: { kind: "price_list_photo", set: "E", sourceFile: "set-E/price_list_photo.png" },
  F: {
    kind: "structured",
    set: "F",
    catalogFile: "set-F/catalog.csv",
    nameColumn: "name",
    descriptionColumn: "description",
    categoryIds: [
      "Atta, Flours and Sooji",
      "Beverages",
      "Cereals and Breakfast",
      "Chocolates and Biscuits",
      "Cooking and Baking Needs",
      "Dals and Pulses",
      "Dry Fruits, Nuts and Seeds",
      "Masala and Seasoning",
      "Oil and Ghee",
      "Pasta, Soup and Noodles",
      "Rice and Rice Products",
      "Sauces, Spreads and Dips",
      "Snacks and Namkeen",
    ],
  },
  // G is bulk seller onboarding only (Stage 1), no catalog: nothing to warm here.
};

function imageMediaType(path: string): "image/png" | "image/jpeg" {
  return path.endsWith(".jpg") || path.endsWith(".jpeg") ? "image/jpeg" : "image/png";
}

function readImageBase64(relativePath: string) {
  const absolute = join(DATA_DIR, relativePath);
  return { data: readFileSync(absolute).toString("base64"), media_type: imageMediaType(absolute) };
}

async function warmSellerIntake(set: string, store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const formPath = join(DATA_DIR, `set-${set}/seller_pack/registration_form.json`);
  const form = registrationFormSchema.parse(JSON.parse(readFileSync(formPath, "utf-8")));
  const result = await runSellerIntakeAgent({
    store,
    client,
    model,
    input: {
      registration_form: form,
      documents: {
        gst_certificate: readImageBase64(`set-${set}/seller_pack/gst_certificate.png`),
        fssai_licence: form.category === "Grocery" ? readImageBase64(`set-${set}/seller_pack/fssai_licence.png`) : undefined,
        cancelled_cheque: readImageBase64(`set-${set}/seller_pack/cancelled_cheque.png`),
      },
    },
  });
  console.log(`  seller-intake: ${result.cached ? "cached" : "called model"}`);
  return result;
}

async function warmMapping(config: StructuredSetConfig, store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const raw = readFileSync(join(DATA_DIR, config.catalogFile), "utf-8");
  const records = parseCsvRecords(raw);
  const columns = profileColumns(records);
  let calledModel = 0;
  for (const column of columns) {
    const result = await runMappingAgent({ store, client, model, column });
    if (!result.cached) calledModel++;
  }
  console.log(`  mapping: ${columns.length} columns, ${calledModel} called the model`);
  return { records, columns };
}

async function warmCategory(config: StructuredSetConfig, records: Record<string, string>[], store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const items = records.map((row, index) => ({
    id: `row-${index + 1}`,
    name: row[config.nameColumn] ?? "",
    description: config.descriptionColumn ? row[config.descriptionColumn] : undefined,
  }));
  const result = await runCategoryAgent({
    store,
    client,
    model,
    input: { items, allowed_categories: config.categoryIds },
  });
  console.log(`  category: ${items.length} items, ${result.cached ? "cached" : "called model"}`);
  return result;
}

async function warmExtraction(config: UnstructuredSetConfig, store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const result =
    config.kind === "whatsapp_text"
      ? await runExtractionAgent({
          store,
          client,
          model,
          input: { source_format: "whatsapp_text", raw_text: readFileSync(join(DATA_DIR, config.sourceFile), "utf-8") },
        })
      : await runExtractionAgent({
          store,
          client,
          model,
          input: { source_format: "price_list_photo", image: readImageBase64(config.sourceFile) },
        });
  console.log(`  extraction: ${result.output.items.length} items, ${result.cached ? "cached" : "called model"}`);
  return result;
}

async function warmSet(set: string, store: ReturnType<typeof createCacheStore>, client: ReturnType<typeof getAnthropicClient>, model: string) {
  const config = SET_CONFIGS[set];
  if (!config) {
    console.log(`Set ${set}: nothing to warm (no catalog, or not configured).`);
    return;
  }
  console.log(`Set ${set}:`);
  await warmSellerIntake(set, store, client, model);
  if (config.kind === "structured") {
    const { records } = await warmMapping(config, store, client, model);
    await warmCategory(config, records, store, client, model);
  } else {
    await warmExtraction(config, store, client, model);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const setArg = args.find((a) => a.startsWith("--set="))?.split("=")[1];
  const sets = all ? ["A", "B", "C", "D", "E", "F"] : [setArg ?? "B"];

  if (!all && !setArg) {
    console.log("No --set or --all given: defaulting to a dry run on set B only.");
    console.log("Review the output, then run with --all to warm every set.\n");
  }

  const store = createCacheStore();
  const client = getAnthropicClient();
  const model = defaultModelId();
  console.log(`Model: ${model}\n`);

  for (const set of sets) {
    await warmSet(set, store, client, model);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
