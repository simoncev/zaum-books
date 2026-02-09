<!-- src/components/BookReader.vue -->
<template>
  <div
    class="reader-root"
    tabindex="0"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
    @mousemove="onMouseMove"
  >
    <!-- Top bar -->
    <header class="topbar">
      <!-- ROW 1 -->
      <div class="row row1">
        <div class="left">
          <button class="btn" @click="onBack" title="Back (Esc)">
            <span class="ico">←</span>
            <span v-if="!isTiny" class="lbl">Back</span>
          </button>

          <div class="title">
            <div class="book" :title="bookName">{{ bookName }}</div>
            <div class="meta">
              <span>Page {{ pageNo }} / {{ pageCount }}</span>
              <span class="dot">•</span>

              <template v-if="bookSizeCm">
                <span class="size">{{ bookSizeCm.width.toFixed(1) }}×{{ bookSizeCm.height.toFixed(1) }} cm</span>
              </template>
              <template v-else>
                <span class="size muted">No size</span>
              </template>

              <span class="dot">•</span>
              <span class="size">Mode {{ viewModeLabel }}</span>

              <span class="dot">•</span>
              <span class="size">
                Scale
                <template v-if="viewMode === 'fit'">Fit</template>
                <template v-else-if="viewMode === 'original'">1:1</template>
                <template v-else>{{ (userScale * 100).toFixed(0) }}%</template>
              </span>

              <span class="dot">•</span>
              <span class="size" :class="{ muted: !voiceSupported }">
                Voice:
                <span v-if="voiceSupported">{{ voiceActive ? "ON" : "OFF" }}</span>
                <span v-else>Not supported</span>
              </span>
            </div>
          </div>
        </div>

        <div class="right">
          <button class="btn" @click="prev" :disabled="pageNo <= 1" title="Prev (← / PgUp)">
            <span class="ico">◀</span>
            <span v-if="!isTiny" class="lbl">Prev</span>
          </button>

          <button class="btn" @click="next" :disabled="pageNo >= pageCount" title="Next (→ / Space / PgDn)">
            <span class="ico">▶</span>
            <span v-if="!isTiny" class="lbl">Next</span>
          </button>

          <!-- Voice control -->
          <button
            class="btn"
            @click="toggleVoice"
            :disabled="!voiceSupported"
            :class="{ active: voiceActive }"
            title="Voice control (Chrome/Edge). Example commands: next, previous, go to page 12, zoom in/out, fit, original, reset, voice off."
          >
            <span class="ico">🎙</span>
            <span v-if="!isTiny" class="lbl">{{ voiceActive ? "Voice ON" : "Voice" }}</span>
          </button>

          <!-- Visualized last command/status -->
          <span v-if="voiceSupported" class="voiceChip" :class="{ on: voiceActive, flash: voiceFlash }" aria-live="polite">
            <span class="dot2" :class="{ ok: voiceActive }"></span>
            <span class="txt">{{ voiceLabel }}</span>
          </span>

          <button v-if="!isTiny && showExit" class="btn danger" @click="exitApp" title="Exit app">
            <span class="ico">⏻</span>
            <span class="lbl">EXIT</span>
          </button>
        </div>
      </div>

      <!-- ROW 2 -->
      <div class="row row2" v-if="!isTiny">
        <div class="group">
          <button class="btn" @click="setViewMode('fit')" :class="{ active: viewMode === 'fit' }" title="Fit page (0)">
            <span class="ico">⤢</span>
            <span class="lbl">Fit</span>
          </button>

          <button
            class="btn"
            @click="setViewMode('original')"
            :class="{ active: viewMode === 'original' }"
            title="Original 1:1 pixels (1)"
          >
            <span class="ico">1:1</span>
            <span class="lbl">Original</span>
          </button>

          <!-- A4/A5 only when server size is missing -->
          <button
            v-if="!bookSizeCm"
            class="btn"
            @click="setFormat('A4')"
            :class="{ active: pageFormat === 'A4' }"
            title="A4 baseline"
          >
            <span class="ico">📄</span>
            <span class="lbl">A4</span>
          </button>

          <button
            v-if="!bookSizeCm"
            class="btn"
            @click="setFormat('A5')"
            :class="{ active: pageFormat === 'A5' }"
            title="A5 baseline"
          >
            <span class="ico">📄</span>
            <span class="lbl">A5</span>
          </button>

          <button class="btn" @click="resetOverlay" title="Reset (O)">
            <span class="ico">↺</span>
            <span class="lbl">Reset</span>
          </button>
        </div>

        <div class="sliders">
          <label class="ctl" title="Custom scale (moving slider switches to Custom)">
            <span class="ctlLbl">Scale</span>
            <input
              class="rng"
              type="range"
              min="0.6"
              max="3"
              step="0.02"
              v-model.number="userScale"
              @input="onScaleInput"
            />
            <span class="val">{{ userScale.toFixed(2) }}</span>
          </label>

          <label class="ctl" title="Image opacity">
            <span class="ctlLbl">Image</span>
            <input class="rng" type="range" min="0.2" max="1" step="0.02" v-model.number="imageAlpha" />
            <span class="val">{{ imageAlpha.toFixed(2) }}</span>
          </label>
        </div>
      </div>
    </header>

    <!-- Page viewport -->
    <div class="viewport">
      <div
        ref="scroller"
        class="scroller"
        :class="{ scrollable: viewMode === 'original' || (viewMode === 'custom' && userScale > 1.0) }"
      >
        <div ref="paperEl" class="paper" :style="paperStyle">
          <img
            ref="imgEl"
            class="page"
            :class="{ blurred: busy }"
            :src="currentUrl"
            decoding="async"
            draggable="false"
            :style="imgStyle"
          />

          <transition :name="transitionName" @after-enter="commitStage">
            <img
              v-if="stagedPage !== null"
              class="page staged"
              :src="stagedUrl"
              decoding="async"
              draggable="false"
              :style="imgStyle"
            />
          </transition>

          <div v-if="lensActive && lensReady" class="lens" :style="lensStyle" aria-hidden="true"></div>
        </div>
      </div>
    </div>

    <!-- Loading dialog -->
    <transition name="modal-fade">
      <div v-if="busy" class="modal" role="dialog" aria-modal="true">
        <div class="dialog">
          <div class="spinner" aria-hidden="true"></div>
          <div class="msg">{{ busyText }}</div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { LruCache } from "../utils/lru";
