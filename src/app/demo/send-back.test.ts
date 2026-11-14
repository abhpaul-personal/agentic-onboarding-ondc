import { describe, expect, it } from "vitest";
import { verifySellerChecks } from "@/lib/agents/verification";
import { loadRegistrationForm } from "@/lib/demo/load-set-data";
import type { DemoState } from "@/lib/demo/state";
import { singleApproveG0, singleRejectG0, singleRunIntake, singleRunVerification, startDemo } from "./actions";

type Single = Extract<DemoState, { kind: "single" }>;

function single(state: DemoState): Single {
  if (state.kind !== "single") throw new Error("expected a single-seller run");
  return state;
}

async function toG0(setId: "A" | "B" | "C" | "D" | "E" | "F"): Promise<Single> {
  let state = await startDemo(setId);
  state = await singleRunIntake(state);
  state = await singleRunVerification(state);
  return single(state);
}

const failedNames = (s: Single) =>
  (s.seller.checks ?? []).filter((c) => !c.passed).map((c) => c.name);

describe("set C: the deliberate misread, Send back, and the retry", () => {
  it("fails the GSTIN checksum on attempt 1, so the reviewer cannot approve", async () => {
    const g0 = await toG0("C");
    expect(g0.seller.step).toBe("g0");
    expect(failedNames(g0)).toContain("GSTIN format and checksum");
    await expect(singleApproveG0(g0)).rejects.toThrow();
  });

  it("Send back replays a second attempt that passes, and the reviewer can then approve", async () => {
    const g0 = await toG0("C");
    const badGstin = g0.seller.profile!.gstin;

    const sentBack = single(await singleRejectG0(g0));
    expect(sentBack.seller.step).toBe("s1"); // back to intake, not the manual correction panel
    expect(sentBack.seller.intakeAttempt).toBe(2);
    expect(sentBack.seller.priorAttempt?.gstin).toBe(badGstin);

    const retried = single(await singleRunIntake(sentBack));
    expect(retried.pending).toBeUndefined(); // attempt 2 is warmed, not a "Not warmed yet" card
    expect(retried.seller.step).toBe("s2");
    expect(retried.seller.profile!.gstin).not.toBe(badGstin);
    expect(retried.seller.profile!.gstin).toBe(loadRegistrationForm("C").gstin);

    const reverified = single(await singleRunVerification(retried));
    expect(reverified.seller.step).toBe("g0");
    expect(failedNames(reverified)).toEqual([]);

    const approved = single(await singleApproveG0(reverified));
    expect(approved.seller.step).toBe("approved");
    expect(approved.catalog).toBeDefined();
  });

  it("keeps the failed attempt in the audit log above the retry", async () => {
    const g0 = await toG0("C");
    const sentBack = single(await singleRejectG0(g0));
    const retried = single(await singleRunVerification(single(await singleRunIntake(sentBack))));
    const log = retried.seller.auditLog.map((e) => e.text);
    const failIndex = log.findIndex((t) => t.startsWith("GSTIN format and checksum: fail"));
    const sentBackIndex = log.findIndex((t) => t.includes("sent back to seller intake for attempt 2"));
    const passIndex = log.findLastIndex((t) => t.startsWith("GSTIN format and checksum: pass"));
    expect(failIndex).toBeGreaterThanOrEqual(0);
    expect(sentBackIndex).toBeGreaterThan(failIndex);
    expect(passIndex).toBeGreaterThan(sentBackIndex);
    expect(log.some((t) => t.startsWith("S1 note:"))).toBe(true);
  });
});

describe("every other set goes straight through G0 with no Send back", () => {
  for (const setId of ["A", "B", "D", "E", "F"] as const) {
    it(`set ${setId} passes on the first attempt and can be approved`, async () => {
      const g0 = await toG0(setId);
      expect(g0.seller.intakeAttempt).toBeUndefined();
      expect(failedNames(g0)).toEqual([]);
      const approved = single(await singleApproveG0(g0));
      expect(approved.seller.step).toBe("approved");
    });
  }
});

describe("when no retry has been warmed", () => {
  it("Send back falls back to the seller correcting the value, so the run is never stuck", async () => {
    const g0 = await toG0("B");
    // A failing reading no retry entry exists for (set B has no attempt 2).
    const bad = { ...g0.seller.profile!, gstin: "27ZZZZPB0002B1Z9" };
    const failing: Single = { ...g0, seller: { ...g0.seller, profile: bad, checks: verifySellerChecks(bad) } };
    const sentBack = single(await singleRejectG0(failing));
    expect(sentBack.seller.step).toBe("correct");
  });
});
