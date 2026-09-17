/**
 * Der Vorführ-Stand: geladen, nie stillschweigend gelöscht — und es steht da,
 * wenn er alt ist.
 *
 * QA-BEFUND 17.09.2026 (pre-present-djsamsparkling): im Rahmen zeigte das
 * Website-Fenster 28 Referenzen mit „Nox Club“ und „Aftersun Festival“, das
 * Verwaltungs-Fenster daneben „gespeichert 05.08.2026“ und genau einen
 * historischen Termin („Test“, 29.08.). Zwei Stände nebeneinander, ohne dass
 * irgendetwas darauf hinwies.
 *
 * URSACHE, im Code nachgelesen (`verwaltung/js/demo-persistence.js`):
 * `restore()` legte den lokal gespeicherten Stand UNBESEHEN über den eben
 * geladenen — egal wie alt, und ohne es zu sagen. Das Laden selbst war
 * richtig: ohne lokalen Stand holt `loadForDemo()` (store.js) den aktuellen
 * Inhalt. Es fehlte nicht das Laden, es fehlte der Hinweis und der Weg zurück.
 *
 * Geprüft wird die ECHTE Datei, ausgeführt gegen ein Mini-DOM und einen
 * Browser-Speicher, der mitschreibt, was mit ihm passiert — je Fall in einem
 * eigenen Prozess (siehe scripts/demo-lauf.mjs).
 *
 *   node --test scripts/demo-stand.test.mjs      (oder: npm test)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const HIER = dirname(fileURLToPath(import.meta.url));
const LAUF = join(HIER, "demo-lauf.mjs");
const ausfuehren = promisify(execFile);

/* Der Stand der Quelle und der alte lokale Stand — den Zahlen des Befunds
   nachgebaut. Beispieldaten, keine Kundendaten. */
const QUELLE = {
  site: { lang: "de" },
  sections: {
    shows: { items: [
      { date: "2026-09-05", name: "Nox Club", city: "Chur" },
      { date: "2026-08-29", name: "Aftersun Festival", city: "Luzern" },
    ] },
    references: { items: [{ name: "Kugl", city: "St. Gallen" }] },
  },
  updatedAt: "2026-09-15T03:58:52.024Z",
};
const ALT = {
  site: { lang: "de" },
  sections: {
    shows: { items: [{ date: "2026-08-29", name: "Test", city: "Testort" }] },
    references: { items: [] },
  },
  updatedAt: "2026-08-05T09:00:00.000Z",
};

async function lauf(auftrag) {
  const { stdout } = await ausfuehren(process.execPath, [LAUF, JSON.stringify({ quelle: QUELLE, ...auftrag })]);
  return JSON.parse(stdout);
}

test("ohne lokalen Stand steht der aktuelle Stand da", async () => {
  const r = await lauf({ lokal: null });
  assert.deepEqual(r.inhaltShows, ["Nox Club", "Aftersun Festival"],
    "die Vorführung zeigt nicht den Stand, den sie geladen hat");
  assert.equal(r.inhaltVom, QUELLE.updatedAt, "der Stand ist nicht der geladene");
  assert.equal(r.hinweisVorher, null, "es wird vor einem alten Stand gewarnt, obwohl gar keiner da ist");
  /* Und er wird lokal festgehalten — dafür gibt es die Demo-Speicherung. */
  assert.equal(r.speicherDa, true, "der Stand wird nicht lokal gespeichert");
});

test("ein NEUERER lokaler Stand bleibt unangetastet — und ohne Hinweis", async () => {
  const neuer = { ...QUELLE, updatedAt: "2026-09-16T12:00:00.000Z",
    sections: { ...QUELLE.sections, shows: { items: [{ date: "2026-10-01", name: "In der Vorführung angelegt" }] } } };
  const r = await lauf({ lokal: neuer });
  assert.deepEqual(r.inhaltShows, ["In der Vorführung angelegt"],
    "die lokale Änderung ist weg — genau das darf nie passieren");
  assert.equal(r.hinweisVorher, null, "es wird gewarnt, obwohl der lokale Stand neuer ist");
  assert.deepEqual(r.entfernt, [], "am Browser-Speicher wurde etwas gelöscht");
});

