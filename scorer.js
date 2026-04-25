import { SCORE } from './config.js';

/**
 * Compute a 0-100 score and classification for one reference.
 * results: { doiVerified, openAlexMatch, bookMatch, anyMatch, titleConfirmed }
 */
export function scoreReference(features, results, options = {}) {
  let score = 0;
  const reasons = [];

  if (results.doiVerified) {
    score += SCORE.DOI_VERIFIED;
    reasons.push({ kind: 'positive', text: 'DOI verified in CrossRef' });
  } else if (features.doi) {
    reasons.push({ kind: 'negative', text: `DOI ${features.doi} not found in CrossRef` });
  }

  if (results.semanticScholarMatch) {
    score += SCORE.SEMANTIC_SCHOLAR_MATCH;
    const title = results.semanticScholarMatch.title;
    reasons.push({
      kind: 'positive',
      text: title ? `Found in Semantic Scholar: "${truncate(title, 120)}"` : 'Found in Semantic Scholar'
    });
  }

  if (results.pubmedMatch) {
    score += SCORE.PUBMED_MATCH;
    const title = results.pubmedMatch.title;
    reasons.push({
      kind: 'positive',
      text: title ? `Found in PubMed: "${truncate(title, 120)}"` : 'Found in PubMed'
    });
  }

  if (results.openAlexMatch) {
    score += SCORE.OPENALEX_MATCH;
    const title = results.openAlexMatch.title || results.openAlexMatch.display_name;
    reasons.push({
      kind: 'positive',
      text: title ? `Found in OpenAlex: "${truncate(title, 120)}"` : 'Found in OpenAlex'
    });
  }

  if (results.bookMatch) {
    score += SCORE.BOOK_MATCH;
    const title = results.bookMatch.volumeInfo?.title;
    reasons.push({
      kind: 'positive',
      text: title ? `Found in Google Books: "${truncate(title, 120)}"` : 'Found in Google Books'
    });
  }

  if (!results.anyMatch) {
    score += SCORE.NO_MATCH_PENALTY;
    reasons.push({ kind: 'negative', text: 'No matches in CrossRef, Semantic Scholar, PubMed, OpenAlex, or Google Books' });
  }

  if (features.year) {
    const currentYear = new Date().getFullYear();
    if (features.year > currentYear + 2) {
      score -= 10;
      reasons.push({ kind: 'negative', text: `Year ${features.year} is in the far future` });
    } else if (features.year < 1700) {
      score -= 5;
      reasons.push({ kind: 'negative', text: `Year ${features.year} looks implausible` });
    }
  } else {
    reasons.push({ kind: 'neutral', text: 'No publication year detected' });
  }

  if (options.strict && results.anyMatch && !results.titleConfirmed && features.title) {
    score -= 15;
    reasons.push({ kind: 'negative', text: 'Strict mode: extracted title did not match the result' });
  }

  const finalScore = Math.max(0, Math.min(100, score));

  let label = 'invalid';
  if (finalScore >= SCORE.VALID_THRESHOLD) label = 'valid';
  else if (finalScore >= SCORE.WARNING_THRESHOLD) label = 'warning';

  return { score: finalScore, label, reasons };
}

function truncate(str, n) {
  if (typeof str !== 'string') return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}
