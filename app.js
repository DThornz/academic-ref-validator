import { splitReferences, extractFeatures, buildQuery, buildCoreQuery } from './parser.js';
import { verifyDOI, searchSemanticScholar, searchPubMed, searchOpenAlex, searchBooks } from './verifier.js';
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
          let semanticScholarMatch = null;
          let pubmedMatch = null;
          let openAlexMatch = null;
          let bookMatch = null;

          if (features.doi) {
            const doiRes = await verifyDOI(features.doi);
            doiVerified = doiRes.ok;
          }

          if (!doiVerified) {
            const coreQuery = buildCoreQuery(ref, features);

            // Semantic Scholar and PubMed run in parallel — both use the cleaned query.
            const [ssResults, pubmedHit] = await Promise.all([
              searchSemanticScholar(coreQuery),
              searchPubMed(coreQuery)
            ]);

            // Semantic Scholar: pick first of up to 3 candidates that shares a word.
            const ssHit = ssResults.find(r => isBasicMatch(ref, r.title));
            if (ssHit) semanticScholarMatch = ssHit;

            if (pubmedHit && isBasicMatch(ref, pubmedHit.title)) pubmedMatch = pubmedHit;

            // OpenAlex as fallback — stricter relevance check because it tends to
            // return topically related but wrong papers.
            if (!semanticScholarMatch && !pubmedMatch) {
              const hit = await searchOpenAlex(query);
              const title = hit?.title || hit?.display_name;
              if (hit && isRelevantMatch(ref, title)) openAlexMatch = hit;
            }

            // Google Books as last resort for book-like citations.
            if (!semanticScholarMatch && !pubmedMatch && !openAlexMatch && useBooks.checked) {
              const hit = await searchBooks(query);
              const title = hit?.volumeInfo?.title;
              if (hit && isRelevantMatch(ref, title)) bookMatch = hit;
            }
          }

          const titleConfirmed = checkTitleMatch(features, semanticScholarMatch, openAlexMatch, bookMatch);

          const scored = scoreReference(features, {
            doiVerified,
            semanticScholarMatch,
            pubmedMatch,
            openAlexMatch,
            bookMatch,
            anyMatch: Boolean(doiVerified || semanticScholarMatch || pubmedMatch || openAlexMatch || bookMatch),
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
 * Light relevance check for trusted APIs (Semantic Scholar, PubMed).
 * Requires at least one meaningful word shared between the reference and the result title.
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
 * Stricter relevance check for OpenAlex / Google Books, which tend to return
 * topically related but wrong papers. Requires ≥2 shared words AND ≥25% of
 * the result title covered — the percentage check prevents domain-general
 * papers that share only field-level keywords from passing.
 */
function isRelevantMatch(refText, resultTitle) {
  if (!resultTitle) return false;
  const STOPWORDS = new Set([
    'about', 'after', 'also', 'based', 'been', 'from', 'have', 'into',
    'model', 'method', 'methods', 'novel', 'paper', 'study', 'that',
    'their', 'there', 'these', 'this', 'through', 'using', 'which', 'with'
  ]);
  const words = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 4 && !STOPWORDS.has(w));
  const refSet = new Set(words(refText));
  const titleWords = words(resultTitle);
  if (titleWords.length === 0) return false;
  const shared = titleWords.filter(w => refSet.has(w));
  return shared.length >= 2 && shared.length / titleWords.length >= 0.25;
}

/**
 * Loose substring match between extracted title (if any) and a result's title.
 */
function checkTitleMatch(features, semanticScholarMatch, openAlexMatch, bookMatch) {
  if (!features.title) return false;
  const target = features.title.toLowerCase();
  const candidates = [
    semanticScholarMatch?.title,
    openAlexMatch?.title,
    openAlexMatch?.display_name,
    bookMatch?.volumeInfo?.title
  ].filter(Boolean).map(s => s.toLowerCase());
  return candidates.some(t => t.includes(target) || target.includes(t));
}
