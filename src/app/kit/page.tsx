import { Card } from "@/components/ui";
import { SAMPLE_SETS } from "@/lib/demo/sample-sets";

const KIT_VERSION = "v1.2";

interface RawFile {
  label: string;
  path: string;
}

const RAW_FILES: Record<string, RawFile[]> = {
  A: [{ label: "catalog.csv", path: "catalog.csv" }],
  B: [
    { label: "catalog.xlsx", path: "catalog.xlsx" },
    { label: "catalog_flat.csv", path: "catalog_flat.csv" },
  ],
  C: [{ label: "products_export.csv", path: "products_export.csv" }],
  D: [{ label: "whatsapp_export.txt", path: "whatsapp_export.txt" }],
  E: [{ label: "price_list_photo.png", path: "price_list_photo.png" }],
  F: [
    { label: "catalog.csv", path: "catalog.csv" },
    { label: "planted_errors.json", path: "ground_truth/planted_errors.json" },
  ],
  G: [
    { label: "cooperative_sellers.csv", path: "cooperative_sellers.csv" },
    { label: "planted_errors.json", path: "planted_errors.json" },
  ],
};

export const metadata = {
  title: "Evaluation kit",
};

export default function KitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-[26px] font-semibold tracking-tight">Evaluation and dummy data kit</h1>
        <p className="max-w-[70ch] text-[var(--ink2)]">
          Synthetic sellers and catalogs with ground truth, so anyone can test an onboarding flow and
          reproduce the scores. Data under CC BY 4.0, scoring script under MIT. Current version:{" "}
          <span className="font-mono">{KIT_VERSION}</span>.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <a
          href="/kit/eval-kit-v1.2.zip"
          className="rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-3.5 py-2 font-semibold text-white no-underline"
        >
          Download the full kit (.zip)
        </a>
        <a
          href="/kit/score.py"
          className="rounded-lg border border-[var(--line)] bg-white px-3.5 py-2 font-semibold text-[var(--ink)] no-underline hover:border-[var(--ink3)]"
        >
          score.py
        </a>
        <a
          href="/kit/README.md"
          className="rounded-lg border border-[var(--line)] bg-white px-3.5 py-2 font-semibold text-[var(--ink)] no-underline hover:border-[var(--ink3)]"
        >
          README.md
        </a>
        <span className="text-xs text-[var(--ink2)]">
          python3 score.py set-B/ground_truth/field_mapping.json your_run.json
        </span>
      </Card>

      <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[#fbfaf7]">
              {["Set", "Seller (fictional)", "Format", "Tests", "Files"].map((h) => (
                <th key={h} className="border-b border-[var(--line)] p-2 text-left font-semibold text-[var(--ink2)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_SETS.map((set) => (
              <tr key={set.id} className="border-b border-[var(--line2)] align-top">
                <td className="p-2 font-semibold">{set.id}</td>
                <td className="p-2">{set.title}</td>
                <td className="p-2">
                  {set.format}
                  <div className="text-[var(--ink3)]">{set.size}</div>
                </td>
                <td className="p-2 text-[var(--ink2)]">{set.tests}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1.5">
                    {RAW_FILES[set.id]?.map((file) => (
                      <a
                        key={file.path}
                        href={`/kit/set-${set.id}/${file.path}`}
                        className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 font-mono text-[11.5px] no-underline text-[var(--ink)] hover:border-[var(--ink3)]"
                      >
                        {file.label}
                      </a>
                    ))}
                    {!set.bulk && (
                      <>
                        <a
                          href={`/kit/set-${set.id}/ground_truth/golden_catalog.json`}
                          className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 font-mono text-[11.5px] no-underline text-[var(--ink)] hover:border-[var(--ink3)]"
                        >
                          golden catalog
                        </a>
                        <a
                          href={`/kit/set-${set.id}/ground_truth/field_mapping.json`}
                          className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 font-mono text-[11.5px] no-underline text-[var(--ink)] hover:border-[var(--ink3)]"
                        >
                          mapping truth
                        </a>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--ink3)]">
        Every business, person, GSTIN, PAN, FSSAI number, bank account and barcode in this kit is
        fictional test data. GTINs use the GS1 restricted-circulation prefix range so they cannot match
        real retail products.
      </p>
    </div>
  );
}
