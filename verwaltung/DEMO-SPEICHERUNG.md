# Demo-Speicherung

Die Präsentations-Verwaltung speichert alle Inhaltsänderungen automatisch im lokalen Browser-Speicher.

- Änderungen bleiben nach Neuladen und erneutem Öffnen erhalten.
- Die echte Firebase-Inhaltsdatenbank und die echte Website bleiben unberührt.
- Andere Geräte und Browser sehen weiterhin ihren eigenen Demo-Stand.
- Browserdaten löschen setzt den Demo-Stand zurück, ebenso `?resetDemo=1`
  an der Adresse der Verwaltung.

Bilder und Videos kommen dabei nicht aus dem Browser-Speicher, sondern live aus
`samsparking/media` — der Vorführ-Modus zeigt dieselbe Mediathek wie die echte
Verwaltung, nur ohne Hochladen und Löschen.

## Wo das hängt

`js/demo-persistence.js`, geladen am Ende von `js/config.js`
(`if (DEMO) import("./demo-persistence.js")`). Diese beiden Dateien und
`demo-storage-note.css` sind die einzigen Stellen des Vorführ-Modus; alle
übrigen Dateien der Verwaltung sind Zeichen für Zeichen die des Original-Repos
`verwaltung-djsamsparkling` und werden von `scripts/quellen-holen.mjs`
überschrieben.
