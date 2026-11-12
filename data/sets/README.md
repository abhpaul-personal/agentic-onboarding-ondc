# Evaluation kit v1.2: Agentic Onboarding for ONDC Sellers

Personal case-study project. Not affiliated with ONDC or any network participant.
Every business, person, GSTIN, PAN, FSSAI number, bank account and barcode in this kit is fictional test data.
GTINs use the GS1 restricted-circulation prefix 2 so they cannot match real retail products.

## Sets
| Set | Seller (fictional) | Format | Size | Tests |
| --- | --- | --- | --- | --- |
| A | Tilwari Masala Ghar, Nashik | Clean CSV | 40 items | Baseline mapping |
| B | Rambhau Kirana Stores, Pune | Messy Excel (merged title, blank rows, Hinglish headers) | 60 items | Synonyms, unit and price normalisation |
| C | Neelkurinji Threads, Kochi | Shopify-style export | 84 variants | Variants, size and colour |
| D | Butterleaf Home Bakery, Indore | WhatsApp text | 25 items | Free-text extraction, G1 |
| E | Kanakchampa Sweets, Kolkata | Price-list photo | 20 items | Image extraction, G1 |
| F | Trapline Traders, Nagpur | CSV with planted errors | 32 rows | Validation recall, no-invention guardrail |
| G | Sakhi Annapurna cooperative, Satara | Bulk seller CSV | 12 sellers | Bulk Stage 1 and G0 |

Each set A to F holds the raw seller file, a seller_pack (registration form and specimen documents) and ground_truth
(field mapping, golden ONDC-style catalog, planted errors where relevant).
Golden catalogs are modelled on ONDC retail v1.2 keys and must be checked against the official spec.

## Changelog

**v1.2**
- Every set's `registration_form.json` now has `own_brands`: the brand names a seller
  packs under themselves (A: `["Tilwari"]`, C: `["Neelkurinji"]`, D: `["Butterleaf"]`,
  E: `["Kanakchampa"]`, B and F: `[]`). An item whose brand is blank or matches one of
  these is self-packed; only a genuinely third-party brand needs the seller's G3
  pack-label entry. No change to any golden catalog.

**v1.1**
- Set B: branded items now carry brand-owner packer details from the pack label; added
  `brand_owner_labels.json` and `g3_expected.json`. Previously, set B's golden catalog
  credited the seller as packer for every item, including the 48 items sold under
  someone else's brand (Gharkul Demo, Panchvati Pantry, Annakosh, Kesarbaug Foods); the
  PRD's own G3 rule says a branded item's packer and FSSAI licence are the brand owner's,
  copied from the pack label, not defaulted to the seller. Every other set, and every
  other value in set B (prices, quantities, GTINs, stock, dates), is unchanged from v1.

## Scoring
python3 score.py set-B/ground_truth/field_mapping.json your_run.json

## License
Data: CC BY 4.0. Code (score.py): MIT.
