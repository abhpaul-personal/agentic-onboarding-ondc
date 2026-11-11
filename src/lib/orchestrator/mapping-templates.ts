import type { CacheStore } from "@/lib/cache";
import { computeMappingTemplateFingerprint } from "@/lib/cache";
import type { MappingTargetKey } from "@/lib/schemas/mapping-target";

const TEMPLATE_KEY_PREFIX = "mapping-template:";

/** Column header -> the target a reviewer approved for it at G2, for this source format. */
export type MappingTemplate = Record<string, MappingTargetKey | null>;

/**
 * Saves the approved mappings for a source format (its sorted header set)
 * so the next seller with a matching format starts pre-mapped. Not a
 * step-output cache entry (no model/version metadata applies), but reuses
 * the same CacheStore for storage.
 */
export async function saveMappingTemplate(
  store: CacheStore,
  headers: readonly string[],
  schemaVersion: string | number,
  template: MappingTemplate,
): Promise<void> {
  const fingerprint = computeMappingTemplateFingerprint({ headers, schemaVersion });
  await store.set(`${TEMPLATE_KEY_PREFIX}${fingerprint}`, {
    key: `${TEMPLATE_KEY_PREFIX}${fingerprint}`,
    step: "mapping-template",
    model_id: "n/a",
    created_at: new Date().toISOString(),
    output: template,
  });
}

/** Loads a previously approved template for this header set, if any. */
export async function loadMappingTemplate(
  store: CacheStore,
  headers: readonly string[],
  schemaVersion: string | number,
): Promise<MappingTemplate | null> {
  const fingerprint = computeMappingTemplateFingerprint({ headers, schemaVersion });
  const entry = await store.get<MappingTemplate>(`${TEMPLATE_KEY_PREFIX}${fingerprint}`);
  return entry ? entry.output : null;
}
