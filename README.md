# reference-validator

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

1. **Segmentation** — splits pasted text into individual references, handling numbered lists, bracket markers, and blank-line-separated formats.
2. **Style detection** — identifies the referencing style in use (APA, Vancouver, IEEE, MLA, Chicago, Harvard) and displays it as a badge.
3. **Feature extraction** — detects DOIs, ISBNs, publication years, and quoted title fragments.
4. **Verification** — each reference is checked against multiple sources:

   | Source | Used for |
   |--------|----------|
   | **CrossRef** (DOI lookup) | Definitive confirmation when a DOI is present |
   | **CrossRef** (bibliographic text search) | Matches full reference strings against CrossRef's 140M+ record index |
   | **Europe PMC** | Covers PubMed/MEDLINE plus many additional life-science sources |
   | **Google Books** | Fallback for book-like citations (optional) |
   | **Open Library** | Additional book coverage, runs in parallel with Google Books (optional) |

   CrossRef text search and Europe PMC run in parallel for speed. Book sources are only queried when no article match is found and the "Include books" option is enabled. CrossRef requests use the polite pool for better rate limits.

5. **Scoring** — a 0–100 score is computed from the evidence:

   | Evidence | Points |
   |----------|--------|
   | DOI verified in CrossRef | +75 |
   | Found via CrossRef text search | +75 |
   | Found in Europe PMC | +45 |
   | Found in Google Books / Open Library | +35 |
   | No match anywhere | −50 |

   **Valid** ≥ 70 · **Needs review** < 70

6. **Results** — displayed in two scrollable columns (Valid / Needs Review). Matched references include a "Verify source" link so you can inspect the matched record directly.

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

## Limitations

- **Coverage gaps** — very old papers (pre-1990), papers from niche regional journals, and conference proceedings may not appear in any indexed database, and will score low even if real.
- **Probabilistic** — a high score confirms the reference *exists* in a database; it does not verify that the cited claim is correctly attributed to that paper.
- **Low score ≠ fabricated** — a low score means the reference could not be verified automatically. Always manually check flagged references before drawing conclusions.
- **Non-English references** — may match poorly due to transliteration and abbreviation differences.

## TODO

Suggested areas for future improvement:

### Verification
- **Semantic Scholar** — broad coverage of computer science and STEM papers, good complement to CrossRef and Europe PMC
- **CORE API** — indexes millions of open-access papers, useful for preprints and grey literature
- **arXiv search** — direct lookup for physics, maths, and CS preprints which often lack DOIs
- **ISBN verification** — dedicated lookup via Open Library or ISBNdb to properly validate book citations by ISBN rather than title search
- **Retry / fallback logic** — silently retry failed API calls with exponential backoff before marking a reference unverified

### Matching quality
- **Fuzzy title matching** — replace exact token overlap with edit-distance or n-gram similarity to handle OCR errors, diacritics, and subtle transcription differences
- **Author cross-check** — verify that the last name of at least one author in the reference appears in the matched record, to reduce false positives
- **Journal name normalisation** — map abbreviated journal names (e.g. *J. Heart Valve Dis.*) to their full forms before querying, improving recall for niche journals
- **Volume / page cross-check** — when a match is found, confirm that the volume or page numbers align with what CrossRef returns

### Parsing
- **Better title extraction** — use a trained NER or heuristic model to isolate the title field more reliably across all citation styles, especially for Vancouver and IEEE where titles are not quoted
- **Multi-line reference handling** — improve segmentation for copy-pasted PDFs where a single reference spans many lines with inconsistent indentation
- **DOI resolution follow redirects** — some DOIs redirect to publisher pages; follow the chain to confirm the paper exists even if CrossRef's record is incomplete

### UX
- **Export results** — download a CSV or annotated PDF of the validation results
- **Per-reference manual override** — let the user mark a flagged reference as verified or dismiss a false positive
- **Batch progress with cancellation** — show a per-reference progress indicator and allow cancelling a long-running analysis mid-way
- **Dark mode** — respect `prefers-color-scheme: dark`
- **Keyboard shortcuts** — submit on Ctrl+Enter, clear on Escape
