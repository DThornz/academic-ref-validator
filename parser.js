/**
 * Split raw input text into individual reference strings.
 * Handles blank-line separation and numbered markers ([n], n., (n)).
 * After splitting, each chunk is normalised: internal line-breaks are
 * collapsed into spaces and hyphenated line-breaks are rejoined, so
 * references that wrap across many lines in copy-pasted PDFs become
 * clean single-line strings before any further processing.
 */
export function splitReferences(text) {
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on blank lines, or at any line boundary where the next line
  // opens a numbered marker. Numbers are capped at 3 digits to avoid
  // treating a year like "2021." at the start of a continuation line
  // as a new reference marker.
  const rawChunks = input.split(
    /\n[ \t]*\n|\n(?=[ \t]*(?:\[\d{1,3}\]|\d{1,3}\.|\(\d{1,3}\))[ \t])/
  );

  return rawChunks
    .map(normaliseChunk)
    .filter(c => c.length > 25);
}

function normaliseChunk(chunk) {
  // Strip a leading numbered marker: "[1] ", "1. ", "(1) "
  const noMarker = chunk.replace(/^[ \t]*(?:\[\d+\]|\d+\.|\(\d+\))[ \t]+/, '');
  // Rejoin hyphenated line-breaks: "vascu-\n   lar" → "vascular"
  const deHyphenated = noMarker.replace(/(\w)-[ \t]*\n[ \t]*(\w)/g, '$1$2');
  // Collapse all remaining internal line-breaks into single spaces
  return deHyphenated.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/\s+/g, ' ').trim();
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

  // Volume: prefer explicit keyword, then Vancouver ;vol( style, then vol(issue) pattern
  const volExplicit  = ref.match(/\bvol(?:ume)?\.?\s*(\d+)/i);
  const volVancouver = ref.match(/;\s*(\d{1,4})\s*[(:]/);
  const volAPA       = ref.match(/(?<!\d)(\d{1,3})\s*\(\s*\d+\s*\)/);
  const volume       = volExplicit?.[1] ?? volVancouver?.[1] ?? volAPA?.[1] ?? null;

  // First page: pp. N–M, then :N–M (Vancouver / general)
  const pagePP    = ref.match(/\bpp?\.?\s*(\d{1,6})\s*[-–]/i);
  const pageColon = ref.match(/:\s*(\d{1,6})\s*[-–]/);
  const firstPage = pagePP?.[1] ?? pageColon?.[1] ?? null;

  return {
    raw: ref,
    doi: doiMatch ? doiMatch[0].replace(/[).,;]+$/, '') : null,
    year: yearMatch ? parseInt(yearMatch[1], 10) : null,
    isbn: isbnMatch ? isbnMatch[0] : null,
    title,
    volume,
    firstPage,
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

// ─── Journal abbreviation expansion ─────────────────────────────────────────

// Full abbreviated journal names → full names.
// Sorted longest-first at build time so longer patterns are matched before
// any shorter substring they contain (e.g. "Nat Genet" before "Nat").
const _JOURNAL_FULL = new Map([
  ['Proc Natl Acad Sci USA', 'Proceedings of the National Academy of Sciences USA'],
  ['Am J Respir Crit Care Med', 'American Journal of Respiratory and Critical Care Medicine'],
  ['J Cereb Blood Flow Metab', 'Journal of Cerebral Blood Flow and Metabolism'],
  ['J Am Coll Cardiol', 'Journal of the American College of Cardiology'],
  ['Proc Natl Acad Sci', 'Proceedings of the National Academy of Sciences'],
  ['J Natl Cancer Inst', 'Journal of the National Cancer Institute'],
  ['Mol Cell Biol', 'Molecular and Cellular Biology'],
  ['Am J Hum Genet', 'American Journal of Human Genetics'],
  ['Am J Psychiatry', 'American Journal of Psychiatry'],
  ['Am J Pathol', 'American Journal of Pathology'],
  ['Am J Physiol', 'American Journal of Physiology'],
  ['Am J Clin Nutr', 'American Journal of Clinical Nutrition'],
  ['Clin Cancer Res', 'Clinical Cancer Research'],
  ['Ann Intern Med', 'Annals of Internal Medicine'],
  ['Hum Mol Genet', 'Human Molecular Genetics'],
  ['J Heart Valve Dis', 'Journal of Heart Valve Disease'],
  ['Int J Cancer', 'International Journal of Cancer'],
  ['Eur Heart J', 'European Heart Journal'],
  ['Nat Cell Biol', 'Nature Cell Biology'],
  ['J Clin Invest', 'Journal of Clinical Investigation'],
  ['J Clin Oncol', 'Journal of Clinical Oncology'],
  ['J Exp Med', 'Journal of Experimental Medicine'],
  ['J Biol Chem', 'Journal of Biological Chemistry'],
  ['J Neurotrauma', 'Journal of Neurotrauma'],
  ['J Neurosurg', 'Journal of Neurosurgery'],
  ['N Engl J Med', 'New England Journal of Medicine'],
  ['Front Neurosci', 'Frontiers in Neuroscience'],
  ['Front Immunol', 'Frontiers in Immunology'],
  ['Cancer Res', 'Cancer Research'],
  ['Brain Res', 'Brain Research'],
  ['Br J Cancer', 'British Journal of Cancer'],
  ['Cell Stem Cell', 'Cell Stem Cell'],
  ['Curr Biol', 'Current Biology'],
  ['Nat Genet', 'Nature Genetics'],
  ['PLoS Biol', 'PLOS Biology'],
  ['PLoS Genet', 'PLOS Genetics'],
  ['PLoS Med', 'PLOS Medicine'],
  ['Mol Cell', 'Molecular Cell'],
  ['Nat Med', 'Nature Medicine'],
  ['NEJM', 'New England Journal of Medicine'],
  ['JAMA', 'Journal of the American Medical Association'],
  ['PNAS', 'Proceedings of the National Academy of Sciences'],
  ['BMJ', 'British Medical Journal'],
]);

const _JOURNAL_PATTERNS = [..._JOURNAL_FULL.entries()]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([abbr, full]) => [
    new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
    full
  ]);

