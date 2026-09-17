/**
 * Die Prüfungen DIESER Fassung — nicht die des Originals.
 *
 * BEFUND DER ABNAHME (17.09.2026): `node --test site/scripts/*.test.mjs` fiel
 * hier 3 von 22 und riss 621 Folgefehler mit. Nicht, weil etwas kaputt war,
 * sondern weil die mitkopierten Prüfungen des Originals etwas anderes messen
 * als das, was hier steht:
 *
 *   · `kette.test.mjs` braucht `site/netlify.toml` — die Wegleitung dieser
 *     Fassung liegt an der Wurzel, nicht unter `site/`;
 *   · `links.test.mjs` erwartet die Adressen des Originals (`/…` statt
 *     `/site/…`) und ECHTE Kaufwege — hier führt absichtlich keiner in eine
 *     Kasse;
 *   · `routen.test.mjs` / `api.test.mjs` messen die Auslieferung gegen die
 *     `netlify.toml` des Originals.
 *
 * Ein Test, der das Falsche misst, ist schlimmer als keiner: er ist entweder
 * immer rot (dann sieht niemand mehr hin) oder er wird „passend" gemacht (dann
 * prüft er nichts mehr). Die Prüfungen des Originals laufen deshalb im
 * Original; seit dem 17.09. werden sie gar nicht mehr hierher kopiert
 * (scripts/quellen-holen.mjs).
 *
 * Hier stehen stattdessen die Zusagen DIESER Fassung, gemessen am WIRKLICH
 * gebauten Stand — in einer Kopie, damit der Arbeitsstand unberührt bleibt:
 *
 *   1. Hier wird nicht wirklich bezahlt (der Grund, aus dem es sie gibt).
 *   2. Die Website liegt unter /site/ und ihre Wege führen dorthin.
 *   3. Rahmen und Verwaltung sind da, die Verwaltung im Vorführ-Modus.
 *   4. Die Wegleitung sperrt, was nicht ausgeliefert gehört.
 *
 * Aufruf:  npm test      (oder: node --test scripts/vorfuehrung.test.mjs)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { readFileSync, existsSync, readdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASIS = "/site";

/* Der echte Pfad, nicht der geliehene: auf macOS liefert `mkdtemp(tmpdir())`
   `/var/folders/…`, und `/var` ist eine Verknüpfung auf `/private/var`. Node
   löst Symlinks beim Laden eines Moduls auf — der Generator rechnet drinnen
   also mit einem anderen Namen als der Test draussen, und jeder Vergleich der
   beiden geht schief. `realpathSync` macht daraus wieder einen Namen; wo es
   keinen Symlink gibt, kommt derselbe Pfad zurück. */
async function kopie() {
  const dir = realpathSync(await mkdtemp(join(tmpdir(), "vorfuehrung-")));
  await cp(WURZEL, dir, {
    recursive: true,
    filter: (q) => !/(^|\/)(\.git|node_modules|_quellen|site\/media)(\/|$)/.test(q.slice(WURZEL.length)),
  });
  return dir;
}

function baue(dir, env = {}) {
  return new Promise((fertig) => {
    const kind = spawn(process.execPath, [join(dir, "site/scripts/build.mjs")], {
      cwd: dir,
      env: { ...process.env, SITE_BASE: BASIS, VORFUEHRUNG: "1", ...env },
    });
    let stdout = "", stderr = "";
    kind.stdout.on("data", (d) => (stdout += d));
    kind.stderr.on("data", (d) => (stderr += d));
    kind.on("close", (status) => fertig({ status, stdout, stderr }));
  });
}

/** Jede gebaute Seite der Website als [pfad relativ zu dir, html]. */
function seiten(dir) {
  const raus = [];
  const suche = (rel, tiefe) => {
    const abs = join(dir, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const kind = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (["assets", "img", "media", "scripts", "content", "presskit", "node_modules"].includes(e.name)) continue;
        if (tiefe > 0) suche(kind, tiefe - 1);
      } else if (e.name.endsWith(".html")) {
        raus.push([kind, readFileSync(join(dir, kind), "utf8")]);
      }
    }
  };
  suche("site", 3);
  return raus;
}

/* Ein Bau für alle Prüfungen — er dauert ein paar Sekunden und ist für jede
   Frage derselbe. Gebaut wird OHNE Netz-Zwang: ist die Datenbank nicht
   erreichbar, nimmt der Generator den eingecheckten Stand. Beides ist für
   diese Zusagen gleich gültig. */
