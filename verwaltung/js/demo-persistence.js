import { S, onChange, emit } from "./store.js";
import { DEMO } from "./config.js";

const KEY = "samsparkling-demo-content-v1";
const META_KEY = "samsparkling-demo-meta-v1";

if (DEMO) {
  let bootstrapped = false;
  let timer = 0;

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const persist = () => {
    if (!S.content || !bootstrapped) return;
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
    if (!S.content || bootstrapped) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object" && saved.site && saved.sections) {
          S.content = saved;
          S.saved = clone(saved);
          S.dirty = false;
          S.contentStamp = (S.contentStamp || 0) + 1;
          bootstrapped = true;
          emit("loaded");
          return;
        }
      }
    } catch (error) {
      console.warn("Gespeicherter Demo-Inhalt konnte nicht geladen werden:", error);
    }

    bootstrapped = true;
    persist();
  };

  const schedulePersist = (delay = 120) => {
    if (!bootstrapped) return;
    clearTimeout(timer);
    timer = setTimeout(persist, delay);
  };

  onChange((what) => {
    if (!bootstrapped && S.content) {
      queueMicrotask(restore);
      return;
    }
    if (!bootstrapped) return;
    schedulePersist(what === "dirty" ? 180 : 60);
  });

  // app.js kann den Store bereits geladen haben, bevor dieses Modul seinen
  // Listener registriert. In diesem Fall den vorhandenen Zustand sofort
  // übernehmen, statt für immer auf ein bereits verpasstes "loaded" zu warten.
  if (S.content) queueMicrotask(restore);
  else {
    const waitForStore = setInterval(() => {
      if (!S.content) return;
      clearInterval(waitForStore);
      restore();
    }, 25);
    setTimeout(() => clearInterval(waitForStore), 10000);
  }

  document.addEventListener("input", () => schedulePersist(180), true);
  document.addEventListener("change", () => schedulePersist(0), true);
  window.addEventListener("pagehide", persist);
  window.addEventListener("beforeunload", persist);

  window.addEventListener("storage", (event) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      const saved = JSON.parse(event.newValue);
      if (saved && saved.site && saved.sections) {
        S.content = saved;
        S.saved = clone(saved);
        S.dirty = false;
        S.contentStamp = (S.contentStamp || 0) + 1;
        bootstrapped = true;
        emit("loaded");
      }
    } catch (_) {}
  });
}
