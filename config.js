// mailto is sent with CrossRef requests to join the polite pool (higher rate limits).
const MAILTO = 'mailto=reference-validator@example.com';

export const API = {
  CROSSREF:        `https://api.crossref.org/works/`,           // DOI lookup
  CROSSREF_SEARCH: `https://api.crossref.org/works?${MAILTO}`,  // bibliographic text search
  EUROPE_PMC:      'https://www.ebi.ac.uk/europepmc/webservices/rest/search',
  GOOGLE_BOOKS:    'https://www.googleapis.com/books/v1/volumes',
  OPEN_LIBRARY:    'https://openlibrary.org/search.json'
};

export const SCORE = {
  DOI_VERIFIED:          75,
  CROSSREF_TEXT_MATCH:   75,
  EUROPE_PMC_MATCH:      45,
  BOOK_MATCH:            35,
  NO_MATCH_PENALTY:     -50,
  VALID_THRESHOLD:       70,
  WARNING_THRESHOLD:     25
};

export const CONCURRENCY_LIMIT = 5;
