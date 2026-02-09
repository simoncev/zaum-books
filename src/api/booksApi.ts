import { pad4 } from "../utils/pad4";

const BASE =
  (import.meta as any).env?.VITE_BOOKS_BASE_URL?.toString().trim() ||
  "http://localhost:9999";

function joinUrl(base: string, path: string) {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export async function getBookNames(): Promise<string[]> {
  const url = joinUrl(BASE, "/books/pages/book/get-book-names");
  return await fetchJson<string[]>(url);
}

export async function getBookLang(bookName: string): Promise<string> {
  const enc = encodeURIComponent(bookName);
  const url = joinUrl(BASE, `/books/books/get-lang/${enc}`);
  return await fetchText(url);
}

export async function getPageCount(bookName: string): Promise<number> {
  const enc = encodeURIComponent(bookName);
  const url = joinUrl(BASE, `/books/pages/book/get-page-count/${enc}`);
  const txt = await fetchText(url);
  const n = Number(txt);
  if (!Number.isFinite(n)) throw new Error(`Invalid page-count: ${txt}`);
  return n;
}

/**
 * /books/books/get-size/{bookName}
 * Returns JSON: { width: number, height: number }
 * Units don't matter for UI; we use aspect ratio.
 */
export type BookSize = { width: number; height: number };

export async function getBookSize(bookName: string): Promise<BookSize> {
  const enc = encodeURIComponent(bookName);
  const url = joinUrl(BASE, `/books/books/get-size/${enc}`);
  const j = await fetchJson<any>(url);

  const w = Number(j?.width);
  const h = Number(j?.height);

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`Invalid book size response for ${bookName}: ${JSON.stringify(j)}`);
  }
  return { width: w, height: h };
}

/**
 * Returns a direct <img src="..."> URL that your backend serves.
 * /books/pages/get-page-image/{bookName}-%04i
 */
export function getPageImageUrl(bookName: string, pageNo: number): string {
  const pageKey = `${bookName}-${pad4(pageNo)}`;
  const enc = encodeURIComponent(pageKey);
  return joinUrl(BASE, `/books/pages/get-page-image/${enc}`);
}
