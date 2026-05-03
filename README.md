# sage-core WASM Web Demo

This directory contains a static browser demo that runs a small `sage-core` search in WebAssembly.

## Files

- `src/lib.rs`: Rust wrapper exported as a `wasm-bindgen` module (`SearchEngine`).
- `index.html`, `app.js`, `styles.css`: Frontend.

## Quick start

### Build demo data (from PXD003881)

```bash
cd /home/michael/github/sage-wasm-demo
python scripts/build_demo_data.py \
  --out-json demo_data.json \
  --out-fasta mini.fasta \
  --results ~/data/PXD003881/results.sage.tsv \
  --mzml B03_21_150304_human_ecoli_A_3ul_3um_column_95_HCD_OT_2hrs_30B_9B.mzML.gz
```

1. Build the wasm package:

```bash
cd /home/michael/github/sage-wasm-demo
wasm-pack build --target web --out-dir pkg
```

2. Serve the folder with any static server, for example:

```bash
python -m http.server 4173
```

3. Open `http://localhost:4173/index.html` in a browser.

The demo loads a tiny FASTA set, builds a local database in the browser, and searches several
example spectra. Results are rendered as a JSON-backed hit list.
This project loads search settings from `PXD003881.json` and does not use `pro.json`.

You can regenerate with a different target file by setting `--mzml` (filename or full path) and changing
`--top` to control how many top-ranked rows are used for queries.

## GitHub Pages CI

A GitHub Actions workflow is included at `.github/workflows/ci-pages.yml`.

It compiles the wasm package in CI and publishes a fully static site (`index.html`, app assets, and `pkg/` output)
to GitHub Pages on pushes to `main`.

`sage-core` is resolved directly from the public git dependency in `Cargo.toml`, so no local sibling `sage` checkout is required.

After enabling GitHub Pages in repository settings with **Source: GitHub Actions**, pushes to `main` will trigger deployment.
