# reference-validator

A client-side tool for checking the authenticity of academic citations. Paste a reference list and each entry is verified against multiple academic databases. Returns a 0–100 legitimacy score with transparent, per-reason explanations and colour-coded classifications. Pure HTML/CSS/JS — no frameworks, no server, no API keys required.

## Live demo

`https://dthornz.github.io/reference-validator/`

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
2. **Feature extraction** — detects DOIs, ISBNs, publication years, and quoted title fragments.
3. **Verification** — each reference is checked against multiple sources:

   | Source | Used for |
   |--------|----------|
   | **CrossRef** (DOI lookup) | Definitive confirmation when a DOI is present |
   | **CrossRef** (bibliographic text search) | Matches full reference strings against CrossRef's 140M+ record index |
   | **Europe PMC** | Covers PubMed/MEDLINE plus many additional life-science sources |
   | **Google Books** | Fallback for book-like citations (optional) |

   CrossRef text search and Europe PMC run in parallel for speed. CrossRef requests use the polite pool for better rate limits.

4. **Scoring** — a 0–100 score is computed from the evidence:

   | Evidence | Points |
   |----------|--------|
   | DOI verified in CrossRef | +75 |
   | Found via CrossRef text search | +50 |
   | Found in Europe PMC | +45 |
   | Found in Google Books | +35 |
   | No match anywhere | −50 |

   **Valid** ≥ 70 · **Needs review** 25–69 · **Likely fabricated** < 25

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Design |
| `app.js` | Main controller — orchestrates verification and scoring |
| `parser.js` | Reference splitting, feature extraction, and query building |
| `verifier.js` | API calls to all five sources |
| `scorer.js` | Scoring and classification logic |
| `ui.js` | DOM rendering |
| `config.js` | API endpoints and score thresholds |

## Limitations

- **Coverage gaps** — very old papers (pre-1990), papers from niche regional journals, and conference proceedings may not appear in any indexed database, and will score low even if real.
- **Probabilistic** — a high score confirms the reference *exists* in a database; it does not verify that the cited claim is correctly attributed to that paper.
- **Low score ≠ fabricated** — a low score means the reference could not be verified automatically. Always manually check flagged references before drawing conclusions.
- **Non-English references** — may match poorly due to transliteration and abbreviation differences.
