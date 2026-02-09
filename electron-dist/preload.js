"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// electron/preload.ts
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("readerWindow", {
    // existing
    setFormat: (format) => electron_1.ipcRenderer.invoke("reader:set-format", format),
    toggleFullscreen: () => electron_1.ipcRenderer.invoke("reader:toggle-fullscreen"),
    isFullscreen: () => electron_1.ipcRenderer.invoke("reader:is-fullscreen"),
    setFullscreen: (on) => electron_1.ipcRenderer.invoke("reader:set-fullscreen", on),
    onFullscreenChanged: (cb) => {
        electron_1.ipcRenderer.on("reader:fullscreen-changed", (_e, on) => cb(!!on));
    },
    setOpacity: (opacity) => electron_1.ipcRenderer.invoke("win:set-opacity", opacity),
    getOpacity: () => electron_1.ipcRenderer.invoke("win:get-opacity"),
    exitApp: () => electron_1.ipcRenderer.invoke("app:quit"),
    // NEW: restore window bounds (for fullscreen toggle)
    getBounds: () => electron_1.ipcRenderer.invoke("win:get-bounds"),
    setBounds: (b) => electron_1.ipcRenderer.invoke("win:set-bounds", b),
    // OPTIONAL but recommended: set size directly (used when book has real cm size)
    setWindowSize: (width, height) => electron_1.ipcRenderer.invoke("win:set-size", { width, height }),
});
