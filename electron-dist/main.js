"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
let win = null;
let tray = null;
// To allow “close -> hide” behavior without quitting
let isQuitting = false;
function isDevMode() {
    const forceProd = process.argv.includes("--prod");
    return !electron_1.app.isPackaged && !forceProd;
}
function createTray() {
    if (tray)
        return;
    const iconPath = getMainAssetPath("tray.png");
    const icon = electron_1.nativeImage.createFromPath(iconPath);
    tray = new electron_1.Tray(icon);
    tray.setToolTip("Books Reader");
    const menu = electron_1.Menu.buildFromTemplate([
        {
            label: "Show",
            click: () => {
                if (!win)
                    return;
                win.show();
                win.focus();
            },
        },
        {
            label: "Hide",
            click: () => {
                win?.hide();
            },
        },
        { type: "separator" },
        {
            label: "Quit",
            click: () => {
                isQuitting = true;
                electron_1.app.quit();
            },
        },
    ]);
    tray.setContextMenu(menu);
    // Click tray icon -> toggle show/hide
    tray.on("click", () => {
        if (!win)
            return;
        if (win.isVisible())
            win.hide();
        else {
            win.show();
            win.focus();
        }
    });
}
async function createWindow() {
    win = new electron_1.BrowserWindow({
        width: 1200,
        height: 900,
        backgroundColor: "#00000000",
        frame: false,
        autoHideMenuBar: true,
        transparent: true,
        hasShadow: true,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // ✅ close button hides to tray
    win.on("close", (e) => {
        if (isQuitting)
            return;
        e.preventDefault();
        win?.hide();
    });
    win.on("enter-full-screen", () => {
        win?.webContents.send("reader:fullscreen-changed", true);
        win?.webContents.on("before-input-event", (e, input) => {
            if (input.key === "F11" && input.type === "keyDown") {
                e.preventDefault();
            }
        });
    });
    win.on("leave-full-screen", () => {
        win?.webContents.send("reader:fullscreen-changed", false);
    });
    const isDev = isDevMode();
    if (isDev) {
        //await win.loadURL("http://localhost:5173");
        await win.loadFile(node_path_1.default.join(__dirname, "../dist/index.html"));
        //win.webContents.openDevTools({ mode: "detach" });
    }
    else {
        win.webContents.on("context-menu", (e) => e.preventDefault());
        win.webContents.on("devtools-opened", () => {
            win?.webContents.closeDevTools();
        });
        await win.loadFile(node_path_1.default.join(__dirname, "../dist/index.html"));
    }
    createTray();
}
// IPC: Quit from renderer (EXIT button)
electron_1.ipcMain.handle("app:quit", () => {
    isQuitting = true;
    electron_1.app.quit();
});
// Optional IPC: hide/show (if you want buttons later)
electron_1.ipcMain.handle("app:hide", () => win?.hide());
electron_1.ipcMain.handle("app:show", () => {
    win?.show();
    win?.focus();
});
electron_1.ipcMain.handle("reader:set-format", (_e, format) => {
    if (!win)
        return;
    const sizes = {
        A4: [900, 1270],
        A5: [620, 880]
    };
    const [w, h] = sizes[format];
    win.setSize(w, h, true);
    win.center();
});
electron_1.ipcMain.handle("reader:is-fullscreen", () => {
    return win?.isFullScreen() ?? false;
});
// Explicit fullscreen set (DO NOT toggle)
electron_1.ipcMain.handle("reader:set-fullscreen", async (_e, on) => {
    if (!win)
        return false;
    win.setFullScreen(!!on);
    return win.isFullScreen(); // ✅ return actual state
});
electron_1.ipcMain.handle("win:set-opacity", (_e, opacity) => {
    if (!win)
        return;
    const o = Math.max(0.15, Math.min(1, Number(opacity) || 1));
    win.setOpacity(o);
});
electron_1.ipcMain.handle("win:get-opacity", () => {
    return win?.getOpacity?.() ?? 1;
});
// --- bounds (save/restore) ---
electron_1.ipcMain.handle("win:get-bounds", () => {
    if (!win)
        throw new Error("No window");
    return win.getBounds(); // {x,y,width,height}
});
electron_1.ipcMain.handle("win:set-bounds", (_e, b) => {
    if (!win)
        return;
    // true => animate if OS supports
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }, true);
});
// --- exact size (optional but recommended) ---
electron_1.ipcMain.handle("win:set-size", (_e, p) => {
    if (!win)
        return;
    win.setSize(Math.round(p.width), Math.round(p.height), true);
    win.center();
});
electron_1.app.whenReady().then(createWindow);
// On macOS: keep app running even if all windows closed (tray/menu)
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        // On Windows/Linux, we still keep the tray app alive typically.
        // If you want: keep alive always -> do nothing here.
        // If you want classic behavior -> app.quit();
    }
});
electron_1.app.on("before-quit", () => {
    isQuitting = true;
});
electron_1.app.on("activate", () => {
    if (!win)
        createWindow();
    else {
        win.show();
        win.focus();
    }
});
function getMainAssetPath(...p) {
    // 3) Packaged app: extraResources -> process.resourcesPath/assets/...
    if (electron_1.app.isPackaged) {
        return node_path_1.default.join(process.resourcesPath, "assets", ...p);
    }
    // 2) Running "electron ." from your project root (even with --prod)
    // app.getAppPath() will be your project folder (where package.json is)
    return node_path_1.default.join(electron_1.app.getAppPath(), "electron", "assets", ...p);
}