let DIR = null;
let LAUF = null;
test("die Vorführung baut überhaupt", async () => {
  DIR = await kopie();
  LAUF = await baue(DIR);
  assert.equal(LAUF.status, 0, `Build fehlgeschlagen:\n${LAUF.stdout}\n${LAUF.stderr}`);
  assert.match(LAUF.stdout, /\[build\] fertig/, "der Generator meldet kein Ende");
  assert.ok(existsSync(join(DIR, "site/index.html")), "die Startseite der Website fehlt");
});

test("hier wird nicht wirklich bezahlt", () => {
  /* Der Grund, aus dem es diese Prüfung gibt: Bis zum 17.09.2026 trug der
     Kauf-Knopf dieser Fassung DIESELBEN Stripe Payment Links wie die echte
     Website. Wer in der Vorführung klickte, stand in einer echten Kasse. */
  const alle = seiten(DIR);
  assert.ok(alle.length >= 15, `zu wenige Seiten gebaut: ${alle.length}`);

  for (const [pfad, html] of alle) {
    assert.ok(!html.includes("buy.stripe.com"), `${pfad}: führt in eine echte Stripe-Kasse`);
    assert.ok(!/class="[^"]*buy-mail/.test(html), `${pfad}: bietet eine echte Bestellmail an`);
    assert.ok(!/<a[^>]+class="btn btn-sm"[^>]*>\s*(Tickets|Billets)/i.test(html),
      `${pfad}: führt in einen echten Ticketverkauf`);
  }

  /* Und dort, wo sonst ein Knopf stünde, steht der Vermerk — in der Sprache
     der Seite. Ein Schalter, der nur Links entfernt und nichts hinstellt,
     sähe aus wie ein Fehler. */
  const shop = alle.filter(([p]) => /(^|\/)shop\/index\.html$/.test(p));
  assert.ok(shop.length >= 3, `der Shop fehlt auf einer Sprachseite: ${shop.map(([p]) => p)}`);
  for (const [pfad, html] of shop) {
    if (!/class="prod rv/.test(html)) continue;        // kein Artikel gepflegt
    assert.ok(/class="mono shop-demo"/.test(html), `${pfad}: kein Vorführ-Vermerk am Kauf-Knopf`);
  }
});

test("die Formulare senden nichts und sagen es", () => {
  let gefunden = 0;
  for (const [pfad, html] of seiten(DIR)) {
    if (!html.includes('id="booking-form"')) continue;
    gefunden++;
    assert.ok(html.includes('data-demo="true"'), `${pfad}: das Formular sendet wirklich`);
    assert.ok(/class="bform-demo mono"/.test(html), `${pfad}: der Hinweis am Formular fehlt`);
  }
  assert.ok(gefunden >= 3, `das Formular wurde nicht auf jeder Sprachseite geprüft: ${gefunden}`);
});

