import { createHash } from "crypto";
import { canonicalJson } from "./canonical-json";

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Step output cache key: a hash of the step name, prompt version, schema
 * version, model ID and the normalised input. Bumping any version or
 * changing the model changes the key, so a stale output is never replayed.
 */
export interface StepCacheKeyInput {
  step: string;
  promptVersion: string | number;
  schemaVersion: string | number;
  modelId: string;
  input: unknown;
}

export function computeStepCacheKey(params: StepCacheKeyInput): string {
  return sha256Hex(
    canonicalJson({
      step: params.step,
      promptVersion: params.promptVersion,
      schemaVersion: params.schemaVersion,
      modelId: params.modelId,
      input: params.input,
    }),
  );
}

/**
 * Column-level cache key: a hash of the normalised header plus its top 5
 * distinct sample values, so a new file that repeats a known column does
 * not need a new mapping call.
 */
export interface ColumnCacheKeyInput {
  header: string;
  sampleValues: readonly string[];
  schemaVersion: string | number;
}

export function computeColumnCacheKey(params: ColumnCacheKeyInput): string {
  return sha256Hex(
    canonicalJson({
      header: normaliseHeader(params.header),
      sampleValues: params.sampleValues.slice(0, 5),
      schemaVersion: params.schemaVersion,
    }),
  );
}

/**
 * Mapping template fingerprint: keyed by source format, i.e. the sorted set
 * of normalised headers. A later file with the same header set starts
 * pre-mapped from the template saved when a reviewer approved it at G2.
 */
export interface MappingTemplateFingerprintInput {
  headers: readonly string[];
  schemaVersion: string | number;
}

export function computeMappingTemplateFingerprint(
  params: MappingTemplateFingerprintInput,
): string {
  const sortedHeaders = [...new Set(params.headers.map(normaliseHeader))].sort();
  return sha256Hex(
    canonicalJson({ headers: sortedHeaders, schemaVersion: params.schemaVersion }),
  );
}
