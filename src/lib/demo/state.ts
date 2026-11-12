import type { SampleSetId } from "./sample-sets";
import type { BulkSellerOnboardingState } from "@/lib/orchestrator/bulk-seller-onboarding";
import type { SellerOnboardingState } from "@/lib/orchestrator/seller-onboarding";
import type { CatalogRunState } from "@/lib/orchestrator/catalog-run";

/**
 * The demo site only ever replays from the committed cache (PRD: "Demo
 * mode... every agent step served from the committed cache"). A step
 * whose cache entry doesn't exist yet (agents:warm hasn't run) sets
 * `pending` instead of silently calling the live model or fabricating an
 * output; the UI shows that as a clear "not warmed yet" card.
 */
export interface PendingInfo {
  step: string;
  note: string;
}

export type DemoState =
  | { setId: SampleSetId; kind: "bulk"; bulk: BulkSellerOnboardingState; pending?: PendingInfo }
  | {
      setId: SampleSetId;
      kind: "single";
      seller: SellerOnboardingState;
      catalog?: CatalogRunState;
      pending?: PendingInfo;
    };
