export const API = {
  CROSSREF:         'https://api.crossref.org/works/',
  OPENALEX:         'https://api.openalex.org/works',
  GOOGLE_BOOKS:     'https://www.googleapis.com/books/v1/volumes',
  PUBMED_SEARCH:    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi',
  PUBMED_SUMMARY:   'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi',
  SEMANTIC_SCHOLAR: 'https://api.semanticscholar.org/graph/v1/paper/search'
};

export const SCORE = {
  DOI_VERIFIED:           75,
  SEMANTIC_SCHOLAR_MATCH: 50,
  PUBMED_MATCH:           45,
  OPENALEX_MATCH:         35,
  BOOK_MATCH:             35,
  NO_MATCH_PENALTY:      -50,
  VALID_THRESHOLD:        70,
  WARNING_THRESHOLD:      30
};

export const CONCURRENCY_LIMIT = 5;
