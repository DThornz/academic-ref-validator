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
 */
export async function searchCrossRefText(query) {
  try {
    const url = `${API.CROSSREF_SEARCH}?query.bibliographic=${encodeURIComponent(query)}&rows=1&select=DOI,title,author,score,published`;
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
 * Search PubMed via NCBI E-utilities. Returns the summary record or null.
 */
export async function searchPubMed(query) {
  try {
    const searchUrl = `${API.PUBMED_SEARCH}?db=pubmed&term=${encodeURIComponent(query)}&retmax=1&retmode=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist;
    if (!ids || ids.length === 0) return null;
    const summaryUrl = `${API.PUBMED_SUMMARY}?db=pubmed&id=${ids[0]}&retmode=json`;
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json();
    return summaryData.result?.[ids[0]] || null;
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
