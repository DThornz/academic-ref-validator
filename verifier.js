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
