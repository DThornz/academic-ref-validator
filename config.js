export const API = {
  CROSSREF:        'https://api.crossref.org/works/',  // DOI lookup
  CROSSREF_SEARCH: 'https://api.crossref.org/works',   // bibliographic text search
  PUBMED_SEARCH:   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
  PUBMED_SUMMARY:  'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi',
  GOOGLE_BOOKS:    'https://www.googleapis.com/books/v1/volumes'
};

export const SCORE = {
  DOI_VERIFIED:          75,
  CROSSREF_TEXT_MATCH:   50,
  PUBMED_MATCH:          45,
  BOOK_MATCH:            35,
  NO_MATCH_PENALTY:     -50,
  VALID_THRESHOLD:       70,
  WARNING_THRESHOLD:     25
};

export const CONCURRENCY_LIMIT = 5;
