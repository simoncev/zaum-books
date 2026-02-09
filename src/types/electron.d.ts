// src/electron.d.ts
export {};

declare global {
  type Bounds = { x: number; y: number; width: number; height: number };

  interface ReaderWindowApi {
    setFormat: (format: "A4" | "A5") => Promise<void>;
    toggleFullscreen: () => Promise<void>;
    isFullscreen: () => Promise<boolean>;
    setFullscreen: (on: boolean) => Promise<void>;
    onFullscreenChanged: (cb: (on: boolean) => void) => void;

    setOpacity: (opacity: number) => Promise<void>;
    getOpacity: () => Promise<number>;

    exitApp: () => Promise<void>;

    // NEW
    getBounds: () => Promise<Bounds>;
    setBounds: (b: Bounds) => Promise<void>;

    // OPTIONAL
    setWindowSize: (width: number, height: number) => Promise<void>;
  }

  interface Window {
    readerWindow?: ReaderWindowApi;
  }
}
