/*
 * Demo-Speicherung — und der Hinweis, wenn sie veraltet ist.
 *
 * Diese Datei gehoert NUR zur Vorfuehr-Fassung. Sie haelt Aenderungen im
 * lokalen Browser-Speicher fest, damit eine Vorfuehrung ein Neuladen
 * uebersteht. Die echte Datenbank und die echte Website bleiben unberuehrt.
 *
 * QA-BEFUND 17.09.2026: im Rahmen der Praesentation zeigte die Website 28
 * Referenzen mit "Nox Club" und "Aftersun Festival" — die Verwaltung daneben
 * "gespeichert 05.08.2026" und genau einen historischen Termin ("Test",
 * 29.08.). Zwei Staende nebeneinander, ohne dass irgendetwas darauf hinwies.
 *
 * URSACHE, im Code nachgelesen: `restore()` hat den lokal gespeicherten Stand
 * UNBESEHEN ueber den eben geladenen gelegt — egal wie alt er war und ohne
 * es zu sagen. Wer die Demo im August einmal geoeffnet hat, sieht seither
 * seinen August-Stand. Das Laden selbst war richtig: ohne lokalen Stand holt
 * `loadForDemo()` in store.js den aktuellen Inhalt.
 *
 * WAS SICH AENDERT — und was ausdruecklich nicht:
 *
 *   · Der lokale Stand wird weiterhin GELADEN und NIE von selbst geloescht.
 *     Wer in der Vorfuehrung etwas geaendert hat, findet es wieder.
 *   · Ist die Quelle neuer als der lokale Stand, steht das jetzt sichtbar da
 *     — mit beiden Datumsangaben, damit man weiss, was man sieht.
 *   · Der Knopf "Aktuellen Website-Stand laden" holt ihn, aber erst nach
 *     einer Rueckfrage: davor wird gesagt, dass die lokalen Demo-Aenderungen
 *     dabei verloren gehen.
 *   · Am Vorfuehr-Modus aendert sich nichts: kein Schreiben in die
 *     Produktion, kein Versand, keine Kasse.
 */
import { S, onChange, emit } from "./store.js";
import { DEMO } from "./config.js";
import { el, toast, confirmDialog } from "./util.js";
import { standVergleich, lesbar } from "./demo-stand.js";

const KEY = "samsparking-demo-content-v1";
const META_KEY = "samsparking-demo-meta-v1";

if (DEMO) {
  // `?resetDemo=1` wirft den lokal gespeicherten Stand weg, bevor irgendetwas
  // davon zurückgeholt wird — die Vorführung fängt dann wieder beim echten
  // Inhalt an. Die Adresse wird gleich wieder sauber gemacht, damit ein
  // späteres Neuladen nicht erneut zurücksetzt.
  const params = new URLSearchParams(location.search);
  if (params.get("resetDemo") === "1") {
    localStorage.removeItem(KEY);
    localStorage.removeItem(META_KEY);
    params.delete("resetDemo");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
  }

  let bootstrapped = false;
  let timer = 0;
  /* Der Stand, den die Verwaltung beim Laden von der Quelle bekommen hat —
     festgehalten, BEVOR der lokale Stand darueber gelegt wird. Nur so kann
     der Knopf ihn spaeter holen, ohne noch einmal zu laden. */
  let quelleStand = null;
  let hinweis = null;

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

  /** Den aktuellen Stand der Quelle uebernehmen — nur nach Rueckfrage. */
  const quelleUebernehmen = async () => {
    if (!quelleStand) return;
    const ja = await confirmDialog(
      "Aktuellen Website-Stand laden?",
      "Die Änderungen, die in dieser Vorführung lokal in diesem Browser gespeichert sind, " +
        "werden dabei verworfen. Die echte Website und die echte Datenbank bleiben unberührt.",
      "Ja, Website-Stand laden"
    );
    if (!ja) return;

    S.content = clone(quelleStand);
    S.saved = clone(quelleStand);
    S.dirty = false;
    S.contentStamp = (S.contentStamp || 0) + 1;
    persist();
    hinweisWeg();
    emit("loaded");
    toast("Aktueller Website-Stand geladen — nur hier in der Vorführung.");
  };

  const hinweisWeg = () => {
    if (hinweis) hinweis.remove();
    hinweis = null;
  };

  /** Der sichtbare Hinweis. Er verschweigt keine der beiden Zahlen. */
  const hinweisZeigen = (vergleich) => {
    if (hinweis) return;
    hinweis = el("div", { class: "demo-alt-hinweis", role: "status" }, [
      el("div", { class: "demo-alt-text" }, [
        el("b", {}, "Älterer Vorführ-Stand"),
        el(
          "span",
          {},
          ` Hier steht der Stand, der lokal in diesem Browser gespeichert ist (vom ${lesbar(
            vergleich.lokalVom
          )}). Die Website ist inzwischen weiter (${lesbar(vergleich.quelleVom)}).`
        ),
      ]),
      el("div", { class: "demo-alt-knoepfe" }, [
        el("button", { class: "btn", type: "button", onclick: quelleUebernehmen },
          "Aktuellen Website-Stand laden"),
        /* Wegklicken aendert NICHTS an den Daten — es blendet nur den Hinweis
           aus. Beim naechsten Laden steht er wieder da, solange der lokale
           Stand aelter ist. */
        el("button", { class: "btn ghost", type: "button", onclick: hinweisWeg, title: "Nur ausblenden" },
          "Lokalen Stand behalten"),
      ]),
    ]);
    document.body.appendChild(hinweis);
  };

  const restore = () => {
    if (!S.content || bootstrapped) return;
    /* ZUERST die Quelle festhalten — gleich liegt der lokale Stand darueber. */
    quelleStand = clone(S.content);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object" && saved.site && saved.sections) {
          const vergleich = standVergleich(saved, quelleStand);
          S.content = saved;
          S.saved = clone(saved);
          S.dirty = false;
          S.contentStamp = (S.contentStamp || 0) + 1;
          bootstrapped = true;
          emit("loaded");
          /* Geloescht wird nichts — es wird nur gesagt. */
          if (vergleich.veraltet) hinweisZeigen(vergleich);
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
