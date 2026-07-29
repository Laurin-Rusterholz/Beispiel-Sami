# Sam Sparkling — Präsentations-Fassung

Eine Vorführ-Fassung, die drei Dinge an einem Ort zusammenbringt:

| Adresse        | Was dort liegt                                                        |
| -------------- | --------------------------------------------------------------------- |
| `/`            | Der Rahmen: Umschalter **Website ⇄ Verwaltung** und der Wunsch-Modus   |
| `/site/`       | Die Website — inhaltlich dieselbe wie die echte                        |
| `/verwaltung/` | Die Verwaltung im **Vorführ-Modus**: ohne Passwort, schreibt nichts    |

Der Sinn: jemandem beides zeigen können, ohne zwischen zwei Adressen zu
wechseln — und aus der Vorführung heraus sofort festhalten, was anders werden
soll.

## Anpassungswunsch

Oben rechts **Anpassungswunsch** einschalten. Danach lässt sich in beiden
Ansichten alles anwählen — ein Bild, ein Knopf, der ganze Shop, ein einzelnes
Wort mitten im Text. Im Band darunter steht die Genauigkeit:

- **Element** — was unter dem Zeiger liegt
- **Einzelnes Wort** — genau ein Wort, über die Schreibmarke an dieser Stelle

Nach dem Antippen öffnet sich ein Feld für den Wunsch. Darüber steht, was
getroffen wurde, und eine Leiste von der kleinsten bis zur grössten Auswahl
(Wort → Absatz → Bereich → ganzer Abschnitt → ganze Seite) — damit sich auch
nachträglich sagen lässt: nein, der ganze Shop.

## Seitenleiste „Änderungen“

Rechts stehen alle Wünsche dieser Sitzung, neueste zuoberst: aus welcher
Ansicht, an welcher Stelle, was gewünscht wurde und wie weit die Aufgabe ist.
Filtern lässt sich nach Website und Verwaltung. Ein Klick auf einen Eintrag
springt zurück an genau die Stelle, um die es ging — auch über den
Ansichtswechsel hinweg; dort blitzt sie kurz auf. Gibt es die Stelle nicht
mehr (Ansicht neu aufgebaut, Inhalt geändert), sagt die Präsentation das.

Auf schmalen Bildschirmen klappt die Leiste über die Bühne statt daneben.

Daraus entsteht eine Aufgabe im Projekt **PRJ-YWRM4** in Quantus (ai-sync).
Die Aufgabe enthält den Wunsch selbst und dazu, wo er hingehört: Ansicht,
Abschnitt, Art und Text des angewählten Elements, seine Stelle im Aufbau, der
umgebende Text, Sprache und Seite.

Der Weg dorthin:

```
Präsentation ──POST──▶ Realtime Database /quantus_task_inbox
                                  │  child_added
                                  ▼
                        Quantus (ai-sync) legt die Aufgabe
                        in PRJ-YWRM4 an und entfernt den Eintrag
```

Genau dieses Verschwinden ist die Rückmeldung: in der Liste unten rechts steht
ein Wunsch auf *wartet auf Quantus*, bis Quantus einmal offen war — dann auf
*in Quantus angelegt*. War Quantus zehn Minuten lang nicht offen, hört die
Präsentation auf zu fragen; die Aufgabe entsteht trotzdem, sobald Quantus das
nächste Mal geöffnet wird.

## Vorführ-Modus der Verwaltung

Die Verwaltung öffnet sich hier ohne Passwort und zeigt den echten Inhalt —
sie liest ihn aus dem Teil der Datenbank, der ohnehin öffentlich ist (daraus
baut auch die Website). Zurückgeschrieben wird nichts: Speichern, Publizieren,
Hochladen und das Bearbeiten von Anfragen sind stillgelegt, Änderungen bleiben
im Browser und sind nach dem Neuladen weg. Anfragen (mit Personendaten) und
Einstellungen werden gar nicht erst geladen.

Erkennbar ist das an der Marke **Vorführ-Modus** oben in der Verwaltung.

## Veröffentlichen

Zwei Wege, beide eingerichtet:

**GitHub Pages** — läuft von selbst. `.github/workflows/veroeffentlichen.yml`
baut bei jedem Push und stellt online unter
`https://<benutzer>.github.io/<repo>/`. Weil Pages in einem Unterverzeichnis
ausliefert, setzt der Workflow `SITE_BASE` auf `/<repo>/site`; alles andere
läuft mit relativen Adressen und braucht nichts.

**Netlify** — `netlify.toml` liegt bereit (`SITE_BASE = "/site"`). Eine neue
Site auf dieses Repo zeigen lassen, sonst nichts.

## Woher der Inhalt kommt

Bei jedem Deploy baut Netlify die Website neu aus
`samsparking/content` — demselben Knoten, aus dem auch die echte Website
gebaut wird. Ist er nicht erreichbar, greift der eingecheckte Stand
`site/content/site.json`.

```
netlify.toml → command = "node site/scripts/build.mjs"
               SITE_BASE = "/site"
               CONTENT_API_URL = …/samsparking/content.json
```

`SITE_BASE` ist der einzige Unterschied im Website-Generator: er verschiebt
alle seiteninternen Adressen unter `/site/`. Ohne die Variable — also im
Original-Repo — verhält sich der Generator unverändert.

## Örtlich ansehen

```bash
SITE_BASE=/site node site/scripts/build.mjs   # Website bauen
python3 -m http.server 8099                   # und auf 127.0.0.1:8099 ansehen
```

Die Verwaltung braucht dabei Zugang zu `gstatic.com` (Firebase-SDK) und zur
Realtime Database; ohne Netz bleibt sie beim Ladehinweis stehen.

## Verhältnis zu den Original-Repos

`site/` und `verwaltung/` sind Kopien aus:

- `../s-mi` → `site/`
- `../verwaltung-djsamsparkling/public` → `verwaltung/`

Genau **eine** Datei ist bewusst anders: `verwaltung/js/config.js` mit
`DEMO = true`, `QUANTUS_PROJECT = "PRJ-YWRM4"` und `DEFAULT_SITE_URL = "/site"`.
Alles andere ist Zeichen für Zeichen identisch — der Vorführ-Modus steckt
vollständig in diesen Schaltern, nicht in abgewandeltem Code.

Nachziehen, wenn sich in den Originalen etwas getan hat:

```bash
node scripts/quellen-holen.mjs --pruefen   # nur melden, was auseinanderläuft
node scripts/quellen-holen.mjs             # übernehmen
SITE_BASE=/site node site/scripts/build.mjs
```

## Nicht für Suchmaschinen

`robots.txt` sperrt alles, dazu kommt `X-Robots-Tag: noindex, nofollow` aus
`netlify.toml`. Die Adressen für Suchmaschinen (canonical, hreflang) in der
gebauten Website zeigen weiterhin auf die echte Website — die Vorführ-Fassung
soll ihr keine Konkurrenz machen.