import { getPageCount, getPageImageUrl, getBookSize, type BookSize } from "../api/booksApi";
import {
  saveProgress,
  loadBookViewSettings,
  saveBookViewSettings,
  type ViewMode as StoredViewMode
} from "../utils/readerSession";
import { isElectron, useBlobPreload } from "../runtime";

const showExit = computed(() => isElectron());

/* ---------- props & events ---------- */
const props = defineProps<{ bookName: string; initialPage?: number }>();
const emit = defineEmits<{ (e: "back"): void }>();

/* ---------- helpers ---------- */
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/* ---------- viewport ---------- */
const vw = ref(window.innerWidth);
const vh = ref(window.innerHeight);
function onResize() {
  vw.value = window.innerWidth;
  vh.value = window.innerHeight;
}
const isTiny = computed(() => vw.value < 720);

/* ---------- overlay ---------- */
const imageAlpha = ref(1.0);
const userScale = ref(1.0);

function resetOverlay() {
  imageAlpha.value = 1.0;
  // Do not destroy remembered custom scale; just reset current view to fit.
  setViewMode("fit");
}

const imgStyle = computed(
  () => ({ opacity: String(clamp(imageAlpha.value, 0.2, 1)) }) as Record<string, string>
);

/* ---------- book size from server (cm) ---------- */
const bookSizeCm = ref<BookSize | null>(null);

/* ---------- A4/A5 fallback (cm) ---------- */
const A4 = { width: 21.0, height: 29.7 };
const A5 = { width: 14.8, height: 21.0 };
const pageFormat = ref<"A4" | "A5">("A4");

const effectiveSizeCm = computed(() => bookSizeCm.value ?? (pageFormat.value === "A4" ? A4 : A5));

/** Baseline scale only if server size missing */
const formatScale = computed(() => {
  if (bookSizeCm.value) return 1.0;
  return pageFormat.value === "A4" ? 0.96 : 0.82;
});

async function setFormat(f: "A4" | "A5") {
  pageFormat.value = f;
  if (viewMode.value === "fit") await fitPage();
  await nextTick();
  syncLensMetrics();
}

/* ---------- mode-aware layout ---------- */
type ViewMode = "fit" | "original" | "custom";
const viewMode = ref<ViewMode>("fit");

