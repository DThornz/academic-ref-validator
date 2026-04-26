import { API } from './config.js';

export async function verifyDOI(doi, signal) {
  try {
    const res = await fetch(`${API.CROSSREF}${encodeURIComponent(doi)}`, { signal });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    if (data.status !== 'ok') return { ok: false };
    return { ok: true, data: data.message };
  } catch {
    return { ok: false };
  }
}

export async function searchCrossRefText(query, signal) {
  try {
    const url = `${API.CROSSREF_SEARCH}&query.bibliographic=${encodeURIComponent(query)}&rows=1&select=DOI,title,author,score,published`;
    const res = await fetch(url, { signal });
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
    const res = await fetch(url, { signal });
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
    const res = await fetch(url, { signal });
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
    const res = await fetch(url, { signal });
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
    const res = await fetch(`${API.OPEN_LIBRARY_BASE}/isbn/${clean}.json`, { signal });
    return res.ok;
  } catch {
    return false;
  }
}

export async function searchSemanticScholar(query, signal) {
  try {
    const url = `${API.SEMANTIC_SCHOLAR}?query=${encodeURIComponent(query)}&fields=title,year,authors,externalIds&limit=1`;
    const res = await fetch(url, { signal });
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
    const res = await fetch(url, { signal });
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
