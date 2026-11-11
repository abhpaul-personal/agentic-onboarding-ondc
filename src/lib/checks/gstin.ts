const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Format and check-digit validation for a 15-character GSTIN. */
export function gstinValid(gstin: string): boolean {
  if (!GSTIN_PATTERN.test(gstin)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = BASE36.indexOf(gstin[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkDigit = BASE36[(36 - (sum % 36)) % 36];
  return checkDigit === gstin[14];
}

/** Official CBIC state codes used as the first two digits of a GSTIN. */
export const GST_STATE_CODES: Record<string, string> = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  "Punjab": "03",
  "Chandigarh": "04",
  "Uttarakhand": "05",
  "Haryana": "06",
  "Delhi": "07",
  "Rajasthan": "08",
  "Uttar Pradesh": "09",
  "Bihar": "10",
  "Sikkim": "11",
  "Arunachal Pradesh": "12",
  "Nagaland": "13",
  "Manipur": "14",
  "Mizoram": "15",
  "Tripura": "16",
  "Meghalaya": "17",
  "Assam": "18",
  "West Bengal": "19",
  "Jharkhand": "20",
  "Odisha": "21",
  "Chhattisgarh": "22",
  "Madhya Pradesh": "23",
  "Gujarat": "24",
  "Daman and Diu": "25",
  "Dadra and Nagar Haveli": "26",
  "Maharashtra": "27",
  "Andhra Pradesh (old)": "28",
  "Karnataka": "29",
  "Goa": "30",
  "Lakshadweep": "31",
  "Kerala": "32",
  "Tamil Nadu": "33",
  "Puducherry": "34",
  "Andaman and Nicobar Islands": "35",
  "Telangana": "36",
  "Andhra Pradesh": "37",
  "Ladakh": "38",
};

/** Whether a GSTIN's state-code prefix matches the seller's registered state. */
export function gstinStateCodeMatches(gstin: string, state: string): boolean {
  const code = GST_STATE_CODES[state];
  return code != null && gstin.slice(0, 2) === code;
}
