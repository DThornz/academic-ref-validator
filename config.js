export const API = {
  CROSSREF:     'https://api.crossref.org/works/',
  OPENALEX:     'https://api.openalex.org/works',
  GOOGLE_BOOKS: 'https://www.googleapis.com/books/v1/volumes'
};

export const SCORE = {
  DOI_VERIFIED:      60,
  OPENALEX_MATCH:    40,
  BOOK_MATCH:        35,
  NO_MATCH_PENALTY: -50,
  VALID_THRESHOLD:   70,
  WARNING_THRESHOLD: 40
};

export const CONCURRENCY_LIMIT = 5;
