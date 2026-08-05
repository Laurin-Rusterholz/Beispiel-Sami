# Demo-Speicherung

Die Präsentations-Verwaltung speichert alle Inhaltsänderungen automatisch im lokalen Browser-Speicher.

- Änderungen bleiben nach Neuladen und erneutem Öffnen erhalten.
- Die echte Firebase-Inhaltsdatenbank und die echte Website bleiben unberührt.
- Andere Geräte und Browser sehen weiterhin ihren eigenen Demo-Stand.
- Browserdaten löschen setzt den Demo-Stand zurück.
- Schneller geht es mit `?resetDemo=1` an der Adresse der Verwaltung: der
  gespeicherte Stand fällt weg, danach steht wieder der echte Inhalt da.

Alles davon steckt in `js/demo-persistence.js`; geladen wird die Datei aus
`index.html`. Beim Nachziehen der Originale setzt `scripts/quellen-holen.mjs`
diese Zeile wieder ein.
