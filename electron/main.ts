import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from "electron";
import path from "node:path";

let win: BrowserWindow | null = null;
let tray: Tray | null = null;

// To allow “close -> hide” behavior without quitting
let isQuitting = false;

function isDevMode() {
  const forceProd = process.argv.includes("--prod");
  return !app.isPackaged && !forceProd;
}

function createTray() {
  if (tray) return;

    const iconPath = getMainAssetPath("tray.png");
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);
  tray.setToolTip("Books Reader");


  const menu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        if (!win) return;
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
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);

  // Click tray icon -> toggle show/hide
  tray.on("click", () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else {
      win.show();
      win.focus();
    }
  });
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    backgroundColor: "#00000000",
    frame: false,
    autoHideMenuBar: true,
    transparent: true,
  
  hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ✅ close button hides to tray
  win.on("close", (e) => {
    if (isQuitting) return;
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
    await win.loadFile(path.join(__dirname, "../dist/index.html"));
    //win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.webContents.on("context-menu", (e) => e.preventDefault());
    win.webContents.on("devtools-opened", () => {
      win?.webContents.closeDevTools();
    });
    await win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  createTray();
}

// IPC: Quit from renderer (EXIT button)
ipcMain.handle("app:quit", () => {
  isQuitting = true;
  app.quit();
});

// Optional IPC: hide/show (if you want buttons later)
ipcMain.handle("app:hide", () => win?.hide());
ipcMain.handle("app:show", () => {
  win?.show();
  win?.focus();
});

ipcMain.handle("reader:set-format", (_e, format: "A4" | "A5") => {
  if (!win) return;

  const sizes = {
    A4: [900,1270],
    A5: [620,880]
  } as const;

  const [w, h] = sizes[format];
  win.setSize(w, h, true);
  win.center();
});


ipcMain.handle("reader:is-fullscreen", () => {
  return win?.isFullScreen() ?? false;
});
// Explicit fullscreen set (DO NOT toggle)
ipcMain.handle("reader:set-fullscreen", async (_e, on: boolean) => {
  if (!win) return false;
  win.setFullScreen(!!on);
  return win.isFullScreen();           // ✅ return actual state
});




ipcMain.handle("win:set-opacity", (_e, opacity: number) => {
  if (!win) return;
  const o = Math.max(0.15, Math.min(1, Number(opacity) || 1));
  win.setOpacity(o);
});

ipcMain.handle("win:get-opacity", () => {
  return win?.getOpacity?.() ?? 1;
});

// --- bounds (save/restore) ---
ipcMain.handle("win:get-bounds", () => {
  if (!win) throw new Error("No window");
  return win.getBounds(); // {x,y,width,height}
});

ipcMain.handle("win:set-bounds", (_e, b: { x: number; y: number; width: number; height: number }) => {
  if (!win) return;
  // true => animate if OS supports
  win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }, true);
});

// --- exact size (optional but recommended) ---
ipcMain.handle("win:set-size", (_e, p: { width: number; height: number }) => {
  if (!win) return;
  win.setSize(Math.round(p.width), Math.round(p.height), true);
  win.center();
});

app.whenReady().then(createWindow);

// On macOS: keep app running even if all windows closed (tray/menu)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // On Windows/Linux, we still keep the tray app alive typically.
    // If you want: keep alive always -> do nothing here.
    // If you want classic behavior -> app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  if (!win) createWindow();
  else {
    win.show();
    win.focus();
  }
});

function getMainAssetPath(...p: string[]) {
  // 3) Packaged app: extraResources -> process.resourcesPath/assets/...
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", ...p);
  }

  // 2) Running "electron ." from your project root (even with --prod)
  // app.getAppPath() will be your project folder (where package.json is)
  return path.join(app.getAppPath(), "electron", "assets", ...p);
}