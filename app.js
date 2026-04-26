import { splitReferences, extractFeatures, buildQuery, buildCrossRefQuery, extractBestSentence, detectStyle } from './parser.js';
import { verifyDOI, searchCrossRefText, searchEuropePMC, searchBooks, searchOpenLibrary } from './verifier.js';
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

    const detectedStyle = detectStyle(refs);
    const results = [];
    let completed = 0;

    setStatus(`Analyzing 0 / ${refs.length}…`, true);

    for (let i = 0; i < refs.length; i += CONCURRENCY_LIMIT) {
      const batch = refs.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map(async (ref) => {
          const features    = extractFeatures(ref);
          const crBaseQuery = buildCrossRefQuery(ref);
          const booksQuery  = buildQuery(ref);

          let doiVerified      = false;
          let crossRefTextMatch = null;
          let europePMCMatch   = null;
          let bookMatch        = null;

          if (features.doi) {
            const doiRes = await verifyDOI(features.doi);
            doiVerified = doiRes.ok;
          }

          if (!doiVerified) {
            // CrossRef text search and Europe PMC run in parallel.
            // If a DOI was detected but lookup failed (transient error), also try
            // CrossRef text search with the DOI itself as a fallback query.
            // CrossRef gets the lightly-processed full reference string.
            const crQuery = features.doi
              ? `${crBaseQuery} ${features.doi}`
              : crBaseQuery;

            // Europe PMC requires every word to match (AND logic). Build a
            // title-focused query from the best sentence fragment, then strip
            // short tokens (author initials, abbreviations like "ATS", "Van").
            const titleSentence = extractBestSentence(ref);
            const epmcBase = titleSentence
              .replace(/[™®©℠]/g, '')
              .replace(/https?:\/\/\S+/g, ' ')
              .replace(/\bdoi:\s*\S+/gi, ' ')
              .replace(/[,;&.]/g, ' ')
              .replace(/\s+/g, ' ').trim();
            const epmcQuery = (features.year ? `${epmcBase} ${features.year}` : epmcBase)
              .replace(/\b[A-Za-z]{1,3}\b/g, ' ')
              .replace(/\s+/g, ' ').trim();

            const [crHit, epmcHit] = await Promise.all([
              searchCrossRefText(crQuery),
              searchEuropePMC(epmcQuery)
            ]);

            if (crHit   && isCrossRefMatch(ref, features.year, crHit)) crossRefTextMatch = crHit;
            if (epmcHit && isBasicMatch(ref, epmcHit.title))          europePMCMatch    = epmcHit;

            // Book sources as last resort for book-like citations.
            if (!crossRefTextMatch && !europePMCMatch && useBooks.checked) {
              const [gbHit, olHit] = await Promise.all([
                searchBooks(booksQuery),
                searchOpenLibrary(booksQuery)
              ]);
              const gbTitle = gbHit?.volumeInfo?.title;
              if (gbHit && isBasicMatch(ref, gbTitle)) {
                bookMatch = gbHit;
              } else if (olHit && isBasicMatch(ref, olHit.title)) {
                bookMatch = { _openLibrary: olHit, volumeInfo: { title: olHit.title, infoLink: olHit.url } };
              }
            }
          }

          const titleConfirmed = checkTitleMatch(features, crossRefTextMatch, europePMCMatch, bookMatch);

          // Best URL to let the user verify the matched source.
          let matchUrl = null;
          if (doiVerified) {
            matchUrl = `https://doi.org/${features.doi}`;
          } else if (crossRefTextMatch?.DOI) {
            matchUrl = `https://doi.org/${crossRefTextMatch.DOI}`;
          } else if (europePMCMatch?.pmid) {
            matchUrl = `https://pubmed.ncbi.nlm.nih.gov/${europePMCMatch.pmid}/`;
          } else if (europePMCMatch?.doi) {
            matchUrl = `https://doi.org/${europePMCMatch.doi}`;
          } else if (bookMatch?.volumeInfo?.infoLink) {
            matchUrl = bookMatch.volumeInfo.infoLink;
          }

          const scored = scoreReference(features, {
            doiVerified,
            crossRefTextMatch,
            europePMCMatch,
            bookMatch,
            anyMatch: Boolean(doiVerified || crossRefTextMatch || europePMCMatch || bookMatch),
            titleConfirmed
          }, { strict: strictMode.checked });

          completed += 1;
          setStatus(`Analyzing ${completed} / ${refs.length}…`, true);

          return { ...scored, raw: ref, matchUrl };
        })
      );
      results.push(...batchResults);
    }

    renderResults(results, detectedStyle);
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
 * Strict match for CrossRef text search results.
 * Requires ≥75% of the CrossRef title's meaningful words to appear in the
 * reference text (near-full title coverage), plus year within 5 years.
 */
function isCrossRefMatch(refText, refYear, crHit) {
  const title = crHit?.title?.[0];
  if (!title) return false;
  const STOPWORDS = new Set([
    'about', 'after', 'also', 'based', 'been', 'from', 'have', 'into',
    'model', 'paper', 'study', 'that', 'their', 'there', 'these', 'this',
    'through', 'using', 'which', 'with'
  ]);
  const tokenize = s => [...new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
     .filter(w => w.length > 3 && !STOPWORDS.has(w))
  )];
  const normRef = refText.replace(/(\w)-\s*\n\s*(\w)/g, '$1-$2').replace(/(\w)- ([a-z]\w{2,})/g, '$1$2');
  const refSet = new Set(tokenize(normRef));
  const titleTokens = tokenize(title);
  if (titleTokens.length === 0) return false;
  const matched = titleTokens.filter(w => refSet.has(w));
  if (matched.length / titleTokens.length < 0.85) return false;
  const currentYear = new Date().getFullYear();
  if (refYear && refYear >= 1900) {
    const crYear = crHit?.published?.['date-parts']?.[0]?.[0]
                || crHit?.['published-print']?.['date-parts']?.[0]?.[0]
                || crHit?.['published-online']?.['date-parts']?.[0]?.[0];
    if (crYear && Math.abs(refYear - crYear) > 5) return false;
  }
  return true;
}

/**
 * Require at least one meaningful word shared between the reference text and
 * the result title. Used for Europe PMC.
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
  const normRef = refText.replace(/(\w)-\s*\n\s*(\w)/g, '$1-$2').replace(/(\w)- ([a-z]\w{2,})/g, '$1$2');
  const refSet = new Set(words(normRef));
  return words(resultTitle).some(w => refSet.has(w));
}

/**
 * Loose substring match between extracted title (if any) and a result's title.
 * Used only in strict mode.
 */
function checkTitleMatch(features, crossRefTextMatch, europePMCMatch, bookMatch) {
  if (!features.title) return false;
  const target = features.title.toLowerCase();
  const candidates = [
    crossRefTextMatch?.title?.[0],
    europePMCMatch?.title,
    bookMatch?.volumeInfo?.title
  ].filter(Boolean).map(s => s.toLowerCase());
  return candidates.some(t => t.includes(target) || target.includes(t));
}
