import { describe, expect, it } from "vitest";
import {
  approveBulkG0,
  completeBulkIntake,
  completeBulkVerification,
  createBulkSellerOnboardingRun,
} from "./bulk-seller-onboarding";
import type { SellerProfile } from "@/lib/schemas/seller-profile";

function makeProfile(name: string, gstin: string): SellerProfile {
  return {
    seller_id: name,
    business_name: name,
    owner: name,
    city: "Satara",
    state: "Maharashtra",
    category: "Grocery",
    gstin,
    pan: gstin.slice(2, 12),
    fssai: "20000000000700",
    fssai_expiry: "2028-03-31",
    ifsc: "DEMO0000000",
    account: "000000000000",
    packer_address: "Demo address",
    returns: "Returnable within 2 days",
    time_to_ship: "P1D",
    own_brands: [],
  };
}

describe("bulk seller onboarding (set G's flow)", () => {
  it("drafts a row per profile, verifies, and approves clean rows while sending flagged ones back", () => {
    const clean = makeProfile("Lata's Masala", "27ZZZPL0004D1ZT");
    const flagged = makeProfile("Rupali's Kurdai", "27ZZZPR0008H1ZZ"); // bad checksum on purpose

    let state = createBulkSellerOnboardingRun("bulk-1");
    state = completeBulkIntake(state, [clean, flagged]);
    expect(state.step).toBe("s2");
    expect(state.rows).toHaveLength(2);

    state = completeBulkVerification(state, [
      [{ name: "GSTIN format and checksum", passed: true, value: clean.gstin }],
      [{ name: "GSTIN format and checksum", passed: false, value: flagged.gstin }],
    ]);
    expect(state.step).toBe("g0");
    expect(state.auditLog.some((e) => e.kind === "check" && e.text.includes("Row 2"))).toBe(true);

    const done = approveBulkG0(state, { 2: "GSTIN checksum does not match" });
    expect(done.step).toBe("done");
    expect(done.rows[0].approved).toBe(true);
    expect(done.rows[1].approved).toBe(false);
    expect(done.gate?.outcome).toBe("1 approved, 1 sent back");
    expect(done.auditLog.at(-1)?.text).toContain("GSTIN checksum does not match");
  });
});
