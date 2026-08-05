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
 * herein. Genau eine Datei bleibt dabei bewusst anders:
 *
 *   verwaltung/js/config.js — hier steht DEMO = true, das Projekt für die
 *   Wünsche (PRJ-YWRM4) und die Website-Adresse "/site". Alle übrigen Dateien
 *   sind Zeichen für Zeichen dieselben wie im Original; die Unterschiede der
 *   Vorführ-Fassung stecken ausschliesslich in diesen Schaltern.
 *
 * Dazu kommen Dateien, die es nur hier gibt (`nurHier`, unten). Sie stammen
 * aus keinem Original und werden deshalb nie überschrieben — angehängt werden
 * sie ausschliesslich über config.js, damit index.html & Co. unangetastet
 * bleiben und dieses Skript sie gefahrlos nachziehen kann. Wer hier etwas
 * ergänzt: denselben Weg gehen, sonst überschreibt der nächste Lauf die
 * Änderung stillschweigend.
 *
 * Aufruf:  node scripts/quellen-holen.mjs [--pruefen]
 *          --pruefen  meldet nur Unterschiede, kopiert nichts
 */

import { cp, readdir, stat, readFile, rm } from "node:fs/promises";
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
    // Gibt es nur in der Demo — von config.js nachgeladen, nicht aus index.html
    nurHier: ["js/demo-persistence.js", "demo-storage-note.css", "DEMO-SPEICHERUNG.md"],
  },
];

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

const gleich = async (a, b) => {
  if (!existsSync(b)) return false;
  const [x, y] = await Promise.all([stat(a), stat(b)]);
  if (x.size !== y.size) return false;
  const [ba, bb] = await Promise.all([readFile(a), readFile(b)]);
  return ba.equals(bb);
};

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
    const von = join(q.von, rel);
    const nach = join(q.nach, rel);
    if (await gleich(von, nach)) continue;
    if (existsSync(nach)) geaendert++;
    else neu++;
    abweichungen++;
    console.log(`  ${existsSync(nach) ? "geändert" : "neu     "}  ${q.nach.split("/").pop()}/${rel}`);
    if (!NUR_PRUEFEN) await cp(von, nach, { recursive: true });
  }

  for (const rel of q.entfernen || []) {
    const weg = join(q.nach, rel);
    if (!existsSync(weg)) continue;
    console.log(`  entfernt  ${q.nach.split("/").pop()}/${rel}`);
    if (!NUR_PRUEFEN) await rm(weg, { force: true });
  }

  // Was es nur hier gibt, kommt im Original nicht vor und wird darum von der
  // Schleife oben gar nicht gesehen — hier trotzdem melden, damit sichtbar
  // bleibt, woraus der Vorführ-Modus besteht, und auffällt, wenn etwas fehlt.
  for (const rel of q.nurHier || []) {
    if (existsSync(join(q.nach, rel))) continue;
    console.log(`  FEHLT     ${q.nach.split("/").pop()}/${rel} (gehört nur zur Demo)`);
    abweichungen++;
  }

  console.log(
    `[${q.name}] ${liste.length} Dateien geprüft — ${neu} neu, ${geaendert} geändert` +
      (q.eigen.length ? `, unangetastet: ${q.eigen.join(", ")}` : "") +
      ((q.nurHier || []).length ? `, nur hier: ${q.nurHier.join(", ")}` : "")
  );
}

if (NUR_PRUEFEN && abweichungen) {
  console.log(`\n${abweichungen} Abweichung(en). Ohne --pruefen aufrufen, um zu übernehmen.`);
  process.exit(1);
}
if (!abweichungen) console.log("\nAlles auf dem gleichen Stand.");
else console.log(`\n${abweichungen} Datei(en) übernommen. Danach: SITE_BASE=/site node site/scripts/build.mjs`);