// Word-level expansions applied to any token ending with a period,
// e.g. "Dis." → "Disease", "Clin." → "Clinical"
const _WORD_ABBREVS = new Map([
  ['am', 'American'], ['int', 'International'], ['eur', 'European'],
  ['br', 'British'], ['brit', 'British'], ['clin', 'Clinical'],
  ['med', 'Medical'], ['sci', 'Sciences'], ['biol', 'Biology'],
  ['biochem', 'Biochemistry'], ['physiol', 'Physiology'],
  ['pharmacol', 'Pharmacology'], ['pathol', 'Pathology'], ['surg', 'Surgery'],
  ['pediatr', 'Pediatrics'], ['paediatr', 'Paediatrics'], ['radiol', 'Radiology'],
  ['neurol', 'Neurology'], ['neurosci', 'Neuroscience'], ['oncol', 'Oncology'],
  ['cardiol', 'Cardiology'], ['immunol', 'Immunology'], ['mol', 'Molecular'],
  ['genet', 'Genetics'], ['exp', 'Experimental'], ['rev', 'Reviews'],
  ['ann', 'Annals'], ['proc', 'Proceedings'], ['natl', 'National'],
  ['assoc', 'Association'], ['res', 'Research'], ['lett', 'Letters'],
  ['commun', 'Communications'], ['dis', 'Disease'], ['disord', 'Disorders'],
  ['toxicol', 'Toxicology'], ['microbiol', 'Microbiology'],
  ['epidemiol', 'Epidemiology'], ['gastroenterol', 'Gastroenterology'],
  ['hepatol', 'Hepatology'], ['hematol', 'Hematology'],
  ['dermatol', 'Dermatology'], ['ophthalmol', 'Ophthalmology'],
  ['respir', 'Respiratory'], ['nutr', 'Nutrition'], ['environ', 'Environmental'],
  ['biophys', 'Biophysics'], ['biomater', 'Biomaterials'],
]);

function expandJournalAbbreviations(text) {
  let t = text;
  for (const [pattern, full] of _JOURNAL_PATTERNS) t = t.replace(pattern, full);
  // Expand dotted abbreviations: "Dis." → "Disease", "Clin." → "Clinical"
  t = t.replace(/\b([A-Za-z]{2,})\.(?=[\s,;]|$)/g, (m, word) =>
    _WORD_ABBREVS.get(word.toLowerCase()) || m
  );
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Light query for CrossRef bibliographic text search.
 * CrossRef's query.bibliographic field is designed for full formatted reference
 * strings — author punctuation, journal names, and page ranges all help it match.
 * We only strip artefacts that corrupt the query.
 */
export function buildCrossRefQuery(ref) {
  let q = ref
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1-$2')  // rejoin hyphenated line breaks
    .replace(/(\w)- ([a-z]\w{2,})/g, '$1$2') // also handle space-separated PDF splits
    .replace(/[™®©℠]/g, '')                   // strip trademark/copyright symbols
    .replace(/\n/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\bdoi:\s*\S+/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  q = expandJournalAbbreviations(q);
  return q.slice(0, 220);
}

/**
 * Extract the most title-like sentence fragment from a reference.
 * Splits on ". " boundaries and returns the longest segment that contains
 * at least 8 lowercase letters — a good proxy for an article/book title.
 */
export function extractBestSentence(ref) {
  const normalized = ref
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1-$2')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const segments = normalized.split(/\.\s+/);
  let best = '';
  for (const seg of segments) {
    const lcCount = (seg.match(/[a-z]/g) || []).length;
    if (lcCount >= 8 && seg.length > best.length) best = seg;
  }
  return best || normalized;
}

export function buildCoreQuery(ref, features) {
  let q = ref
    .replace(/(\w)-\s*\n\s*(\w)/g, '$1-$2') // rejoin hyphenated line breaks
    .replace(/(\w)- ([a-z]\w{2,})/g, '$1$2') // space-separated PDF splits
    .replace(/[™®©℠]/g, '')
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
