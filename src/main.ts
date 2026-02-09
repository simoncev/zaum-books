import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
import { initPwaInstallCapture } from "./pwaInstall";
import { isElectron } from "./runtime";

createApp(App).mount("#app");


