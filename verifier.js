import { API } from './config.js';

/**
 * Verify a DOI against CrossRef. Returns an object { ok, data } or { ok: false }.
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
 * Search OpenAlex for a paper-like reference. Returns first result or null.
 */
export async function searchOpenAlex(query) {
  try {
    const url = `${API.OPENALEX}?search=${encodeURIComponent(query)}&per_page=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] || null;
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