test("ein ÄLTERER lokaler Stand bleibt stehen — aber es steht da", async () => {
  const r = await lauf({ lokal: ALT });

  /* NICHTS GELÖSCHT: der alte Stand ist weiterhin da, mitsamt seinem Termin. */
  assert.deepEqual(r.inhaltShows, ["Test"], "der lokale Stand wurde stillschweigend überschrieben");
  assert.deepEqual(r.gespeichertShows, ["Test"], "der lokale Stand wurde aus dem Browser-Speicher entfernt");
  assert.deepEqual(r.entfernt, [], "am Browser-Speicher wurde etwas gelöscht");

  /* ABER SICHTBAR: der Hinweis nennt beide Daten — sonst weiss niemand, was er sieht. */
  assert.ok(r.hinweisVorher, "es gibt keinen Hinweis auf den älteren Stand — genau der Befund vom 17.09.2026");
  assert.match(r.hinweisVorher, /05\.08\.2026/, "der Hinweis nennt nicht, von wann der lokale Stand ist");
  assert.match(r.hinweisVorher, /15\.09\.2026/, "der Hinweis nennt nicht, von wann die Website ist");
  assert.deepEqual(r.knoepfe, ["Aktuellen Website-Stand laden", "Lokalen Stand behalten"],
    "die beiden Wege stehen nicht als Knöpfe da");
});

test("der Knopf fragt zurück — und Abbrechen ändert nichts", async () => {
  const r = await lauf({ lokal: ALT, klick: "laden", dialog: "nein" });
  assert.equal(r.dialogTitel, "Aktuellen Website-Stand laden?", "es wird nicht zurückgefragt");
  assert.deepEqual(r.inhaltShows, ["Test"], "trotz Abbrechen wurde der lokale Stand verworfen");
  assert.deepEqual(r.gespeichertShows, ["Test"], "trotz Abbrechen wurde der Browser-Speicher überschrieben");
  assert.ok(r.hinweisNachher, "der Hinweis ist weg, obwohl nichts passiert ist");
});

test("nach ausdrücklicher Bestätigung steht der aktuelle Stand da", async () => {
  const r = await lauf({ lokal: ALT, klick: "laden", dialog: "ja" });
  assert.deepEqual(r.inhaltShows, ["Nox Club", "Aftersun Festival"], "der aktuelle Stand wurde nicht geladen");
  assert.equal(r.inhaltVom, QUELLE.updatedAt, "geladen wurde etwas anderes als die Quelle");
  assert.deepEqual(r.gespeichertShows, ["Nox Club", "Aftersun Festival"],
    "der neue Stand überlebt kein Neuladen — er wurde nicht lokal gespeichert");
  assert.equal(r.hinweisNachher, null, "der Hinweis steht noch da, obwohl er erledigt ist");
  assert.equal(r.dirty, false, "die Vorführung meldet ungespeicherte Änderungen");
});

test("„Lokalen Stand behalten“ blendet nur aus und rührt nichts an", async () => {
  const r = await lauf({ lokal: ALT, klick: "behalten" });
  assert.ok(r.hinweisVorher, "es gab gar keinen Hinweis zum Wegklicken");
  assert.equal(r.hinweisNachher, null, "der Hinweis lässt sich nicht wegklicken");
  assert.equal(r.dialogTitel, null, "beim Behalten wird zurückgefragt, obwohl nichts passiert");
  assert.deepEqual(r.inhaltShows, ["Test"], "der lokale Stand wurde verändert");
  assert.deepEqual(r.entfernt, [], "am Browser-Speicher wurde etwas gelöscht");
});

