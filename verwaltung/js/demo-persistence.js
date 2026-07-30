import { S, onChange, emit } from "./store.js";
import { DEMO } from "./config.js";

const KEY = "samsparkling-demo-content-v1";
const META_KEY = "samsparkling-demo-meta-v1";

if (DEMO) {
  let loaded = false;
  let timer = 0;

  const persist = () => {
    if (!S.content || !loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(S.content));
      localStorage.setItem(
        META_KEY,
        JSON.stringify({ savedAt: new Date().toISOString(), source: "presentation-demo" })
      );
    } catch (error) {
      console.warn("Demo-Inhalt konnte nicht lokal gespeichert werden:", error);
    }
  };

  const restore = () => {
    if (!S.content) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object" && saved.site && saved.sections) {
          S.content = saved;
          S.saved = JSON.parse(JSON.stringify(saved));
          S.dirty = false;
          S.contentStamp = (S.contentStamp || 0) + 1;
          emit("loaded");
        }
      }
    } catch (error) {
      console.warn("Gespeicherter Demo-Inhalt konnte nicht geladen werden:", error);
    }
    loaded = true;
    persist();
  };

  onChange((what) => {
    if (what === "loaded" && !loaded) {
      queueMicrotask(restore);
      return;
    }
    if (!loaded) return;
    clearTimeout(timer);
    timer = setTimeout(persist, what === "dirty" ? 250 : 60);
  });

  document.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(persist, 250);
  }, true);
  document.addEventListener("change", persist, true);
  window.addEventListener("pagehide", persist);
  window.addEventListener("beforeunload", persist);

  window.addEventListener("storage", (event) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      const saved = JSON.parse(event.newValue);
      if (saved && saved.site && saved.sections) {
        S.content = saved;
        S.saved = JSON.parse(JSON.stringify(saved));
        S.dirty = false;
        S.contentStamp = (S.contentStamp || 0) + 1;
        emit("loaded");
      }
    } catch (_) {}
  });
}
