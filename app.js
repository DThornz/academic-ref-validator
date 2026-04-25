import { splitReferences, extractFeatures, buildQuery } from './parser.js';
import { verifyDOI, searchOpenAlex, searchBooks } from './verifier.js';
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
          const query = buildQuery(ref);

          let doiVerified = false;
          let openAlexMatch = null;
          let bookMatch = null;

          if (features.doi) {
            const doiRes = await verifyDOI(features.doi);
            doiVerified = doiRes.ok;
          }

          if (!doiVerified) {
            openAlexMatch = await searchOpenAlex(query);
          }

          if (!doiVerified && !openAlexMatch && useBooks.checked) {
            bookMatch = await searchBooks(query);
          }

          const titleConfirmed = checkTitleMatch(features, openAlexMatch, bookMatch);

          const scored = scoreReference(features, {
            doiVerified,
            openAlexMatch,
            bookMatch,
            anyMatch: Boolean(doiVerified || openAlexMatch || bookMatch),
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
 * Loose substring match between extracted title (if any) and a result's title.
 */
function checkTitleMatch(features, openAlexMatch, bookMatch) {
  if (!features.title) return false;
  const target = features.title.toLowerCase();
  const candidates = [
    openAlexMatch?.title,
    openAlexMatch?.display_name,
    bookMatch?.volumeInfo?.title
  ].filter(Boolean).map(s => s.toLowerCase());
  return candidates.some(t => t.includes(target) || target.includes(t));
}
