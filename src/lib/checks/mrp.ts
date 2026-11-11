/** The selling price must never exceed the MRP. */
export function mrpAtOrAboveSellingPrice(mrp: number, sellingPrice: number): boolean {
  return sellingPrice <= mrp;
}
