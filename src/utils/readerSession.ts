// src/utils/readerSession.ts

export type BookProgress = {
  pageNo: number;
  ts: number; // last update epoch ms
};

export type ViewMode = "fit" | "original" | "custom";

export type BookViewSettings = {
  mode: ViewMode;
  /** Remember last custom scale even if user switches to Fit/Original */
  customScale: number;
  ts: number; // last update epoch ms
};

export type ReaderStoreV1 = {
  version: 1;
  lastOpened?: { bookName: string; pageNo: number; ts: number };
  books: Record<string, BookProgress>;

  /** New: per-book view settings (optional for backward compatibility) */
  views?: Record<string, BookViewSettings>;
};

const KEY = "booksReader.progress.v1";

function nowTs() {
  return Date.now();
}

function safeInt(n: unknown, fallback = 1) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(1, Math.floor(x));
}

function safeNum(n: unknown, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return x;
}

function safeName(s: unknown) {
  return String(s ?? "").trim();
}

function safeMode(m: unknown): ViewMode {
  const s = String(m ?? "").trim();
  return s === "fit" || s === "original" || s === "custom" ? (s as ViewMode) : "fit";
}

export function loadStore(): ReaderStoreV1 {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { version: 1, books: {}, views: {} };

    const obj = JSON.parse(raw) as Partial<ReaderStoreV1>;
    const books = (obj.books && typeof obj.books === "object" ? obj.books : {}) as Record<string, any>;
    const viewsRaw = (obj.views && typeof obj.views === "object" ? obj.views : {}) as Record<string, any>;

    const normalized: ReaderStoreV1 = { version: 1, books: {}, views: {} };

    // normalize progress
    for (const [k, v] of Object.entries(books)) {
      const name = safeName(k);
      if (!name) continue;
      const pageNo = safeInt(v?.pageNo, 1);
      const ts = Number.isFinite(Number(v?.ts)) ? Number(v?.ts) : 0;
      normalized.books[name] = { pageNo, ts };
    }

    // normalize lastOpened
    const lo = obj.lastOpened as any;
    const lastName = safeName(lo?.bookName);
    if (lastName) {
      normalized.lastOpened = {
        bookName: lastName,
        pageNo: safeInt(lo?.pageNo, normalized.books[lastName]?.pageNo ?? 1),
        ts: Number.isFinite(Number(lo?.ts)) ? Number(lo?.ts) : 0,
      };
    }

    // normalize views
    for (const [k, v] of Object.entries(viewsRaw)) {
      const name = safeName(k);
      if (!name) continue;

      const mode = safeMode(v?.mode);
      const customScale = clampScale(safeNum(v?.customScale, 1.0));
      const ts = Number.isFinite(Number(v?.ts)) ? Number(v?.ts) : 0;

      normalized.views![name] = { mode, customScale, ts };
    }

    return normalized;
  } catch {
    return { version: 1, books: {}, views: {} };
  }
}

export function saveStore(store: ReaderStoreV1): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // ignore quota/private-mode errors
  }
}

/** Save progress for a book + also mark it as lastOpened */
export function saveProgress(bookName: string, pageNo: number): void {
  const name = safeName(bookName);
  if (!name) return;

  const store = loadStore();
  const ts = nowTs();
  const pn = safeInt(pageNo, 1);

  store.books[name] = { pageNo: pn, ts };
  store.lastOpened = { bookName: name, pageNo: pn, ts };

  saveStore(store);
}

/** Returns the last opened book (if any) */
export function loadLastOpened(): { bookName: string; pageNo: number } | null {
  const store = loadStore();
  const lo = store.lastOpened;
  if (!lo?.bookName) return null;
  return { bookName: lo.bookName, pageNo: safeInt(lo.pageNo, 1) };
}

/** Returns progress for a given book */
export function loadProgress(bookName: string): BookProgress | null {
  const store = loadStore();
  const name = safeName(bookName);
  if (!name) return null;
  return store.books[name] ?? null;
}

/** Useful for BookChooser: list all progress records */
export function listProgress(): Array<{ bookName: string; pageNo: number; ts: number }> {
  const store = loadStore();
  return Object.entries(store.books)
    .map(([bookName, p]) => ({ bookName, pageNo: safeInt(p.pageNo, 1), ts: Number(p.ts) || 0 }))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function clearAllProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/* ------------------------------
   View settings (NEW)
--------------------------------*/

function clampScale(x: number) {
  // keep consistent with your UI slider limits (adjust if you change slider)
  return Math.max(0.6, Math.min(6.0, x));
}

/** Load per-book view settings (mode + last custom scale) */
export function loadBookViewSettings(bookName: string): BookViewSettings | null {
  const store = loadStore();
  const name = safeName(bookName);
  if (!name) return null;
  return store.views?.[name] ?? null;
}

/**
 * Save per-book view settings.
 * Good practice: always store last customScale even if mode is not "custom".
 */
export function saveBookViewSettings(bookName: string, settings: { mode: ViewMode; customScale: number }): void {
  const name = safeName(bookName);
  if (!name) return;

  const store = loadStore();
  const ts = nowTs();

  if (!store.views) store.views = {};
  store.views[name] = {
    mode: settings.mode,
    customScale: clampScale(settings.customScale),
    ts,
  };

  saveStore(store);
}
