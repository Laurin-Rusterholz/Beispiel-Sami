#!/usr/bin/env node
/**
 * Demo-Fassung nachziehen.
 *
 * Diese Präsentation ist eine Kopie zweier Repos:
 *
 *   ../s-mi                        →  site/         (die Website)
 *   ../verwaltung-djsamsparkling   →  verwaltung/   (die Verwaltung)
 *
 * Damit die Kopie nicht auseinanderläuft, holt dieses Skript beide wieder
 * herein. Drei Dateien bleiben dabei anders:
 *
 *   verwaltung/js/config.js — hier steht DEMO = true, das Projekt für die
 *   Wünsche (PRJ-YWRM4) und die Website-Adresse "/site". Diese Datei wird gar
 *   nicht erst angefasst.
 *
 *   verwaltung/index.html — kommt aus dem Original, bekommt beim Übernehmen
 *   aber die zwei Zeilen der Demo-Speicherung wieder eingesetzt (siehe
 *   DEMO_ZUSAETZE weiter unten). So wandern Änderungen am Original mit,
 *   ohne dass die Demo-Speicherung dabei verloren geht.
 *
 *   verwaltung/admin.css — dasselbe Verfahren, hier für die Schrift-Adressen:
 *   das Original liegt an der Wurzel, die Vorführ-Fassung im Unterverzeichnis
 *   /verwaltung/ (siehe schriftenRelativMachen).
 *
 * Alle übrigen Dateien sind Zeichen für Zeichen dieselben wie im Original;
 * die Unterschiede der Vorführ-Fassung stecken ausschliesslich in diesen
 * Schaltern.
 *
 * Aufruf:  node scripts/quellen-holen.mjs [--pruefen]
 *          --pruefen  meldet nur Unterschiede, kopiert nichts
 */

import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NUR_PRUEFEN = process.argv.includes("--pruefen");

const QUELLEN = [
  {
    name: "Website",
    von: resolve(HIER, "../s-mi"),
    nach: resolve(HIER, "site"),
    auslassen: [
      ".git", ".github", "netlify.toml", "README-ANLEITUNG.md", ".gitignore", "node_modules",
      // Vom Generator erzeugt — kommt hier aus `node site/scripts/build.mjs`
      // mit SITE_BASE=/site und sieht deshalb zwangsläufig anders aus.
      "index.html", "404.html", "sitemap.xml", "robots.txt", "de", "fr", "legal",
      // In der Demo auf /site/ umgestellt (start_url, scope, Icons)
      "manifest.webmanifest",
    ],
    eigen: [],
  },
  {
    name: "Verwaltung",
    von: resolve(HIER, "../verwaltung-djsamsparkling/public"),
    nach: resolve(HIER, "verwaltung"),
    // passwort.html erzeugt den Hash des gemeinsamen Passworts — im
    // Vorführ-Modus gibt es keine Anmeldung, also gehört das Werkzeug hier
    // nicht hin.
    auslassen: [".git", "node_modules", "passwort.html"],
    // Bleibt in der Demo bewusst anders: DEMO = true, Projekt, Website-Adresse
    eigen: ["js/config.js"],
    entfernen: ["passwort.html"],
    // Nach dem Übernehmen anpassen — siehe die beiden Funktionen unten.
    anpassen: {
      "index.html": demoSpeicherungEinsetzen,
      "admin.css": schriftenRelativMachen,
    },
  },
];

/**
 * Im Original liegt die Verwaltung an der Wurzel, deshalb stehen die
 * Schriften dort unter `/fonts/…`. Hier liegt sie unter `/verwaltung/`
 * (bei GitHub Pages sogar noch eine Ebene tiefer), wo dieselbe Adresse ins
 * Leere zeigt. Relativ gedacht stimmt sie überall.
 */
function schriftenRelativMachen(inhalt) {
  return Buffer.from(inhalt.toString("utf8").replaceAll("url(/fonts/", "url(fonts/"), "utf8");
}

