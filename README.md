# reference-validator

A client-side tool that flags potentially fake citations. Paste a reference list, and each entry is cross-checked against CrossRef, OpenAlex, and Google Books APIs. Returns a legitimacy score with transparent reasons. Pure HTML/CSS/JS. No frameworks, no server.

## Live demo

The web app is available at:

`https://dthornz.github.io/reference-validator/`

## Run locally

Because the app uses ES modules, it must be served over HTTP (not opened via `file://`).

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx serve .
```

Then open `http://localhost:8000`.

## How it works

1. **Segmentation** — splits pasted text into individual references.
2. **Feature extraction** — pulls out DOI, year, ISBN, and a title-like fragment.
3. **Verification** — for each reference:
   - If a DOI is present, checks CrossRef.
   - Otherwise searches OpenAlex.
   - Optionally falls back to Google Books for book-like citations.
4. **Scoring** — produces a 0–100 score and a label (valid / warning / invalid) with human-readable reasons.

## Files

- `index.html` — page structure.
- `styles.css` — design.
- `app.js` — main controller.
- `parser.js` — reference splitting and feature extraction.
- `verifier.js` — API calls.
- `scorer.js` — scoring + classification.
- `ui.js` — DOM rendering.
- `config.js` — endpoints and thresholds.

## Limitations

All checks are probabilistic. Non-English references, very old citations, and unusual formats may match poorly. Results should be interpreted with care.
