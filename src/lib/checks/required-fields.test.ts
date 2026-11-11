import { describe, expect, it } from "vitest";
import { findMissingStatutoryFields } from "./required-fields";

describe("findMissingStatutoryFields", () => {
  it("passes a Grocery item with every field present", () => {
    expect(
      findMissingStatutoryFields("Grocery", {
        net_quantity: true,
        mrp: true,
        manufacturer_or_packer_name: true,
        month_year_of_manufacture_packing_import: true,
        fssai_license_no: true,
        veg_non_veg: true,
      }),
    ).toEqual([]);
  });

  it("flags set F's planted missing-FSSAI error (third-party packed item)", () => {
    expect(
      findMissingStatutoryFields("Grocery", {
        net_quantity: true,
        mrp: true,
        manufacturer_or_packer_name: true,
        month_year_of_manufacture_packing_import: true,
        fssai_license_no: false,
        veg_non_veg: true,
      }),
    ).toEqual(["fssai_license_no"]);
  });

  it("does not require FSSAI for Fashion", () => {
    expect(
      findMissingStatutoryFields("Fashion", {
        net_quantity: false,
        mrp: false,
        manufacturer_or_packer_name: false,
        month_year_of_manufacture_packing_import: false,
        fssai_license_no: false,
        veg_non_veg: false,
      }),
    ).toEqual(["manufacturer_or_packer_name"]);
  });
});
