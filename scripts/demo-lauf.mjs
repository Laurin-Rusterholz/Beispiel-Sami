#!/usr/bin/env node
/**
 * Ein Vorfuehr-Durchlauf im Kleinen — fuer scripts/demo-stand.test.mjs.
 *
 * Warum ein EIGENES PROGRAMM statt einer Funktion im Test: `demo-persistence.js`
 * wirkt beim Laden (Listener, Zeitgeber, lokaler Speicher). Zweimal laden geht
 * in einem Prozess nicht — der Modul-Zwischenspeicher gibt beim zweiten Mal
 * dasselbe Modul zurueck, und die Listener des ersten Falls reden im zweiten
 * mit. Jeder Fall bekommt deshalb seinen eigenen Prozess.
 *
 * Aufruf:  node scripts/demo-lauf.mjs '<JSON>'
 *
 *   { quelle:  <Inhalt>,            was die Verwaltung beim Laden bekommt
 *     lokal:   <Inhalt>|null,       was im Browser-Speicher liegt
 *     adresse: "?resetDemo=1"|"",   die Adresszeile
 *     klick:   "laden"|"behalten"|null,
 *     dialog:  "ja"|"nein" }        was im Rueckfrage-Dialog gedrueckt wird
 *
 * Ausgegeben wird EINE Zeile JSON mit dem, was danach zu sehen ist. Geprueft
 * wird im Test, nicht hier.
 */
import { weltAufbauen } from "./mini-dom.mjs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const JS = resolve(HIER, "../verwaltung/js") + "/";
const KEY = "samsparking-demo-content-v1";
const META_KEY = "samsparking-demo-meta-v1";

const auftrag = JSON.parse(process.argv[2] || "{}");

const doc = weltAufbauen();

/* Ein Browser-Speicher, der sich merkt, was mit ihm passiert. */
const speicher = new Map();
const spuren = [];
globalThis.localStorage = {
  getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
  setItem: (k, v) => { spuren.push(["set", k]); speicher.set(k, String(v)); },
  removeItem: (k) => { spuren.push(["remove", k]); speicher.delete(k); },
};
if (auftrag.lokal) speicher.set(KEY, JSON.stringify(auftrag.lokal));
if (auftrag.lokal) speicher.set(META_KEY, JSON.stringify({ savedAt: "2026-08-05T10:00:00.000Z" }));

globalThis.window.location = {
  href: "http://localhost/verwaltung/" + (auftrag.adresse || ""),
  pathname: "/verwaltung/",
  search: auftrag.adresse || "",
  hash: "",
};
globalThis.location = globalThis.window.location;
globalThis.history = { replaceState() {} };

const { S } = await import(JS + "store.js");
S.content = JSON.parse(JSON.stringify(auftrag.quelle));
S.saved = JSON.parse(JSON.stringify(auftrag.quelle));

await import(JS + "demo-persistence.js");

const atmen = () => new Promise((f) => setTimeout(f, 20));
await atmen();

/** Einen Knopf an seiner Aufschrift finden. */
const knopf = (text, wurzel = doc.body) =>
  wurzel.querySelectorAll("button").find((b) => b.textContent.includes(text)) || null;

const balken = () => doc.body.querySelectorAll("div").find((d) => d.className === "demo-alt-hinweis") || null;
const dialog = () => doc.body.querySelectorAll("div").find((d) => d.className === "modal") || null;

const vorher = {
  hinweis: balken() ? balken().textContent : null,
  knoepfe: balken() ? balken().querySelectorAll("button").map((b) => b.textContent) : [],
};

let dialogTitel = null;
if (auftrag.klick) {
  const b = knopf(auftrag.klick === "laden" ? "Aktuellen Website-Stand laden" : "Lokalen Stand behalten");
  if (b) b.click();
  await atmen();
  const d = dialog();
  if (d) {
    dialogTitel = (d.querySelectorAll("h3")[0] || { textContent: "" }).textContent;
    const ja = knopf("Ja, Website-Stand laden", d);
    const nein = knopf("Abbrechen", d);
    const ziel = auftrag.dialog === "ja" ? ja : nein;
    if (ziel) ziel.click();
    await atmen();
  }
}
await atmen();

const gespeichert = speicher.has(KEY) ? JSON.parse(speicher.get(KEY)) : null;
const namen = (c) => (c?.sections?.shows?.items || []).map((i) => i.name);

process.stdout.write(JSON.stringify({
  hinweisVorher: vorher.hinweis,
  knoepfe: vorher.knoepfe,
  hinweisNachher: balken() ? balken().textContent : null,
  dialogTitel,
  inhaltVom: S.content?.updatedAt || "",
  inhaltShows: namen(S.content),
  gespeichertVom: gespeichert?.updatedAt || "",
  gespeichertShows: namen(gespeichert),
  speicherDa: speicher.has(KEY),
  metaDa: speicher.has(META_KEY),
  entfernt: spuren.filter((s) => s[0] === "remove").map((s) => s[1]),
  dirty: S.dirty === true,
}));
