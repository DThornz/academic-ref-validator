import { API } from './config.js';

/**
 * Verify a DOI against CrossRef. Returns { ok, data } or { ok: false }.
 */
export async function verifyDOI(doi) {
  try {
    const res = await fetch(`${API.CROSSREF}${encodeURIComponent(doi)}`);
    if (!res.ok) return { ok: false };
    const data = await res.json();
    if (data.status !== 'ok') return { ok: false };
    return { ok: true, data: data.message };
  } catch {
    return { ok: false };
  }
}

/**
 * CrossRef bibliographic text search — designed for matching full reference strings.
 * Returns the top result or null.
 * Uses the polite pool (mailto in base URL) for better rate limits.
 */
export async function searchCrossRefText(query) {
  try {
    const url = `${API.CROSSREF_SEARCH}&query.bibliographic=${encodeURIComponent(query)}&rows=1&select=DOI,title,author,score,published`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'ok') return null;
    return data.message?.items?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Search Europe PMC — covers PubMed/MEDLINE plus many additional life-science sources.
 * Returns the top result or null.
 */
export async function searchEuropePMC(query) {
  try {
    const url = `${API.EUROPE_PMC}?query=${encodeURIComponent(query)}&format=json&pageSize=3&resultType=lite&sort=relevance`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.resultList?.result?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Search Google Books. Returns first volume or null.
 */
export async function searchBooks(query) {
  try {
    const url = `${API.GOOGLE_BOOKS}?q=${encodeURIComponent(query)}&maxResults=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Search Open Library. Returns { title, key } or null.
 * Open Library covers a very broad range of published books.
 */
export async function searchOpenLibrary(query) {
  try {
    const url = `${API.OPEN_LIBRARY}?q=${encodeURIComponent(query)}&limit=1&fields=title,key,first_publish_year`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data.docs?.[0];
    if (!doc) return null;
    return {
      title: doc.title,
      year: doc.first_publish_year,
      url: `https://openlibrary.org${doc.key}`
    };
  } catch {
    return null;
  }
}

/**
 * Verify an ISBN against Open Library's ISBN endpoint.
 * Returns true if the ISBN resolves to a known work.
 */
export async function verifyISBN(isbn) {
  try {
    const clean = isbn.replace(/[- ]/g, '');
    const res = await fetch(`${API.OPEN_LIBRARY_BASE}/isbn/${clean}.json`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Search Semantic Scholar. Returns the top result or null.
 * Covers computer science, biomedical, and many STEM disciplines.
 */
export async function searchSemanticScholar(query) {
  try {
    const url = `${API.SEMANTIC_SCHOLAR}?query=${encodeURIComponent(query)}&fields=title,year,authors,externalIds&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Search arXiv using their Atom API. Returns { title, url } or null.
 * Useful for physics, maths, and CS preprints that lack DOIs.
 */
export async function searchArXiv(query) {
  try {
    const url = `${API.ARXIV}?search_query=all:${encodeURIComponent(query)}&max_results=1&sortBy=relevance`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    const entry = xml.querySelector('entry');
    if (!entry) return null;
    const title = entry.querySelector('title')?.textContent?.trim().replace(/\s+/g, ' ');
    const id    = entry.querySelector('id')?.textContent?.trim();
    return title ? { title, url: id } : null;
  } catch {
    return null;
  }
}
