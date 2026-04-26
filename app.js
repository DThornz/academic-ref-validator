import { splitReferences, extractFeatures, buildQuery, buildCrossRefQuery, extractBestSentence, detectStyle } from './parser.js';
import { verifyDOI, verifyISBN, searchCrossRefText, searchEuropePMC, searchSemanticScholar, searchArXiv, searchBooks, searchOpenLibrary } from './verifier.js';
import { scoreReference } from './scorer.js';
import { initResults, addResult, finalizeResults, setStatus, clearStatus, exportCSV, exportPDF } from './ui.js';
import { CONCURRENCY_LIMIT } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn   = document.getElementById('analyzeBtn');
  const cancelBtn    = document.getElementById('cancelBtn');
  const clearBtn     = document.getElementById('clearBtn');
  const exportBtn    = document.getElementById('exportBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const inputText    = document.getElementById('inputText');
  const useBooks     = document.getElementById('useBooks');
  const strictMode   = document.getElementById('strictMode');
  const resultsEl    = document.getElementById('results');
  const progressBar  = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');

  let controller        = null;
  let lastResults       = [];
  let lastDetectedStyle = null;

  exportBtn.addEventListener('click',    () => exportCSV(lastResults));
  exportPdfBtn.addEventListener('click', () => exportPDF(lastResults, lastDetectedStyle));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') clearBtn.click();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !analyzeBtn.disabled) analyzeBtn.click();
  });

  cancelBtn.addEventListener('click', () => {
    if (controller) controller.abort();
  });

  analyzeBtn.addEventListener('click', async () => {
    const text = inputText.value.trim();
    if (!text) { setStatus('Please paste at least one reference.'); return; }

    const refs = splitReferences(text);
    if (refs.length === 0) {
      setStatus('No recognizable references found.');
      resultsEl.innerHTML = '';
      return;
    }

    controller = new AbortController();
    const { signal } = controller;

    analyzeBtn.disabled = true;
    exportBtn.disabled  = true;
    exportPdfBtn.disabled = true;
    cancelBtn.hidden    = false;
    progressBar.hidden  = false;
    progressFill.style.width = '0%';

    const detectedStyle = detectStyle(refs);

    // Pre-allocate by index so export order matches input order regardless of
    // which promises resolve first within a batch.
    const results = new Array(refs.length);
    let completed = 0;

    setStatus(`Analyzing 0 / ${refs.length}…`, true);
    initResults(refs.length, detectedStyle);

    for (let i = 0; i < refs.length; i += CONCURRENCY_LIMIT) {
      if (signal.aborted) break;

      const batch = refs.slice(i, i + CONCURRENCY_LIMIT);

      await Promise.all(
        batch.map(async (ref, batchIdx) => {
          const origIdx = i + batchIdx;

          const features    = extractFeatures(ref);
          const crBaseQuery = buildCrossRefQuery(ref);
          const booksQuery  = buildQuery(ref);

          let doiVerified      = false;
          let doiViaRedirect   = false;
          let isbnVerified     = false;
          let crossRefTextMatch = null;
          let europePMCMatch   = null;
          let ssMatch          = null;
          let arxivMatch       = null;
          let bookMatch        = null;

          const [doiRes, isbnOk] = await Promise.all([
            features.doi  ? verifyDOI(features.doi, signal)   : Promise.resolve({ ok: false }),
            features.isbn ? verifyISBN(features.isbn, signal) : Promise.resolve(false)
          ]);
          doiVerified    = doiRes.ok;
          doiViaRedirect = doiRes.viaRedirect || false;
          isbnVerified   = isbnOk;

          if (!doiVerified) {
            const crQuery = features.doi
              ? `${crBaseQuery} ${features.doi}`
              : crBaseQuery;

            const titleSentence = extractBestSentence(ref);
            const titleBase = titleSentence
              .replace(/[™®©℠]/g, '')
              .replace(/https?:\/\/\S+/g, ' ')
              .replace(/\bdoi:\s*\S+/gi, ' ')
              .replace(/[,;&.]/g, ' ')
              .replace(/\s+/g, ' ').trim();
            const titleQuery = (features.year ? `${titleBase} ${features.year}` : titleBase)
              .replace(/\b[A-Za-z]{1,3}\b/g, ' ')
              .replace(/\s+/g, ' ').trim();

            const [crHit, epmcHit, ssHit, arxivHit] = await Promise.all([
              searchCrossRefText(crQuery, signal),
              searchEuropePMC(titleQuery, signal),
              searchSemanticScholar(crQuery, signal),
              searchArXiv(titleQuery, signal)
            ]);

            if (crHit    && isCrossRefMatch(ref, features.year, crHit)) crossRefTextMatch = crHit;
            if (epmcHit  && isBasicMatch(ref, epmcHit.title))           europePMCMatch    = epmcHit;
            if (ssHit    && isBasicMatch(ref, ssHit.title))             ssMatch           = ssHit;
            if (arxivHit && isBasicMatch(ref, arxivHit.title))          arxivMatch        = arxivHit;

            if (!crossRefTextMatch && !europePMCMatch && !ssMatch && !arxivMatch && useBooks.checked) {
              const [gbHit, olHit] = await Promise.all([
                searchBooks(booksQuery, signal),
                searchOpenLibrary(booksQuery, signal)
              ]);
              const gbTitle = gbHit?.volumeInfo?.title;
              if (gbHit && isBasicMatch(ref, gbTitle)) {
                bookMatch = gbHit;
              } else if (olHit && isBasicMatch(ref, olHit.title)) {
                bookMatch = { _openLibrary: olHit, volumeInfo: { title: olHit.title, infoLink: olHit.url } };
              }
            }
          }

          const titleConfirmed = checkTitleMatch(features, crossRefTextMatch, europePMCMatch, bookMatch, ssMatch, arxivMatch);

          let matchUrl = null;
          if (doiVerified) {
            matchUrl = `https://doi.org/${features.doi}`;
          } else if (isbnVerified && features.isbn) {
            matchUrl = `https://openlibrary.org/isbn/${features.isbn.replace(/[- ]/g, '')}`;
          } else if (crossRefTextMatch?.DOI) {
            matchUrl = `https://doi.org/${crossRefTextMatch.DOI}`;
          } else if (europePMCMatch?.pmid) {
            matchUrl = `https://pubmed.ncbi.nlm.nih.gov/${europePMCMatch.pmid}/`;
          } else if (europePMCMatch?.doi) {
            matchUrl = `https://doi.org/${europePMCMatch.doi}`;
          } else if (ssMatch?.paperId) {
            matchUrl = `https://www.semanticscholar.org/paper/${ssMatch.paperId}`;
          } else if (arxivMatch?.url) {
            matchUrl = arxivMatch.url;
          } else if (bookMatch?.volumeInfo?.infoLink) {
            matchUrl = bookMatch.volumeInfo.infoLink;
          }

          const scored = scoreReference(features, {
            doiVerified, doiViaRedirect, isbnVerified,
            crossRefTextMatch, europePMCMatch, ssMatch, arxivMatch, bookMatch,
            anyMatch: Boolean(doiVerified || isbnVerified || crossRefTextMatch || europePMCMatch || ssMatch || arxivMatch || bookMatch),
            titleConfirmed
          }, { strict: strictMode.checked });

          const result = {
            ...scored, raw: ref, matchUrl, origIdx,
            doiData: doiRes.data || null,
            crossRefTextMatch, europePMCMatch, ssMatch, arxivMatch, bookMatch
          };
          results[origIdx] = result;

          // Render this card immediately — don't wait for the batch to finish.
          addResult(result);

          completed++;
          setStatus(`Analyzing ${completed} / ${refs.length}…`, true);
          progressFill.style.width = `${(completed / refs.length) * 100}%`;
        })
      );
    }

    const wasCancelled    = signal.aborted;
    const completedResults = results.filter(Boolean);

    cancelBtn.hidden      = true;
    progressBar.hidden    = true;
    analyzeBtn.disabled   = false;
    controller            = null;

    if (completedResults.length > 0) {
      lastResults       = completedResults;
      lastDetectedStyle = detectedStyle;
      exportBtn.disabled    = false;
      exportPdfBtn.disabled = false;
    }

    finalizeResults(completedResults.length, refs.length, wasCancelled);

    if (wasCancelled) {
      setStatus(`Cancelled — ${completedResults.length} of ${refs.length} references analyzed.`);
    } else {
      clearStatus();
    }
  });

  clearBtn.addEventListener('click', () => {
    if (controller) controller.abort();
    inputText.value = '';
    resultsEl.innerHTML = '';
    exportBtn.disabled    = true;
    exportPdfBtn.disabled = true;
    lastResults       = [];
    lastDetectedStyle = null;
    clearStatus();
  });
});

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
  if (refYear && refYear >= 1900) {
    const crYear = crHit?.published?.['date-parts']?.[0]?.[0]
                || crHit?.['published-print']?.['date-parts']?.[0]?.[0]
                || crHit?.['published-online']?.['date-parts']?.[0]?.[0];
    if (crYear && Math.abs(refYear - crYear) > 5) return false;
  }
  return true;
}

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

function checkTitleMatch(features, crossRefTextMatch, europePMCMatch, bookMatch, ssMatch, arxivMatch) {
  if (!features.title) return false;
  const target = features.title.toLowerCase();
  const candidates = [
    crossRefTextMatch?.title?.[0],
    europePMCMatch?.title,
    bookMatch?.volumeInfo?.title,
    ssMatch?.title,
    arxivMatch?.title
  ].filter(Boolean).map(s => s.toLowerCase());
  return candidates.some(t => t.includes(target) || target.includes(t));
}
