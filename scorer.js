import { SCORE } from './config.js';

/**
 * Compute a 0-100 score and classification for one reference.
 */
export function scoreReference(features, results, options = {}) {
  let score = 0;
  const reasons = [];

  if (results.doiVerified) {
    score += SCORE.DOI_VERIFIED;
    reasons.push({ kind: 'positive', text: results.doiViaRedirect
      ? 'DOI resolves via publisher redirect (not in CrossRef)'
      : 'DOI verified in CrossRef' });
  } else if (features.doi) {
    reasons.push({ kind: 'negative', text: `DOI ${features.doi} not found in CrossRef or via redirect` });
  }

  if (results.isbnVerified) {
    score += SCORE.ISBN_VERIFIED;
    reasons.push({ kind: 'positive', text: 'ISBN verified in Open Library' });
  } else if (features.isbn) {
    reasons.push({ kind: 'negative', text: `ISBN ${features.isbn} not found in Open Library` });
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

  if (results.ssMatch) {
    score += SCORE.SEMANTIC_SCHOLAR_MATCH;
    const title = results.ssMatch.title;
    reasons.push({
      kind: 'positive',
      text: title ? `Found in Semantic Scholar: "${truncate(title, 120)}"` : 'Found in Semantic Scholar'
    });
  }

  if (results.arxivMatch) {
    score += SCORE.ARXIV_MATCH;
    const title = results.arxivMatch.title;
    reasons.push({
      kind: 'positive',
      text: title ? `Found in arXiv: "${truncate(title, 120)}"` : 'Found in arXiv'
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

  if (results.anyMatch) {
    if (results.authorMatch === false) {
      score -= 10;
      reasons.push({ kind: 'negative', text: 'No author name from the matched record found in this reference' });
    } else if (results.authorMatch === true) {
      reasons.push({ kind: 'positive', text: 'Author name confirmed in matched record' });
    }
    if (results.volumePageConfirmed) {
      score += 5;
      reasons.push({ kind: 'positive', text: 'Volume/page numbers confirmed in CrossRef' });
    }
  }

  if (!results.anyMatch) {
    score += SCORE.NO_MATCH_PENALTY;
    reasons.push({ kind: 'negative', text: 'No matches in CrossRef, Europe PMC, Semantic Scholar, arXiv, or book databases' });
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
  const label = finalScore >= SCORE.VALID_THRESHOLD ? 'valid' : 'warning';

  return { score: finalScore, label, reasons };
}

function truncate(str, n) {
  if (typeof str !== 'string') return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}
