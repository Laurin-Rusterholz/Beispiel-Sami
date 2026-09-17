/*
 * Welcher Stand ist der neuere? — die Entscheidung allein, ohne Nebenwirkung.
 *
 * Sie steht in einer eigenen Datei, damit sie sich einzeln pruefen laesst:
 * `demo-persistence.js` wirkt beim Laden (Listener, Zeitgeber, lokaler
 * Speicher) und braucht dafuer einen Browser. Diese Datei braucht nichts.
 */

/**
 * Ist der lokal gespeicherte Stand aelter als die Quelle?
 *
 * Verglichen wird `updatedAt` — dieselbe Angabe, die die Verwaltung oben als
 * "gespeichert …" anzeigt. Fehlt oder taugt eine der beiden nicht, wird NICHTS
 * behauptet: ohne Datum laesst sich nicht sagen, welcher Stand neuer ist, und
 * ein falscher Hinweis waere schlimmer als keiner.
 */
export function standVergleich(lokal, quelle) {
  const datum = (x) => {
    const roh = x && typeof x === "object" ? x.updatedAt : null;
    const t = roh ? Date.parse(roh) : NaN;
    return Number.isNaN(t) ? null : { roh: String(roh), zeit: t };
  };
  const l = datum(lokal);
  const q = datum(quelle);
  return {
    lokalVom: l ? l.roh : "",
    quelleVom: q ? q.roh : "",
    veraltet: Boolean(l && q && q.zeit > l.zeit),
  };
}

/** Ein Datum, wie es ein Mensch liest. */
export function lesbar(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unbekannt";
  return new Date(t).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}
