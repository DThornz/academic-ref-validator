# Academic Reference Validator

A client-side tool for checking the authenticity of academic citations. Paste a reference list and each entry is verified against multiple academic databases. Returns a legitimacy classification with transparent, per-reason explanations and colour-coded results. Pure HTML/CSS/JS — no frameworks, no server, no API keys required.

## Live demo

`https://dthornz.github.io/academic-ref-validator/`

## Run locally

The app uses ES modules and must be served over HTTP, not opened directly as a file.

```bash
# Python 3
python3 -m http.server 8000

# Node
npx serve .
```

Then open `http://localhost:8000`.

## How it works

1. **Segmentation** — splits pasted text into individual references, handling numbered lists, bracket markers, and blank-line-separated formats. Hyphenated line-breaks from PDF copy-pastes are rejoined automatically.
2. **Style detection** — identifies the referencing style in use (APA, Vancouver, IEEE, MLA, Chicago, Harvard) and displays it as a badge.
3. **Feature extraction** — detects DOIs, ISBNs, publication years, volume/page numbers, and quoted title fragments. Journal abbreviations (e.g. *N Engl J Med*, *J Biol Chem*) are expanded before querying to improve recall.
4. **Verification** — each reference is checked against multiple sources:

   | Source | Used for |
   |--------|----------|
   | **CrossRef** (DOI lookup) | Definitive confirmation when a DOI is present |
   | **doi.org** (content negotiation) | Retrieves structured metadata for DOIs not in CrossRef's API (old conference papers, regional publishers) |
   | **CrossRef** (bibliographic text search) | Matches full reference strings against CrossRef's 140M+ record index |
   | **Europe PMC** | Covers PubMed/MEDLINE plus many additional life-science sources |
   | **Semantic Scholar** | Broad coverage of STEM and computer science literature |
   | **arXiv** | Physics, maths, and CS preprints that often lack DOIs |
   | **Google Books** | Fallback for book-like citations (optional) |
   | **Open Library** | Additional book coverage, runs in parallel with Google Books (optional) |

   CrossRef text search and Europe PMC run in parallel for speed. Book sources are only queried when no article match is found and the "Include books" option is enabled. CrossRef requests use the polite pool for better rate limits.

   When a DOI resolves, the title returned by the database is cross-checked against the reference text. A DOI that resolves to a *different* paper (a recycled or fabricated DOI) is penalised rather than accepted.

5. **Scoring** — a 0–100 score is computed from the evidence:

   | Evidence | Points |
   |----------|--------|
   | DOI verified in CrossRef or doi.org, title matches | +75 |
   | DOI verified, but title does not match database record | +75 − 45 = **+30** |
   | DOI resolves via redirect only (title unverifiable) | +60 |
   | ISBN verified in Open Library | +70 |
   | Found via CrossRef text search | +75 |
   | Found in Europe PMC | +45 |
   | Found in Semantic Scholar | +40 |
   | Found in arXiv | +30 |
   | Found in Google Books / Open Library | +35 |
   | Author name confirmed in matched record | (positive signal) |
   | Author name not found in matched record | −10 |
   | Volume/page numbers confirmed in CrossRef | +5 |
   | No match anywhere | −50 |

   **Valid** ≥ 70 · **Needs Review** < 70

6. **Results** — displayed in two scrollable columns (Valid / Needs Review). Cards appear as each reference is processed. Each card shows the evidence reasons, a "Verify source" link, and an expandable dropdown with the formatted citation from the matched database record. Cards can be manually reclassified with the override button.

## Options

| Option | Default | Effect |
|--------|---------|--------|
| Search Google Books & Open Library | On | Queries book databases as a fallback when no article match is found |
| Strict matching | Off | Subtracts 15 points if the extracted title does not match the result |
| Fuzzy title matching | Off | Uses edit-distance comparison to tolerate OCR errors, diacritics, and minor typos (slower) |

## Example sets

Three ready-made reference lists are included in `examples/` and can be loaded directly from the interface:

| File | Contents |
|------|----------|
| `All_Fake.txt` | Nonsensical references with invented authors, journals, and DOIs |
| `All_Fake_BME.txt` | Plausible-looking biomedical engineering references with real-looking but incorrect DOIs |
| `All_Real_BME.txt` | Genuine published biomedical engineering references |

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Design |
| `app.js` | Main controller — orchestrates verification and scoring |
| `parser.js` | Reference splitting, feature extraction, style detection, and query building |
| `verifier.js` | API calls to all sources |
| `scorer.js` | Scoring and classification logic |
| `ui.js` | DOM rendering |
| `config.js` | API endpoints and score thresholds |
| `examples/` | Sample reference lists for testing |

## Limitations

- **Coverage gaps** — very old papers (pre-1990), papers from niche regional journals, and some conference proceedings may not appear in any indexed database and will score low even if real.
- **Probabilistic** — a high score confirms the reference *exists* in a database; it does not verify that the cited claim is correctly attributed to that paper.
- **Low score ≠ fabricated** — a low score means the reference could not be verified automatically. Always manually check flagged references before drawing conclusions.
- **Non-English references** — may match poorly due to transliteration and abbreviation differences.

## TODO

- **CORE API** — indexes millions of open-access papers, useful for preprints and grey literature
- **Retry / fallback logic** — silently retry failed API calls with exponential backoff before marking a reference unverified
- **Better title extraction** — use a trained NER or heuristic model to isolate the title field more reliably across all citation styles, especially for Vancouver and IEEE where titles are not quoted
