import { splitReferences, extractFeatures, buildQuery, buildCoreQuery } from './parser.js';
import { verifyDOI, searchCrossRefText, searchPubMed, searchBooks } from './verifier.js';
import { scoreReference } from './scorer.js';
import { renderResults, setStatus, clearStatus } from './ui.js';
import { CONCURRENCY_LIMIT } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearBtn   = document.getElementById('clearBtn');
  const inputText  = document.getElementById('inputText');
  const useBooks   = document.getElementById('useBooks');
  const strictMode = document.getElementById('strictMode');
  const resultsEl  = document.getElementById('results');

  analyzeBtn.addEventListener('click', async () => {
    const text = inputText.value.trim();
    if (!text) {
      setStatus('Please paste at least one reference.');
      return;
    }

    const refs = splitReferences(text);
    if (refs.length === 0) {
      setStatus('No recognizable references found.');
      resultsEl.innerHTML = '';
      return;
    }

    analyzeBtn.disabled = true;
    resultsEl.innerHTML = '';

    const results = [];
    let completed = 0;

    setStatus(`Analyzing 0 / ${refs.length}…`, true);

    for (let i = 0; i < refs.length; i += CONCURRENCY_LIMIT) {
      const batch = refs.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map(async (ref) => {
          const features = extractFeatures(ref);
          const coreQuery = buildCoreQuery(ref, features);
          const booksQuery = buildQuery(ref);

          let doiVerified = false;
          let crossRefTextMatch = null;
          let pubmedMatch = null;
          let bookMatch = null;

          if (features.doi) {
            const doiRes = await verifyDOI(features.doi);
            doiVerified = doiRes.ok;
          }

          if (!doiVerified) {
            // CrossRef bibliographic search and PubMed run in parallel.
            const [crHit, pubHit] = await Promise.all([
              searchCrossRefText(coreQuery),
              searchPubMed(coreQuery)
            ]);

            if (crHit && isBasicMatch(ref, crHit.title?.[0])) crossRefTextMatch = crHit;
            if (pubHit && isBasicMatch(ref, pubHit.title))    pubmedMatch = pubHit;

            // Google Books as last resort for book-like citations.
            if (!crossRefTextMatch && !pubmedMatch && useBooks.checked) {
              const hit = await searchBooks(booksQuery);
              const title = hit?.volumeInfo?.title;
              if (hit && isBasicMatch(ref, title)) bookMatch = hit;
            }
          }

          const titleConfirmed = checkTitleMatch(features, crossRefTextMatch, pubmedMatch, bookMatch);

          const scored = scoreReference(features, {
            doiVerified,
            crossRefTextMatch,
            pubmedMatch,
            bookMatch,
            anyMatch: Boolean(doiVerified || crossRefTextMatch || pubmedMatch || bookMatch),
            titleConfirmed
          }, { strict: strictMode.checked });

          completed += 1;
          setStatus(`Analyzing ${completed} / ${refs.length}…`, true);

          return { ...scored, raw: ref };
        })
      );
      results.push(...batchResults);
    }

    renderResults(results);
    clearStatus();
    analyzeBtn.disabled = false;
  });

  clearBtn.addEventListener('click', () => {
    inputText.value = '';
    resultsEl.innerHTML = '';
    clearStatus();
  });
});

/**
 * Require at least one meaningful word shared between the reference text and
 * the result title. Used for CrossRef text search and PubMed, which are precise
 * enough that one shared word is sufficient to confirm relevance.
 */
function isBasicMatch(refText, resultTitle) {
  if (!resultTitle) return false;
  const STOPWORDS = new Set([
    'about', 'after', 'also', 'based', 'been', 'from', 'have', 'into',
    'model', 'paper', 'study', 'that', 'their', 'there', 'these', 'this',
    'through', 'using', 'which', 'with'
  ]);
  const words = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 4 && !STOPWORDS.has(w));
  const refSet = new Set(words(refText));
  return words(resultTitle).some(w => refSet.has(w));
}

/**
 * Loose substring match between extracted title (if any) and a result's title.
 * Used only in strict mode.
 */
function checkTitleMatch(features, crossRefTextMatch, pubmedMatch, bookMatch) {
  if (!features.title) return false;
  const target = features.title.toLowerCase();
  const candidates = [
    crossRefTextMatch?.title?.[0],
    pubmedMatch?.title,
    bookMatch?.volumeInfo?.title
  ].filter(Boolean).map(s => s.toLowerCase());
  return candidates.some(t => t.includes(target) || target.includes(t));
}
