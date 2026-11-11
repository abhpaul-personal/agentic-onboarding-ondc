import { describe, expect, it } from "vitest";
import { runNameMatch } from "./verification";
import type { SellerProfile } from "@/lib/schemas/seller-profile";

const profile: SellerProfile = {
  seller_id: "SLR-A",
  business_name: "Tilwari Masala Ghar",
  owner: "Meena Tilwari",
  city: "Nashik",
  state: "Maharashtra",
  category: "Grocery",
  gstin: "27ZZZPT0001A1ZU",
  pan: "ZZZPT0001A",
  fssai: "20000000000001",
  fssai_expiry: "2028-03-31",
  ifsc: "DEMO0000001",
  account: "000000000101",
  packer_address: "Plot 4, Demo Industrial Lane, Nashik 422000",
  returns: "Not returnable (food)",
  time_to_ship: "P1D",
};

describe("runNameMatch", () => {
  it("is deterministic and never calls a model", () => {
    const result = runNameMatch({ profile });
    expect(result.matched).toBe(true);
    expect(result.reason).toContain(profile.business_name);
  });
});
