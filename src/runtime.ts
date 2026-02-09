export function isElectron(): boolean {
  return typeof (window as any).readerWindow !== "undefined";
}
/** Heuristic: service worker control implies PWA-ish environment */
export function isPwaRuntime(): boolean {
  return typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    !!navigator.serviceWorker.controller;
}

/** Choose preload strategy */
export function useBlobPreload(): boolean {
  // Blob preload is great in Electron.
  // In PWA, prefer Image preload to avoid CORS issues.
  return isElectron() && !isPwaRuntime();
}
