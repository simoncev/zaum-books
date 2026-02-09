// electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

type Bounds = { x: number; y: number; width: number; height: number };

contextBridge.exposeInMainWorld("readerWindow", {
  // existing
  setFormat: (format: "A4" | "A5") => ipcRenderer.invoke("reader:set-format", format),
  toggleFullscreen: () => ipcRenderer.invoke("reader:toggle-fullscreen"),
  isFullscreen: (): Promise<boolean> => ipcRenderer.invoke("reader:is-fullscreen"),
  setFullscreen: (on: boolean): Promise<boolean> =>
  ipcRenderer.invoke("reader:set-fullscreen", on),
  onFullscreenChanged: (cb: (on: boolean) => void) => {
  ipcRenderer.on("reader:fullscreen-changed", (_e, on: boolean) => cb(!!on));
},
  

  setOpacity: (opacity: number) => ipcRenderer.invoke("win:set-opacity", opacity),
  getOpacity: (): Promise<number> => ipcRenderer.invoke("win:get-opacity"),

  exitApp: (): Promise<void> => ipcRenderer.invoke("app:quit"),

  // NEW: restore window bounds (for fullscreen toggle)
  getBounds: (): Promise<Bounds> => ipcRenderer.invoke("win:get-bounds"),
  setBounds: (b: Bounds): Promise<void> => ipcRenderer.invoke("win:set-bounds", b),

  // OPTIONAL but recommended: set size directly (used when book has real cm size)
  setWindowSize: (width: number, height: number): Promise<void> =>
    ipcRenderer.invoke("win:set-size", { width, height }),
});
