<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { getBookNames } from "../api/booksApi";
import { loadStore, loadProgress } from "../utils/readerSession";

import { isElectron } from "../runtime";



const showExit = computed(() => isElectron());





const emit = defineEmits<{
  (e: "select", bookName: string): void;
}>();

const loading = ref(false);
const error = ref<string | null>(null);

const selected = ref<string>("");

const recentBooks = ref<string[]>([]);
const otherBooks = ref<string[]>([]);



async function load() {
  loading.value = true;
  error.value = null;

  try {
    const names = await getBookNames();

    const store = loadStore();
    const tsByName = new Map<string, number>(
      Object.entries(store.books).map(([name, p]) => [name, Number(p?.ts) || 0])
    );

    const withTs = names.map((name) => ({
      name,
      ts: tsByName.get(name) || 0,
    }));

    recentBooks.value = withTs
      .filter((x) => x.ts > 0)
      .sort((a, b) => b.ts - a.ts)
      .map((x) => x.name);

    otherBooks.value = withTs
      .filter((x) => x.ts === 0)
      .map((x) => x.name)
      .sort((a, b) => a.localeCompare(b));

    selected.value = recentBooks.value[0] ?? otherBooks.value[0] ?? "";
  } catch (e: any) {
    error.value = e?.message ?? String(e);
    recentBooks.value = [];
    otherBooks.value = [];
    selected.value = "";
  } finally {
    loading.value = false;
  }
}

function choose() {
  const v = String(selected.value ?? "").trim();
  if (v) emit("select", v);
}

function fmtProgress(bookName: string): string {
  const p = loadProgress(bookName);
  if (!p || !p.pageNo) return "";
  return ` — p. ${p.pageNo}`;
}

const selectedProgress = computed(() => {
  const v = String(selected.value ?? "").trim();
  return v ? loadProgress(v) : null;
});

async function exitApp() {
  // Electron: available; Vite-only browser: undefined => no-op
  await window.readerWindow?.exitApp?.();
}

onMounted(load);
</script>

<template>
  <div class="wrap">
    <div class="card">
      <div class="headerRow">
        <h2>Choose book</h2>
        <div class="actions">
          
          <button v-if="showExit" class="btn danger" @click="exitApp" title="Exit app">
            EXIT
          </button>
        </div>
      </div>

      <div v-if="loading" class="muted">Loading books…</div>

      <div v-else-if="error" class="error">
        <div class="errorText">{{ error }}</div>
        <button class="btn" @click="load">Retry</button>
      </div>

      <div v-else class="chooser">
        <select v-model="selected" class="select" :disabled="recentBooks.length + otherBooks.length === 0">
          <optgroup v-if="recentBooks.length" label="Recently read">
            <option v-for="b in recentBooks" :key="'r-' + b" :value="b">
              {{ b }}{{ fmtProgress(b) }}
            </option>
          </optgroup>

          <optgroup v-if="otherBooks.length" label="All books">
            <option v-for="b in otherBooks" :key="'a-' + b" :value="b">
              {{ b }}
            </option>
          </optgroup>
        </select>

        <button class="btn primary" :disabled="!selected" @click="choose">
          Read
        </button>
      </div>

      <p v-if="selectedProgress" class="muted small">
        Resume point: <b>page {{ selectedProgress.pageNo }}</b>
      </p>
      <p v-else class="muted small">
        No saved progress for this book yet.
      </p>

      <p class="muted small">
        Base URL is taken from <code>VITE_BOOKS_BASE_URL</code>.
      </p>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: transparent;
  /* was #0f0f0f */
  color: #eee;
}


.card {
  width: min(92vw, 740px);
  padding: 18px;
  border: 1px solid #333;
  border-radius: 14px;
  background: #101010;
  color: #eee;
}

.headerRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chooser {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
}

.select {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #444;
  background: #111;
  color: #eee;
}

.btn {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid #444;
  background: #1a1a1a;
  color: #eee;
  cursor: pointer;
  user-select: none;
}

.btn.primary {
  border-color: #666;
  background: #222;
}

.btn.danger {
  border-color: rgba(255, 80, 80, 0.35);
  background: rgba(255, 80, 80, 0.12);
}

.btn.danger:hover:enabled {
  background: rgba(255, 80, 80, 0.18);
}

.btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.muted {
  opacity: 0.8;
}

.small {
  font-size: 12px;
}

.error {
  display: flex;
  gap: 12px;
  align-items: center;
}

.errorText {
  flex: 1;
}
</style>