/**
 * Die Demo-Speicherung: sie hält Änderungen im Browser fest, damit eine
 * Vorführung ein Neuladen übersteht. Zwei Zeilen in `verwaltung/index.html`
 * hängen daran — sie gehören nicht ins Original und werden deshalb hier
 * beschrieben statt dort gepflegt.
 */
const DEMO_ZUSAETZE = [
  {
    zeile: '  <link rel="stylesheet" href="demo-storage-note.css">',
    nach: '  <link rel="stylesheet" href="editor-live-preview.css">',
  },
  {
    zeile: '  <script type="module" src="js/demo-persistence.js"></script>',
    nach: '  <script type="module" src="js/app.js"></script>',
  },
];

/** Setzt die Zeilen der Demo-Speicherung in das Original-HTML ein. */
function demoSpeicherungEinsetzen(inhalt) {
  let text = inhalt.toString("utf8");
  for (const { zeile, nach } of DEMO_ZUSAETZE) {
    if (text.includes(zeile.trim())) continue;
    if (!text.includes(nach)) {
      throw new Error(
        `Ankerzeile fehlt in index.html: ${nach.trim()}\n` +
          "Das Original hat sich hier geändert — DEMO_ZUSAETZE in " +
          "scripts/quellen-holen.mjs nachziehen."
      );
    }
    text = text.replace(nach, `${nach}\n${zeile}`);
  }
  return Buffer.from(text, "utf8");
}

/** Alle Dateien unterhalb eines Verzeichnisses, relativ zu ihm. */
async function dateien(wurzel, auslassen, prefix = "") {
  const out = [];
  for (const e of await readdir(join(wurzel, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (auslassen.includes(e.name) || auslassen.includes(rel)) continue;
    if (e.isDirectory()) out.push(...(await dateien(wurzel, auslassen, rel)));
    else out.push(rel);
  }
  return out;
}

let abweichungen = 0;

for (const q of QUELLEN) {
  if (!existsSync(q.von)) {
    console.log(`[übersprungen] ${q.name}: ${relative(HIER, q.von)} nicht da`);
    continue;
  }
  const liste = await dateien(q.von, q.auslassen);
  let neu = 0;
  let geaendert = 0;

  for (const rel of liste) {
    if (q.eigen.includes(rel)) continue;
    const nach = join(q.nach, rel);
    const anpassen = q.anpassen?.[rel];
    // Der Soll-Stand: das Original, bei den angepassten Dateien mit den
    // Demo-Zusätzen darin. Verglichen wird gegen genau diesen Stand, damit
    // eine schon eingesetzte Zeile nicht jedes Mal als Unterschied gilt.
    let soll = await readFile(join(q.von, rel));
    if (anpassen) soll = anpassen(soll);

    const dawar = existsSync(nach);
    if (dawar && (await readFile(nach)).equals(soll)) continue;
    if (dawar) geaendert++;
    else neu++;
    abweichungen++;
    console.log(`  ${dawar ? "geändert" : "neu     "}  ${q.nach.split("/").pop()}/${rel}`);
    if (!NUR_PRUEFEN) {
      await mkdir(dirname(nach), { recursive: true });
      await writeFile(nach, soll);
    }
  }

  for (const rel of q.entfernen || []) {
    const weg = join(q.nach, rel);
    if (!existsSync(weg)) continue;
    console.log(`  entfernt  ${q.nach.split("/").pop()}/${rel}`);
    if (!NUR_PRUEFEN) await rm(weg, { force: true });
  }

  console.log(
    `[${q.name}] ${liste.length} Dateien geprüft — ${neu} neu, ${geaendert} geändert` +
      (q.eigen.length ? `, unangetastet: ${q.eigen.join(", ")}` : "")
  );
}

if (NUR_PRUEFEN && abweichungen) {
  console.log(`\n${abweichungen} Abweichung(en). Ohne --pruefen aufrufen, um zu übernehmen.`);
  process.exit(1);
}
if (!abweichungen) console.log("\nAlles auf dem gleichen Stand.");
else console.log(`\n${abweichungen} Datei(en) übernommen. Danach: SITE_BASE=/site node site/scripts/build.mjs`);
