import { SCORE } from './config.js';

/**
 * Compute a 0-100 score and classification for one reference.
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

  if (results.crossRefTextMatch) {
    score += SCORE.CROSSREF_TEXT_MATCH;
    const title = results.crossRefTextMatch.title?.[0];
    reasons.push({
      kind: 'positive',
      text: title ? `Found in CrossRef: "${truncate(title, 120)}"` : 'Found in CrossRef'
    });
  }

  if (results.europePMCMatch) {
    score += SCORE.EUROPE_PMC_MATCH;
    const title = results.europePMCMatch.title;
    reasons.push({
      kind: 'positive',
      text: title ? `Found in Europe PMC: "${truncate(title, 120)}"` : 'Found in Europe PMC'
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
    reasons.push({ kind: 'negative', text: 'No matches in CrossRef, Europe PMC, or Google Books' });
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