const viewModeLabel = computed(() =>
  viewMode.value === "fit" ? "Fit" : viewMode.value === "original" ? "Original" : "Custom"
);

/** last custom scale remembered in-memory for this session */
const lastCustomScale = ref<number>(1.0);

/** Persist view settings for current book */
function persistView() {
  const customScaleToStore = clamp(lastCustomScale.value, 0.6, 6.0);
  saveBookViewSettings(props.bookName, { mode: viewMode.value as StoredViewMode, customScale: customScaleToStore });
}

async function setViewMode(mode: ViewMode) {
  viewMode.value = mode;

  if (mode === "fit") {
    await fitPage();
  } else if (mode === "original") {
    await setOriginalSize();
  } else {
    // custom: restore last custom scale
    userScale.value = clamp(lastCustomScale.value || 1.0, 0.6, 6.0);
  }

  await nextTick();
  syncLensMetrics();
  scroller.value?.scrollTo({ top: 0, left: 0 });

  // persist mode (keeping lastCustomScale)
  persistView();
}

/* slider input switches to custom mode and stores lastCustomScale */
async function onScaleInput() {
  lastCustomScale.value = clamp(userScale.value, 0.6, 6.0);

  if (viewMode.value !== "custom") viewMode.value = "custom";

  // persist on each slider move
  persistView();

  await nextTick();
  syncLensMetrics();
}

/* ---------- paper sizing ---------- */
function headerHeightPx() {
  return isTiny.value ? 64 : 116;
}

const paperEl = ref<HTMLDivElement | null>(null);
const imgEl = ref<HTMLImageElement | null>(null);
const scroller = ref<HTMLDivElement | null>(null);

/** Baseline paper width at userScale=1 (for stable Original) */
const basePaperWidthAtScale1 = ref<number | null>(null);

async function captureBaselineWidthIfNeeded() {
  if (basePaperWidthAtScale1.value != null) return;
  const paper = paperEl.value;
  if (!paper) return;

  const saved = userScale.value;
  userScale.value = 1.0;
  await nextTick();

  const w = paper.getBoundingClientRect().width;
  if (w > 0) basePaperWidthAtScale1.value = w;

  userScale.value = saved;
  await nextTick();
}

const paperStyle = computed(() => {
  const s = effectiveSizeCm.value;
  const ratio = s.width / s.height;

  const pad = isTiny.value ? 10 * 2 : 16 * 2;
  const availW = Math.max(280, vw.value - pad);
  const availH = Math.max(280, vh.value - headerHeightPx() - pad);

  const baselineW = availW * formatScale.value;

  const scale = viewMode.value === "fit" ? 1.0 : clamp(userScale.value, 0.6, 6.0);
  const scaledW = baselineW * scale;

  const constrainHeight = viewMode.value === "fit" || scale <= 1.0;
  const maxWByH = constrainHeight ? availH * ratio : Number.POSITIVE_INFINITY;

  const paperW = clamp(Math.floor(Math.min(scaledW, maxWByH)), 280, 20000);

  return {
    width: `${paperW}px`,
    aspectRatio: `${s.width} / ${s.height}`,
    backgroundColor: "rgba(17,17,17,0.55)"
  } as Record<string, string>;
});

/* ---------- Fit page ---------- */
async function fitPage() {
  await nextTick();

  const s = effectiveSizeCm.value;
  const ratio = s.width / s.height;

  const pad = isTiny.value ? 10 * 2 : 16 * 2;
  const availW = Math.max(280, vw.value - pad);
  const availH = Math.max(280, vh.value - headerHeightPx() - pad);

  const baselineW = availW * formatScale.value;
  const maxWByH = availH * ratio;

  const targetW = Math.min(availW, maxWByH);

  const fitScale = clamp(targetW / baselineW, 0.6, 6.0);
  userScale.value = fitScale;
}

/* ---------- Original size (stable) ---------- */
async function setOriginalSize() {
  await nextTick();
  await captureBaselineWidthIfNeeded();

  const img = imgEl.value;
  const baseW = basePaperWidthAtScale1.value;
  if (!img || !baseW) return;

  const nw = img.naturalWidth;
  if (!nw) return;

  userScale.value = clamp(nw / baseW, 0.6, 6.0);
}

/* ---------- persistence ---------- */
const pageCount = ref(0);
const pageNo = ref(1);
function remember() {
  saveProgress(props.bookName, pageNo.value);
}

