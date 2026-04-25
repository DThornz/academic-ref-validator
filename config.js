export const API = {
  CROSSREF:       'https://api.crossref.org/works/',
  OPENALEX:       'https://api.openalex.org/works',
  GOOGLE_BOOKS:   'https://www.googleapis.com/books/v1/volumes',
  PUBMED_SEARCH:  'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
  PUBMED_SUMMARY: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi'
};

export const SCORE = {
  DOI_VERIFIED:      75,
  PUBMED_MATCH:      50,
  OPENALEX_MATCH:    40,
  BOOK_MATCH:        40,
  NO_MATCH_PENALTY: -50,
  VALID_THRESHOLD:   70,
  WARNING_THRESHOLD: 35
};

export const CONCURRENCY_LIMIT = 5;