test("?resetDemo=1 setzt zurück — der eine ausdrückliche Weg", async () => {
  const r = await lauf({ lokal: ALT, adresse: "?resetDemo=1" });
  assert.deepEqual(r.entfernt.sort(), ["samsparking-demo-content-v1", "samsparking-demo-meta-v1"],
    "der ausdrückliche Rücksetz-Weg räumt den lokalen Stand nicht weg");
  assert.deepEqual(r.inhaltShows, ["Nox Club", "Aftersun Festival"], "nach dem Zurücksetzen fehlt der aktuelle Stand");
  assert.equal(r.hinweisVorher, null, "nach dem Zurücksetzen wird trotzdem gewarnt");
});

/* ── Der Vergleich einzeln — auch dort, wo NICHTS behauptet werden darf ──── */
test("standVergleich behauptet nichts ohne Datum", async () => {
  const { standVergleich } = await import(resolve(HIER, "../verwaltung/js/demo-stand.js"));
  const mit = (d) => (d ? { updatedAt: d } : {});

  assert.equal(standVergleich(mit("2026-08-05T09:00:00Z"), mit("2026-09-15T03:58:52Z")).veraltet, true,
    "ein älterer lokaler Stand gilt als aktuell");
  assert.equal(standVergleich(mit("2026-09-16T09:00:00Z"), mit("2026-09-15T03:58:52Z")).veraltet, false,
    "ein neuerer lokaler Stand gilt als veraltet");
  assert.equal(standVergleich(mit("2026-09-15T03:58:52Z"), mit("2026-09-15T03:58:52Z")).veraltet, false,
    "derselbe Stand gilt als veraltet");

  /* Ohne Datum lässt sich nicht sagen, welcher Stand neuer ist. Dann wird
     nichts behauptet — ein falscher Hinweis wäre schlimmer als keiner. */
  for (const [a, b, fall] of [
    [mit(null), mit("2026-09-15T03:58:52Z"), "ohne lokales Datum"],
    [mit("2026-08-05T09:00:00Z"), mit(null), "ohne Datum an der Quelle"],
    [mit("kein Datum"), mit("2026-09-15T03:58:52Z"), "mit unlesbarem Datum"],
    [null, null, "ohne alles"],
  ]) {
    assert.equal(standVergleich(a, b).veraltet, false, `${fall} wird trotzdem gewarnt`);
  }
});

test("der Vorführ-Modus bleibt, wie er war", async () => {
  const { readFileSync } = await import("node:fs");
  const quelle = readFileSync(resolve(HIER, "../verwaltung/js/demo-persistence.js"), "utf8")
    + readFileSync(resolve(HIER, "../verwaltung/js/demo-stand.js"), "utf8");

  /* Alles hier lebt im Browser: kein Schreiben in die Produktion, kein
     Versand, keine Kasse. Geschrieben wird ausschliesslich in den lokalen
     Speicher. */
  for (const verboten of ["fetch(", "XMLHttpRequest", "firebase", "db.ref", "publish", "sessionStorage"]) {
    assert.ok(!quelle.includes(verboten), `demo-persistence.js benutzt „${verboten}“ — das gehört hier nicht hin`);
  }
  assert.ok(quelle.includes("localStorage.setItem"), "es wird gar nichts mehr lokal gespeichert");

  /* Und der lokale Stand wird an genau EINER Stelle entfernt: beim
     ausdrücklichen `?resetDemo=1`. */
  const stellen = quelle.split("localStorage.removeItem").length - 1;
  assert.equal(stellen, 2, "der lokale Stand wird an mehr Stellen gelöscht als beim ausdrücklichen Zurücksetzen");
  const vorReset = quelle.indexOf('params.get("resetDemo")');
  assert.ok(vorReset > 0 && vorReset < quelle.indexOf("localStorage.removeItem"),
    "gelöscht wird, ohne dass vorher ausdrücklich darum gebeten wurde");
});
