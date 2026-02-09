<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import BookChooser from "./components/BookChooser.vue";
import BookReader from "./components/BookReader.vue";
import { loadLastOpened, loadProgress } from "./utils/readerSession";

const selectedBook = ref<string>("");
const initialPage = ref<number>(1);

const hasSelectedBook = computed(() => selectedBook.value.trim().length > 0);

onMounted(() => {
  // Auto-open last opened book (if any)
  const last = loadLastOpened();
  if (last) {
    selectedBook.value = last.bookName;
    initialPage.value = last.pageNo;
  } else {
    selectedBook.value = "";
    initialPage.value = 1;
  }
});

function onSelectBook(bookName: string) {
  const name = String(bookName ?? "").trim();
  if (!name) return;

  selectedBook.value = name;

  // ✅ IMPORTANT: restore saved page for that book
  const p = loadProgress(name);
  initialPage.value = p?.pageNo && p.pageNo > 0 ? p.pageNo : 1;
}

function onBack() {
  selectedBook.value = "";
  // keep initialPage as-is (not important)
}
</script>

<template>
  <BookReader
    v-if="hasSelectedBook"
    :bookName="selectedBook"
    :initialPage="initialPage"
    @back="onBack"
  />

  <BookChooser
    v-else
    @select="onSelectBook"
  />
</template>
