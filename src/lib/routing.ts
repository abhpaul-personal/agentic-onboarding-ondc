import { targetRisk, type MappingTargetKey } from "@/lib/schemas/mapping-target";

export const ROUTES = ["auto", "review", "fallback"] as const;
export type Route = (typeof ROUTES)[number];

export interface RoutableProposal {
  proposed: MappingTargetKey | null;
  confidence: number;
}

/**
 * PRD routing rule: low-risk fields at 0.90+ confidence auto-accept, anything
 * below 0.60 (or with no candidate) goes to the fallback queue, everything
 * else goes to a human at G2. High-risk fields never auto-accept regardless
 * of confidence.
 */
export function route(proposal: RoutableProposal): Route {
  if (proposal.proposed == null || proposal.confidence < 0.6) return "fallback";
  if (targetRisk(proposal.proposed) === "low" && proposal.confidence >= 0.9) {
    return "auto";
  }
  return "review";
}