test("die Wege der Website führen nach /site/ — und nirgends ins Leere", () => {
  const tot = [];
  for (const [pfad, html] of seiten(DIR)) {
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const roh = m[1];
      if (/^(https?:|mailto:|tel:|data:|#)/i.test(roh)) continue;
      if (!roh.startsWith("/")) continue;
      const ohneAnker = roh.split("#")[0].split("?")[0];
      if (!ohneAnker) continue;
      /* Alles, was die Website verlinkt, muss unter /site/ liegen — sonst
         zeigt es an der Vorführung vorbei auf die Wurzel dieser Fassung. */
      assert.ok(ohneAnker.startsWith(BASIS + "/") || ohneAnker === BASIS,
        `${pfad}: „${roh}" zeigt an /site/ vorbei`);
      const ziel = join(DIR, ohneAnker.replace(/^\//, ""));
      const datei = ohneAnker.endsWith("/") ? join(ziel, "index.html") : ziel;
      if (!existsSync(datei) && !existsSync(ziel)) tot.push(`${pfad} → ${roh}`);
    }
  }
  assert.deepEqual([...new Set(tot)], [], "tote Verweise in der Vorführung");
});

test("jede Seite gibt es in allen drei Sprachen", () => {
  const fehlt = [];
  for (const lang of ["", "en/", "fr/"]) {
    for (const s of ["index.html", "shows/index.html", "gallery/index.html",
                     "booking/index.html", "shop/index.html"]) {
      if (!existsSync(join(DIR, "site", lang, s))) fehlt.push(`site/${lang}${s}`);
    }
  }
  assert.deepEqual(fehlt, [], "Seiten fehlen");
});

test("unter „Shows“ steht nur Kommendes — kein Rückblick", () => {
  /* Dieselbe Zusage wie auf der echten Website (s-mi #34). Hier wird sie noch
     einmal geprüft, weil die Vorführung eine eigene Kopie des Generators
     mitführt: ein Nachziehen, das sie zurückdreht, fiele sonst nicht auf. */
  for (const [pfad, html] of seiten(DIR)) {
    assert.ok(!/PLAYED BEFORE|past-show|past-title/i.test(html),
      `${pfad}: der Rückblick auf vergangene Shows ist wieder da`);
  }
});

test("Rahmen und Verwaltung stehen — die Verwaltung im Vorführ-Modus", () => {
  assert.ok(existsSync(join(DIR, "index.html")), "der Präsentations-Rahmen fehlt");
  assert.ok(existsSync(join(DIR, "verwaltung/index.html")), "die Verwaltung fehlt");

  const cfg = readFileSync(join(DIR, "verwaltung/js/config.js"), "utf8");
  assert.match(cfg, /export const DEMO\s*=\s*true/,
    "die Verwaltung dieser Fassung ist NICHT im Vorführ-Modus — sie würde schreiben");

  /* Der Rahmen bettet beides ein; ohne diese zwei Adressen ist er leer. */
  const rahmen = readFileSync(join(DIR, "index.html"), "utf8");
  for (const ziel of ["site/", "verwaltung/"]) {
    assert.ok(rahmen.includes(ziel), `der Rahmen verweist nicht auf ${ziel}`);
  }
});

test("die Wegleitung sperrt, was nicht ausgeliefert gehört", () => {
  /* Ausgeliefert wird hier das ganze Verzeichnis. Ohne diese Regeln lägen der
     Quelltext des Generators und der komplette Inhalt als Datei offen — die
     echte Website sperrt beides. */
  const toml = readFileSync(join(WURZEL, "netlify.toml"), "utf8");
  for (const weg of ["/site/scripts/*", "/site/content/*"]) {
    assert.ok(toml.includes(`from = "${weg}"`), `netlify.toml sperrt ${weg} nicht`);
  }
  assert.match(toml, /VORFUEHRUNG\s*=\s*"1"/, "netlify.toml setzt den Vorführ-Schalter nicht");
  assert.match(toml, /SITE_BASE\s*=\s*"\/site"/, "netlify.toml setzt SITE_BASE nicht");

  const pages = readFileSync(join(WURZEL, ".github/workflows/veroeffentlichen.yml"), "utf8");
  assert.match(pages, /VORFUEHRUNG:\s*"1"/, "der Pages-Workflow setzt den Vorführ-Schalter nicht");
});

test("Gegenprobe: OHNE den Schalter stünde die echte Kasse wieder da", async (t) => {
  /* Ein Test, der immer grün ist, weil er das Falsche misst, wäre genau der
     Fehler, den die Abnahme am 17.09. gefunden hat. Hier wird deshalb einmal
     OHNE VORFUEHRUNG gebaut: kommt der Zahlungslink dann zurück, ist bewiesen,
     dass der Schalter die Arbeit tut — und nicht etwa ein leerer Shop.

     Gebaut wird in einer eigenen Kopie; der Stand aus den anderen Prüfungen
     bleibt unberührt. */
  const dir = await kopie();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const lauf = await baue(dir, { VORFUEHRUNG: "" });
  assert.equal(lauf.status, 0, `Build fehlgeschlagen:\n${lauf.stdout}\n${lauf.stderr}`);

  const mitKasse = seiten(dir).filter(([, h]) => h.includes("buy.stripe.com"));
  assert.ok(
    mitKasse.length > 0,
    "ohne den Schalter steht KEIN Zahlungslink in den Seiten — dann prueft die Pruefung "
      + "„hier wird nicht wirklich bezahlt“ nichts. Entweder ist im Inhalt gerade kein "
      + "Artikel mit Kasse gepflegt, oder der Shop ist abgeschaltet."
  );
  assert.ok(!seiten(dir).some(([, h]) => /class="mono shop-demo"/.test(h)),
    "ohne den Schalter steht trotzdem ein Vorführ-Vermerk da");
});

test("aufräumen", async () => {
  if (DIR) await rm(DIR, { recursive: true, force: true });
});

/* ══════════════════════════════════════════════════════════════════════════
   Der Umschalter im Rahmen muss die Sprache treffen, die er nennt

   BEFUND (Live-Sprachprüfung 17.09.2026): Der Umschalter stand auf „English",
   der Rahmen lud `site/` — dort liegt aber DEUTSCH. „Deutsch" führte auf
   `site/de/`, und das gibt es gar nicht. Und ein Sprachwechsel sprang immer
   auf die Startseite: wer auf /shop/ stand und Französisch wählte, musste
   sich neu durchklicken.

   Grund: Die Zuordnung stammte aus der Zeit, als Englisch die Grundsprache
   war. Am 07.09.2026 wurde auf Deutsch umgestellt — hier blieb die alte
   Tabelle stehen.
   ══════════════════════════════════════════════════════════════════════════ */
test("die Sprachauswahl nennt, was sie lädt", () => {
  const rahmen = readFileSync(join(WURZEL, "index.html"), "utf8");
  const auswahl = rahmen.match(/<select id="sprache">[\s\S]*?<\/select>/);
  assert.ok(auswahl, "es gibt keine Sprachauswahl im Rahmen");

  const werte = [...auswahl[0].matchAll(/<option value="([^"]*)">([^<]+)</g)]
    .map((m) => [m[1], m[2].trim()]);
  assert.deepEqual(werte, [["de", "Deutsch"], ["en", "English"], ["fr", "Français"]],
    "die Sprachauswahl steht nicht auf de/en/fr — oder wieder auf dem leeren Wert von früher");

  /* Die Grundsprache steht zuoberst und ist damit die Vorauswahl. Der Rahmen
     startet auf `site/` — und `site/` IST die Grundsprache. */
  assert.equal(werte[0][0], "de", "die Vorauswahl passt nicht zu dem, was der Rahmen lädt");
  assert.match(rahmen, /<iframe id="frame-website" src="site\/"/,
    "der Rahmen startet nicht auf der Wurzel der Website");

  /* Und die Verzeichnisse gibt es wirklich. `site/de/` gab es nie. */
  assert.ok(existsSync(join(WURZEL, "site/index.html")), "site/ fehlt");
  assert.ok(existsSync(join(WURZEL, "site/en/index.html")), "site/en/ fehlt");
  assert.ok(existsSync(join(WURZEL, "site/fr/index.html")), "site/fr/ fehlt");
  assert.ok(!existsSync(join(WURZEL, "site/de")),
    "es gibt ein site/de/ — dann stimmt die Annahme über die Grundsprache nicht mehr");
});

test("ein Sprachwechsel bleibt auf derselben Seite", () => {
  /* Die echte Funktion aus dem Rahmen, ausgeschnitten und ausgeführt. */
  const quelle = readFileSync(join(WURZEL, "praesentation/shell.js"), "utf8");
  const i = quelle.indexOf("const GRUNDSPRACHE");
  const j = quelle.indexOf("const SEITEN = {", i);
  assert.ok(i >= 0 && j > i, "die Sprachzuordnung ist nicht zu finden");
  const websiteAdresse = new Function(quelle.slice(i, j) + "; return websiteAdresse;")();

  // Von der deutschen Shop-Seite nach Französisch — und wieder zurück.
  assert.equal(websiteAdresse("fr", "/site/shop/"), "site/fr/shop/",
    "der Wechsel nach Französisch springt auf die Startseite");
  assert.equal(websiteAdresse("de", "/site/fr/shop/"), "site/shop/",
    "der Wechsel zurück nach Deutsch springt auf die Startseite");
  assert.equal(websiteAdresse("en", "/site/fr/booking/"), "site/en/booking/",
    "der Wechsel zwischen zwei Fremdsprachen springt auf die Startseite");

  // Die Grundsprache liegt an der Wurzel, nicht unter site/de/.
  assert.equal(websiteAdresse("de", "/site/"), "site/", "die Grundsprache landet im falschen Ordner");
  assert.equal(websiteAdresse("en", "/site/"), "site/en/", "Englisch landet im falschen Ordner");

  // Ohne bekannte Adresse: Startseite der Sprache — der Rückfall von früher.
  assert.equal(websiteAdresse("fr", ""), "site/fr/", "ohne Adresse führt der Wechsel nirgendwohin");
  assert.equal(websiteAdresse("de", ""), "site/", "ohne Adresse führt der Wechsel nirgendwohin");

  // Anker und Parameter gehören nicht in den Weg.
  assert.equal(websiteAdresse("fr", "/site/shop/index.html"), "site/fr/shop/index.html",
    "eine Datei im Weg wird nicht mitgenommen");
});
