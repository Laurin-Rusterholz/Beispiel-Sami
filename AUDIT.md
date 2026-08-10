# Website-Audit — Anteil der Vorführ-Fassung (10.08.2026)

Der vollständige Audit steht im Website-Repo: `Laurin-Rusterholz/s-mi` →
`AUDIT.md` (Zweig `claude/website-audit-implementation-rgnv02`).

Diese Fassung ist eine Kopie zweier Repos (`site/` = Website,
`verwaltung/` = Verwaltung), nachgezogen mit
`node scripts/quellen-holen.mjs`. Sie zeigt denselben Stand — mit zwei
Unterschieden, die hier bewusst anders sind.

## 1. Die Formulare senden hier nichts — und sagen das

Die Website nimmt Anfragen und Bestellungen neu über eigene Endpunkte
entgegen (`/api/booking`, `/api/order`, `netlify/functions/`). Die gibt es
nur im Original: hier liegt bloss die gebaute Website, niemand führt die
Funktionen aus.

Ein Formular, das dann ins Leere sendet, sähe aus wie eines, das
funktioniert. Genau das war der schwerwiegendste Befund des Audits und darf
sich hier nicht wiederholen. Deshalb:

* `FORMS_DEMO = "1"` in `netlify.toml`,
* der Generator setzt daraufhin `data-demo="true"` an beide Formulare und
  schreibt sichtbar darunter: **„Vorführ-Fassung: dieses Formular sendet
  nichts.“**,
* `site.js` sendet in diesem Fall gar nicht erst.

Echte Anfragen laufen über `samsparking.ch`.

## 2. Die Endpunkte werden nicht mitkopiert

`scripts/quellen-holen.mjs` lässt `netlify/` und `coming-soon.html` neu aus.
Ohne das läge der Quelltext der Endpunkte hier als statische Datei und würde
ausgeliefert (`publish = "."`), und die Wartungsseite der echten Website
hätte hier ohnehin keine Aufgabe.

## Was die Vorführung neu zeigt

Startseite ohne Booking- und Shop-Abschnitt, dafür `/site/booking/` und
`/site/shop/` als eigene Seiten in allen drei Sprachen; Booking als erster
Menüpunkt; Hero ohne Genre-Zeile mit dem Anspruch in Blau; Kennzahl „Shows“;
Referenzen in zwei Stufen; aufklappbare Aftermovies; Shop mit
Bestellformular und Stripe-Hinweis statt TWINT-/Bank-QR. In der Verwaltung
sind die Masken „Sound & Genres“ und „Erlebnis“ weg.

Anders als beim Original ist hier **nichts** hinter einer Wartungsseite: die
Vorführ-Fassung zeigt die ganze Website, das ist ihr Zweck. Sie trägt
`X-Robots-Tag: noindex, nofollow`.

## Test

```
node scripts/quellen-holen.mjs --pruefen           # kein Unterschied zum Original
SITE_BASE=/site FORMS_DEMO=1 node site/scripts/build.mjs
cd site && node scripts/build.test.mjs
         && SITE_BASE=/site node scripts/links.test.mjs
         && node scripts/api.test.mjs
```

Ergebnis: 13 gebaute Seiten, alle Menüpunkte und Sprungmarken führen
irgendwohin, jedes Formularfeld ist Pflicht, beide Formulare tragen den
Vorführ-Hinweis.
