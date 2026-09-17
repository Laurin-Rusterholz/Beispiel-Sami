# Demo-Speicherung

Die Präsentations-Verwaltung speichert alle Inhaltsänderungen automatisch im lokalen Browser-Speicher.

- Änderungen bleiben nach Neuladen und erneutem Öffnen erhalten.
- Die echte Firebase-Inhaltsdatenbank und die echte Website bleiben unberührt.
- Andere Geräte und Browser sehen weiterhin ihren eigenen Demo-Stand.
- Browserdaten löschen setzt den Demo-Stand zurück.
- Schneller geht es mit `?resetDemo=1` an der Adresse der Verwaltung: der
  gespeicherte Stand fällt weg, danach steht wieder der echte Inhalt da.

## Wenn der lokale Stand alt ist

QA-Befund 17.09.2026: im Präsentationsrahmen zeigte die Website 28 Referenzen
mit „Nox Club“ und „Aftersun Festival“, die Verwaltung daneben „gespeichert
05.08.2026“ und einen einzigen historischen Termin. Ursache: der lokal
gespeicherte Stand wurde **unbesehen** über den geladenen gelegt — egal wie
alt, und ohne dass irgendetwas darauf hinwies.

Seither gilt:

- Der lokale Stand wird weiterhin geladen und **nie von selbst gelöscht**. Wer
  in einer Vorführung etwas geändert hat, findet es wieder.
- Ist die Quelle neuer, steht unten ein Hinweis mit **beiden Datumsangaben**.
- Der Knopf **„Aktuellen Website-Stand laden“** holt ihn — aber erst nach einer
  Rückfrage, die sagt, dass die lokalen Demo-Änderungen dabei verloren gehen.
- **„Lokalen Stand behalten“** blendet nur den Hinweis aus und ändert nichts.

Der Vergleich steckt in `js/demo-stand.js` (`standVergleich`), damit er sich
ohne Browser prüfen lässt; geprüft wird er in `scripts/demo-stand.test.mjs`.

Alles davon steckt in `js/demo-persistence.js` (und dem Vergleich in
`js/demo-stand.js`); geladen wird `demo-persistence.js` aus `index.html`, den
Rest holt es sich selbst. Beim Nachziehen der Originale setzt
`scripts/quellen-holen.mjs` diese Zeile wieder ein.
