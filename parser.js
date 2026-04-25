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
  const doiMatch = ref.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/);
  const yearMatch = ref.match(/\b((?:19|20)\d{2})\b/);
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