/* ---------- LRU preload ---------- */
type Cached = { url: string; img?: HTMLImageElement };
const cache = new LruCache<number, Cached>(5);
const inflight = new Map<number, AbortController>();

function clearCache() {
  inflight.forEach((c) => c.abort());
  inflight.clear();
  cache.clear();
}

async function preload(page: number) {
  if (page < 1 || page > pageCount.value) return;
  if (cache.get(page)) return;
  if (inflight.has(page)) return;

  const ctrl = new AbortController();
  inflight.set(page, ctrl);

  try {
    const url = getPageImageUrl(props.bookName, page);

    if (!useBlobPreload()) {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image preload failed"));
        img.src = url;
      });
      cache.set(page, { url });
      return;
    }

    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} while loading image`);
    const blob = await res.blob();

    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "async";
    img.src = objUrl;

    try {
      await img.decode();
    } catch {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image failed to load"));
      });
    }

    const { evicted } = cache.set(page, { url: objUrl, img });
    evicted.forEach(([, e]) => {
      if (e.url.startsWith("blob:")) URL.revokeObjectURL(e.url);
    });
  } finally {
    inflight.delete(page);
  }
}

/* ---------- URLs ---------- */
const stagedPage = ref<number | null>(null);
const currentUrl = computed(() => cache.get(pageNo.value)?.url ?? getPageImageUrl(props.bookName, pageNo.value));
const stagedUrl = computed(() =>
  stagedPage.value == null ? "" : cache.get(stagedPage.value)?.url ?? getPageImageUrl(props.bookName, stagedPage.value)
);

/* ---------- navigation & transitions ---------- */
const busy = ref(false);
const busyText = ref("");

const stageDir = ref<"next" | "prev">("next");
const transitionName = computed(() => (stageDir.value === "next" ? "page-slide-next" : "page-slide-prev"));

async function goTo(p: number) {
  if (busy.value) return;
  if (p < 1 || p > pageCount.value) return;
  if (p === pageNo.value) return;

  stageDir.value = p > pageNo.value ? "next" : "prev";
  busy.value = true;
  busyText.value = `Loading page ${p}…`;
  stagedPage.value = p;

  try {
    await preload(p);
    preload(p + 1);
    preload(p - 1);
  } catch (e) {
    console.error(e);
    stagedPage.value = null;
    busy.value = false;
    busyText.value = "";
  }
}

function commitStage() {
  if (stagedPage.value != null) pageNo.value = stagedPage.value;
  stagedPage.value = null;
  busy.value = false;
  busyText.value = "";

  remember();
  nextTick(async () => {
    await captureBaselineWidthIfNeeded();
    syncLensMetrics();
  });
  scroller.value?.scrollTo({ top: 0 });
}

function prev() {
  goTo(pageNo.value - 1);
}
function next() {
  goTo(pageNo.value + 1);
}

/* ---------- back ---------- */
function onBack() {
  if (busy.value) return;
  remember();
  emit("back");
}

/* ---------- lens (rendered image box) ---------- */
const lensActive = computed(() => false); // lens disabled in this slimmed version
const lensReady = ref(false);
const lensStyle = computed(() => ({} as Record<string, string>));
function syncLensMetrics() {
  // no-op (lens disabled)
}

/* ---------- mouse ---------- */
function onMouseMove(_e: MouseEvent) {
  // lens disabled
}

/* ---------- keyboard ---------- */
function onKeyDown(e: KeyboardEvent) {
  if (busy.value && e.key !== "Escape") return;

  switch (e.key) {
    case "Escape":
      e.preventDefault();
      onBack();
      break;

    case "ArrowLeft":
    case "PageUp":
      e.preventDefault();
      prev();
      break;

    case "ArrowRight":
    case "PageDown":
    case " ":
      e.preventDefault();
      next();
      break;

    case "Home":
      e.preventDefault();
      goTo(1);
      break;

    case "End":
      e.preventDefault();
      goTo(pageCount.value);
      break;

    case "0":
      e.preventDefault();
      setViewMode("fit");
      break;

    case "1":
      e.preventDefault();
      setViewMode("original");
      break;

    case "2":
      e.preventDefault();
      viewMode.value = "custom";
      userScale.value = clamp(lastCustomScale.value || userScale.value || 1.0, 0.6, 6.0);
      persistView();
      break;

    case "+":
    case "=":
      e.preventDefault();
      viewMode.value = "custom";
      userScale.value = clamp(userScale.value + 0.05, 0.6, 6.0);
      lastCustomScale.value = userScale.value;
      persistView();
      break;

    case "-":
      e.preventDefault();
      viewMode.value = "custom";
      userScale.value = clamp(userScale.value - 0.05, 0.6, 6.0);
      lastCustomScale.value = userScale.value;
      persistView();
      break;

    case "f":
    case "F":
      if (!bookSizeCm.value) {
        e.preventDefault();
        setFormat(pageFormat.value === "A4" ? "A5" : "A4");
      }
      break;

    case "o":
    case "O":
      e.preventDefault();
      resetOverlay();
      break;
  }
}

function onKeyUp(_e: KeyboardEvent) {
  // no-op
}

/* ---------- Electron exit ---------- */
async function exitApp() {
  await (window as any).readerWindow?.exitApp?.();
}

/* ---------- voice: UI visualization ---------- */
const voiceLabel = ref<string>("Idle");
const voiceFlash = ref(false);

function setVoiceLabel(s: string, flash = false) {
  voiceLabel.value = s;
  if (flash) {
    voiceFlash.value = true;
    window.setTimeout(() => (voiceFlash.value = false), 220);
  }
}

/* ---------- voice control (Web Speech API) ---------- */
const voiceSupported = computed(() => Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
const voiceActive = ref(false);

let rec: SpeechRecognition | null = null;
let restarting = false;
let stopping = false;

function getSpeechRecognitionCtor(): any | null {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function normalizeCmd(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function applyVoiceCommand(textRaw: string) {
  const t = normalizeCmd(textRaw);

  // allow turning voice off even while busy
  if (busy.value && !t.includes("stop voice") && !t.includes("voice off")) return;

  // voice on/off
  if (t.includes("stop voice") || t.includes("voice off")) {
    setVoiceLabel("Command: VOICE OFF", true);
    stopVoice();
    return;
  }

  // navigation
  if (t === "next" || t.includes("next page") || t === "next page") {
    setVoiceLabel("Command: NEXT", true);
    next();
    return;
  }
  if (t === "previous" || t.includes("previous page") || t.includes("back") || t.includes("prev")) {
    setVoiceLabel("Command: PREV", true);
    prev();
    return;
  }

  // go to page N (supports: "go to page 12", "page 12")
  const m = t.match(/go to page (\d+)/) || t.match(/page (\d+)/);
  if (m) {
    const p = Number(m[1]);
    if (Number.isFinite(p)) {
      setVoiceLabel(`Command: GOTO ${p}`, true);
      goTo(p);
    } else {
      setVoiceLabel("Heard page number (invalid)", true);
    }
    return;
  }

  // modes
  if (t.includes("fit")) {
    setVoiceLabel("Command: FIT", true);
    setViewMode("fit");
    return;
  }
  if (t.includes("original")) {
    setVoiceLabel("Command: ORIGINAL", true);
    setViewMode("original");
    return;
  }
  if (t.includes("reset")) {
    setVoiceLabel("Command: RESET", true);
    resetOverlay();
    return;
  }

  // zoom (scale)
  if (t.includes("zoom in") || t === "bigger") {
    setVoiceLabel("Command: ZOOM IN", true);
    viewMode.value = "custom";
    userScale.value = clamp(userScale.value + 0.08, 0.6, 6.0);
    lastCustomScale.value = userScale.value;
    persistView();
    return;
  }
  if (t.includes("zoom out") || t === "smaller") {
    setVoiceLabel("Command: ZOOM OUT", true);
    viewMode.value = "custom";
    userScale.value = clamp(userScale.value - 0.08, 0.6, 6.0);
    lastCustomScale.value = userScale.value;
    persistView();
    return;
  }

  setVoiceLabel(`Heard: ${textRaw}`, false);
}

async function startVoice() {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    setVoiceLabel("Voice not supported", true);
    alert("Speech recognition is not supported in this browser. Try Chrome or Edge.");
    return;
  }

  // stop old instance if any
  stopping = true;
  try {
    rec?.stop();
  } catch {}
  rec = null;
  stopping = false;

  // Must be triggered by user gesture; also forces mic permission prompt
  await navigator.mediaDevices.getUserMedia({ audio: true });

  const r: SpeechRecognition = new Ctor();
  rec = r;

  r.continuous = true;
  r.interimResults = false;

  // Choose language (adjust as you like)
  // Good candidates: "en-US", "sr-RS", "hr-HR", "ru-RU"
  r.lang = "en-US";

  r.onresult = (e: any) => {
    const rr = e.results?.[e.resultIndex];
    if (!rr?.isFinal) return;

    const txt = rr[0]?.transcript ?? "";
    if (!txt) return;

    setVoiceLabel(`Heard: ${txt}`, false);
    applyVoiceCommand(txt);
  };

  r.onerror = (e: any) => {
    const err = e?.error ?? e;

    // common, harmless in stop/restart flows
    if (err === "aborted" || err === "no-speech") return;

    console.warn("SpeechRecognition error:", err);
    setVoiceLabel(`Error: ${String(err)}`, true);

    if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture") {
      stopVoice();
    }
  };

  r.onend = () => {
    // If user turned it off (or we are stopping), do not restart.
    if (!voiceActive.value || stopping) return;

    // Chrome can end after a pause → restart gently
    if (!restarting) {
      restarting = true;
      setTimeout(() => {
        restarting = false;
        if (!voiceActive.value || stopping) return;
        try {
          rec?.start();
        } catch {
          // ignore rapid restart errors
        }
      }, 350);
    }
  };

  try {
    r.start();
    voiceActive.value = true;
    setVoiceLabel("Listening…", true);
  } catch (err) {
    console.warn("SpeechRecognition start failed:", err);
    setVoiceLabel("Start failed", true);
    stopVoice();
  }
}

function stopVoice() {
  voiceActive.value = false;
  stopping = true;
  setVoiceLabel("Voice OFF", true);

  try {
    rec?.stop();
  } catch {}
  rec = null;

  // release stopping flag a bit later (Chrome async end)
  setTimeout(() => {
    stopping = false;
  }, 400);
}

async function toggleVoice() {
  if (voiceActive.value) stopVoice();
  else await startVoice();
}

/* Pause voice when tab loses visibility (common during casting / switching) */
function onVisibility() {
  if (document.visibilityState !== "visible" && voiceActive.value) {
    setVoiceLabel("Voice paused (tab hidden)", true);
    stopVoice();
  }
}

/* ---------- lifecycle ---------- */
async function loadBook() {
  busy.value = true;
  busyText.value = "Loading book…";
  clearCache();
  basePaperWidthAtScale1.value = null;

  pageCount.value = await getPageCount(props.bookName);

  // server size
  bookSizeCm.value = null;
  try {
    const s = await getBookSize(props.bookName);
    if (s && Number.isFinite(s.width) && Number.isFinite(s.height) && s.width > 0 && s.height > 0) {
      bookSizeCm.value = s;
    }
  } catch {
    bookSizeCm.value = null;
  }

  // restore view settings (mode + last custom scale)
  const vs = loadBookViewSettings(props.bookName);
  if (vs) {
    lastCustomScale.value = clamp(vs.customScale, 0.6, 6.0);
    if (vs.mode === "custom") userScale.value = lastCustomScale.value;
    viewMode.value = (vs.mode as ViewMode) || "fit";
  } else {
    viewMode.value = "fit";
    lastCustomScale.value = 1.0;
  }

  // start page
  const start = clamp(Math.floor(Number(props.initialPage ?? 1) || 1), 1, pageCount.value);
  pageNo.value = start;

  await preload(start);
  preload(start + 1);
  preload(start - 1);

  busy.value = false;
  busyText.value = "";
  remember();

  // apply restored mode
  if (viewMode.value === "fit") await fitPage();
  if (viewMode.value === "original") await setOriginalSize();
  if (viewMode.value === "custom") userScale.value = lastCustomScale.value;

  // persist (ensure store exists)
  persistView();
}

watch(() => [props.bookName, props.initialPage] as const, loadBook, { immediate: true });

onMounted(() => {
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);

  watch(userScale, () => {
    if (viewMode.value === "custom") {
      lastCustomScale.value = clamp(userScale.value, 0.6, 6.0);
      persistView();
    }
  });

  setVoiceLabel(voiceSupported.value ? "Idle" : "Voice not supported", false);
});

onBeforeUnmount(() => {
  stopVoice(); // cleanup mic session

  window.removeEventListener("resize", onResize);
  document.removeEventListener("visibilitychange", onVisibility);

  remember();
  clearCache();
});
</script>

<style scoped>
.reader-root {
  --bar-pad-y: 10px;
  --bar-pad-x: 12px;
  --btn-pad-y: 9px;
  --btn-pad-x: 12px;
  --btn-radius: 12px;
  --btn-font: 14px;
  --title-font: 14px;
  --meta-font: 13px;
  --gap-1: 10px;
  --gap-2: 12px;
  --slider-w: 160px;
  --paper-pad: 16px;

  height: 100vh;
  display: flex;
  flex-direction: column;
  background: transparent;
  color: #eee;
  outline: none;
}

.topbar {
  display: flex;
  flex-direction: column;
  gap: var(--gap-1);
  padding: var(--bar-pad-y) var(--bar-pad-x);
  background: rgba(21, 21, 21, 0.72);
  backdrop-filter: blur(10px);
  z-index: 20;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-2);
  flex-wrap: wrap;
}

.left {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
  min-width: 260px;
  flex: 1 1 auto;
}

.title {
  min-width: 160px;
  flex: 1 1 auto;
}

.title .book {
  font-weight: 800;
  font-size: var(--title-font);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title .meta {
  opacity: 0.9;
  font-size: var(--meta-font);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dot {
  opacity: 0.55;
}

.size {
  opacity: 0.9;
}

.size.muted {
  opacity: 0.7;
}

.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  flex-wrap: wrap;
}

.row2 {
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}

.group {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sliders {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex: 1 1 auto;
  min-width: 280px;
}

.btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #eee;
  padding: var(--btn-pad-y) var(--btn-pad-x);
  border-radius: var(--btn-radius);
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  line-height: 1;
  font-size: var(--btn-font);
}

.btn:hover:enabled {
  background: rgba(255, 255, 255, 0.11);
}

.btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.btn.active {
  background: rgba(42, 42, 42, 0.85);
  font-weight: 700;
}

.btn.danger {
  border-color: rgba(255, 80, 80, 0.4);
  background: rgba(255, 80, 80, 0.14);
}

.btn.danger:hover:enabled {
  background: rgba(255, 80, 80, 0.22);
}

.ico {
  width: 1.2em;
  text-align: center;
  opacity: 0.95;
}

.lbl {
  opacity: 0.96;
}

.ctl {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  opacity: 0.96;
}

.ctlLbl {
  min-width: 46px;
  text-align: right;
  opacity: 0.9;
}

.rng {
  width: var(--slider-w);
  height: 18px;
}

.val {
  min-width: 46px;
  text-align: right;
  opacity: 0.9;
}

.viewport {
  flex: 1;
  overflow: hidden;
}

.scroller {
  height: 100%;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: var(--paper-pad);
}

.scroller.scrollable {
  justify-content: flex-start;
}

.paper {
  position: relative;
  flex: 0 0 auto;
  border-radius: 12px;
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.62);
  outline: 1px solid rgba(255, 255, 255, 0.12);
}

.page {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: opacity 160ms ease, filter 160ms ease;
}

.page.blurred {
  filter: blur(2px) brightness(0.82);
}

.staged {
  z-index: 2;
}

.page-slide-next-enter-active {
  transition: transform 220ms ease, opacity 220ms ease;
}

.page-slide-next-enter-from {
  transform: translateX(22px);
  opacity: 0;
}

.page-slide-prev-enter-active {
  transition: transform 220ms ease, opacity 220ms ease;
}

.page-slide-prev-enter-from {
  transform: translateX(-22px);
  opacity: 0;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 160ms ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 9999;
}

.dialog {
  background: rgba(28, 28, 28, 0.88);
  padding: 20px 28px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
}

.spinner {
  width: 22px;
  height: 22px;
  border: 3px solid rgba(102, 102, 102, 0.9);
  border-top-color: rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.msg {
  font-size: 14px;
  opacity: 0.96;
}

/* ---------- voice chip ---------- */
.voiceChip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.95;
  max-width: 340px;
}

.voiceChip.on {
  background: rgba(80, 255, 160, 0.08);
  border-color: rgba(80, 255, 160, 0.22);
}

.voiceChip .dot2 {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  flex: 0 0 auto;
}

.voiceChip .dot2.ok {
  background: rgba(80, 255, 160, 0.85);
}

.voiceChip .txt {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voiceChip.flash {
  transform: translateY(-1px);
  filter: brightness(1.18);
}
</style>
