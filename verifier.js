import { API } from './config.js';

/**
 * Returns an AbortSignal that fires after `ms` milliseconds, or earlier if
 * `outerSignal` is aborted (e.g. the user clicked Cancel).
 */
function timedSignal(outerSignal, ms) {
  const tc = new AbortController();
  const id = setTimeout(() => tc.abort(), ms);
  if (outerSignal?.aborted) {
    clearTimeout(id);
    tc.abort();
  } else {
    outerSignal?.addEventListener('abort', () => { clearTimeout(id); tc.abort(); }, { once: true });
  }
  return tc.signal;
}

export async function verifyDOI(doi, signal) {
  // Primary: CrossRef API — most authoritative
  try {
    const res = await fetch(`${API.CROSSREF}${encodeURIComponent(doi)}`, { signal: timedSignal(signal, 10000) });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok') return { ok: true, data: data.message };
    }
  } catch { /* fall through */ }

  // Secondary: doi.org content negotiation — CORS-friendly, covers DOIs that
  // CrossRef's API misses (e.g. old conference papers, non-CrossRef publishers).
  // Returns CSL-JSON with title/author data so we can still cross-check the title.
  try {
    const res = await fetch(`https://doi.org/${doi}`, {
      headers: { Accept: 'application/vnd.citationstyles.csl+json' },
      signal: timedSignal(signal, 8000)
    });
    if (res.ok) {
      const csl = await res.json();
      if (csl?.title) return { ok: true, data: normaliseCsl(csl) };
    }
  } catch { /* fall through */ }

  // Last resort: follow the redirect without metadata — title cannot be verified.
  try {
    const res = await fetch(`https://doi.org/${doi}`, { redirect: 'manual', signal: timedSignal(signal, 6000) });
    if (res.type === 'opaqueredirect') return { ok: true, viaRedirect: true };
  } catch { /* network error or CORS block */ }

  return { ok: false };
}

function normaliseCsl(csl) {
  return {
    title:             csl.title ? [csl.title] : [],
    author:            csl.author || [],
    published:         csl.issued ?? null,
    'container-title': csl['container-title'] ? [csl['container-title']] : [],
    volume:            csl.volume  ?? null,
    issue:             csl.issue   ?? null,
    page:              csl.page    ?? null,
    DOI:               csl.DOI     ?? null,
  };
}

export async function searchCrossRefText(query, signal) {
  try {
    const url = `${API.CROSSREF_SEARCH}&query.bibliographic=${encodeURIComponent(query)}&rows=1&select=DOI,title,author,score,published`;
    const res = await fetch(url, { signal: timedSignal(signal, 10000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'ok') return null;
    return data.message?.items?.[0] || null;
  } catch {
    return null;
  }
}

export async function searchEuropePMC(query, signal) {
  try {
    const url = `${API.EUROPE_PMC}?query=${encodeURIComponent(query)}&format=json&pageSize=3&resultType=lite&sort=relevance`;
    const res = await fetch(url, { signal: timedSignal(signal, 10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.resultList?.result?.[0] || null;
  } catch {
    return null;
  }
}

export async function searchBooks(query, signal) {
  try {
    const url = `${API.GOOGLE_BOOKS}?q=${encodeURIComponent(query)}&maxResults=1`;
    const res = await fetch(url, { signal: timedSignal(signal, 8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0] || null;
  } catch {
    return null;
  }
}

export async function searchOpenLibrary(query, signal) {
  try {
    const url = `${API.OPEN_LIBRARY}?q=${encodeURIComponent(query)}&limit=1&fields=title,key,first_publish_year`;
    const res = await fetch(url, { signal: timedSignal(signal, 8000) });
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

export async function verifyISBN(isbn, signal) {
  try {
    const clean = isbn.replace(/[- ]/g, '');
    const res = await fetch(`${API.OPEN_LIBRARY_BASE}/isbn/${clean}.json`, { signal: timedSignal(signal, 8000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function searchSemanticScholar(query, signal) {
  try {
    const url = `${API.SEMANTIC_SCHOLAR}?query=${encodeURIComponent(query)}&fields=title,year,authors,externalIds&limit=1`;
    const res = await fetch(url, { signal: timedSignal(signal, 8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function searchArXiv(query, signal) {
  try {
    const url = `${API.ARXIV}?search_query=all:${encodeURIComponent(query)}&max_results=1&sortBy=relevance`;
    const res = await fetch(url, { signal: timedSignal(signal, 12000) });
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
