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
3. **Verification** — each reference is checked against multiple sources in order of precision:

   | Source | Used for |
   |--------|----------|
   | **CrossRef** (DOI lookup) | Definitive confirmation when a DOI is present |
   | **Semantic Scholar** | Broad academic coverage across all disciplines |
   | **PubMed** | Authoritative for biomedical and life-science journals |
   | **OpenAlex** | Fallback for papers not found by the above |
   | **Google Books** | Fallback for book-like citations (optional) |

4. **Scoring** — a 0–100 score is computed from the evidence:

   | Evidence | Points |
   |----------|--------|
   | DOI verified in CrossRef | +75 |
   | Found in Semantic Scholar | +50 |
   | Found in PubMed | +45 |
   | Found in OpenAlex | +35 |
   | Found in Google Books | +35 |
   | No match anywhere | −50 |

   **Valid** ≥ 70 · **Needs review** 30–69 · **Likely fabricated** < 30

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
