/**
 * Split raw input text into individual reference strings.
 * Heuristics: blank lines, [n] markers, "n." markers, "(n)" markers.
 */
export function splitReferences(text) {
  const chunks = text.split(/\n\s*\n|\n\s*\[\d+\]\s+|\n\s*\d+\.\s+|\n\s*\(\d+\)\s+/);
  return chunks
    .map(c => c.replace(/^\s*(\[\d+\]|\d+\.|\(\d+\))\s+/, '').trim())
    .filter(c => c.length > 25);
}

/**
 * Extract easily detectable signals from a single reference.
 */
export function extractFeatures(ref) {
  // Collapse line breaks that split a DOI (e.g. "10.\n1038/...")
  const singleLine = ref.replace(/10\.\s*\n\s*/g, '10.');
  const doiMatch = singleLine.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/);
  const yearMatch = ref.match(/\(((?:19|20)\d{2})\)/) || ref.match(/\b((?:19|20)\d{2})\b/);
  const isbnMatch = ref.match(/\b(?:97[89][- ]?)?(?:\d[- ]?){9}[\dXx]\b/);

  let title = null;
  const quoted = ref.match(/[""]([^""]{6,})[""]|"([^"]{6,})"/);
  if (quoted) {
    title = (quoted[1] || quoted[2]).trim();
  }

  return {
    raw: ref,
    doi: doiMatch ? doiMatch[0].replace(/[).,;]+$/, '') : null,
    year: yearMatch ? parseInt(yearMatch[1], 10) : null,
    isbn: isbnMatch ? isbnMatch[0] : null,
    title,
    text: ref.toLowerCase()
  };
}

/**
 * Detect the referencing style used across a batch of references.
 * Returns one of: 'APA', 'Vancouver', 'IEEE', 'MLA', 'Chicago', 'Harvard', or null.
 */
export function detectStyle(refs) {
  if (!refs || refs.length === 0) return null;
  const text = refs.join('\n');

  const scores = { APA: 0, Vancouver: 0, IEEE: 0, MLA: 0, Chicago: 0, Harvard: 0 };

  // IEEE — numbered bracket at line start is definitive
  if (/^\s*\[\d+\]/m.test(text))                                   scores.IEEE += 6;
  if (/\bvol\.\s*\d/i.test(text) && /\bno\.\s*\d/i.test(text))    scores.IEEE += 2;

  // Vancouver — year immediately before semicolon+volume: "2021;18:..."
  if (/\b(19|20)\d{2};\d/.test(text))                              scores.Vancouver += 6;
  if (/\b[A-Z][a-z]+ [A-Z]{2,3}[,.]/.test(text))                  scores.Vancouver += 2;

  // APA — initial then (Year): "A. A. (2021)."
  if (/[A-Z]\.\s+\([12]\d{3}\)\./.test(text))                     scores.APA += 5;
  if (/\s&\s[A-Z][a-z]/.test(text))                                scores.APA += 3;

  // Harvard — (Year) followed immediately by a single-quoted title
  if (/\([12]\d{3}\) ['']/.test(text))                             scores.Harvard += 6;
  if (/\band [A-Z][a-z]/.test(text) && /\([12]\d{3}\)/.test(text)) scores.Harvard += 2;

  // MLA — "Quoted title." with vol./no. notation
  if (/"[A-Z][^"]{8,}\."/.test(text))                              scores.MLA += 3;
  if (/\bvol\. \d+, no\. \d/i.test(text))                         scores.MLA += 3;

  // Chicago notes-bibliography — (Year): pages
  if (/\([12]\d{3}\):\s*\d/.test(text))                            scores.Chicago += 5;
  if (/"[A-Z][^"]+\."\s+[A-Z]/.test(text))                        scores.Chicago += 2;

  const [[style, top]] = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return top >= 3 ? style : null;
}

/**
 * Build a focused query string for search APIs from a reference.
 * Trims to ~250 characters, removes typical citation chrome (URLs, "Retrieved from", etc.).
 */
export function buildQuery(ref) {
  let q = ref
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/doi:\s*\S+/gi, ' ')
    .replace(/\bRetrieved from\b/gi, ' ')
    .replace(/\bAvailable at\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (q.length > 250) q = q.slice(0, 250);
  return q;
}

/**
 * Build a clean query optimised for text-search APIs (Semantic Scholar, PubMed).
 * Removes "et al.", page ranges, year-in-parens, and small standalone numbers so
 * the API sees mostly title words and author surnames rather than citation metadata.
 */
export function buildCoreQuery(ref, features) {
  let q = ref
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2') // rejoin hyphenated line breaks: "perfor-\nmance" → "performance"
    .replace(/[™®©℠]/g, '')                  // strip trademark/copyright symbols
    .replace(/\n/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\bdoi:\s*\S+/gi, ' ')
    .replace(/\bet\s+al\.?/gi, ' ')
    .replace(/\b\d+[–\-]\d+\b/g, ' ')  // page ranges: 1-7, 329-349
    .replace(/\(\d{4}\)\.?/g, ' ')      // (2016).
    .replace(/\b\d{1,3}\b/g, ' ')       // small standalone numbers (vol, issue)
    .replace(/[,;&.]/g, ' ')            // commas, semicolons, ampersands, periods
    .replace(/\s+/g, ' ')
    .trim();
  if (features?.year) q += ` ${features.year}`;
  return q.slice(0, 220);
}
