# COMPASS Explorer (v2)

Interactive explorer for the COMPASS binary-alloy phase-classification framework:
orbital + DFT/LOBSTER bonding descriptors (D1–D12) over 48 elements and 610
hand-verified binary pairs.

## Features
- **Heatmap periodic table** — recolor all 48 elements by any property (our
  descriptor inputs: metallic radius, Harrison r_d, Allred–Rochow EN, valence
  s/p/d, |ICOHP|, ICOBI; plus all 22 MAGPIE elemental properties). Click an
  element for its full property card.
- **Pair explorer** — pick any two elements → D1–D12 radar, COMPASS-12 predicted
  class with per-class probability, the hand-verified label, and the real binary
  phase diagram.
- **Classification map** — interactive scatter of any two descriptors, coloured
  by phase class.
- **Upload diagram** — drop your own phase-diagram image to view (client-side).

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview    # serve the production build
```

## Deploy (Netlify)
Push to GitHub and connect the repo to Netlify; `netlify.toml` is included
(build `npm run build`, publish `dist`). No backend needed — predictions are
precomputed (out-of-fold XGBoost on D1–D12) and shipped as JSON.

## Data (`public/data/`, regenerate from the paper repo)
- `elements.json` — 48 elements × 34 properties
- `pairs.json` — 610 pairs: D1–D12, hand-verified labels, predictions,
  probabilities, phase-diagram filenames
- `property_groups.json` — heatmap dropdown grouping
- `public/phase/` — binary phase-diagram images

## TODO (next)
- Add JARVIS-DFT per-element properties to the heatmap
- Precompute predictions for all 48×48 pairs (not just the 610 labelled)
