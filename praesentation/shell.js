/* ==========================================================================
   Präsentations-Rahmen

   Hält zwei Ansichten nebeneinander bereit — die Website und die Verwaltung —
   und schaltet zwischen ihnen um, ohne dass eine davon neu lädt. Beide kommen
   von derselben Herkunft, deshalb darf der Rahmen das Auswahl-Werkzeug
   (picker.js) direkt in ihnen betreiben.

   Rechts steht die Seitenleiste mit allen gewünschten Änderungen dieser
   Sitzung. Ein Klick auf einen Eintrag springt zurück an die Stelle, um die es
   ging — auch wenn sie in der anderen Ansicht liegt.

   Weg eines Wunsches:

     Auswahl in der Ansicht ──▶ Dialog ──▶ RTDB /quantus_task_inbox
                                                   │  child_added
                                                   ▼
                                       Quantus (ai-sync) legt die Aufgabe
                                       im Projekt PRJ-YWRM4 an und entfernt
                                       den Eintrag wieder.

   Genau dieses Verschwinden ist die Rückmeldung: solange der Eintrag steht,
   war Quantus noch nicht offen; ist er weg, existiert die Aufgabe.

   Alle Adressen sind bewusst relativ — die Präsentation läuft damit an der
   Wurzel einer Domain genauso wie in einem Unterverzeichnis (GitHub Pages).
   ========================================================================== */

import { installPicker } from "./picker.js";

/* ------------------------------------------------------------ einstellungen */

/** Realtime Database (europe-west1) — dieselbe Instanz wie ai-sync. */
const RTDB = "https://jupidu-36804-default-rtdb.europe-west1.firebasedatabase.app";

/** Warteschlange, aus der Quantus die Aufgaben abholt. */
const INBOX = "quantus_task_inbox";

/** Projekt in Quantus, dem die Wünsche zugeordnet werden. */
const PROJEKT = "PRJ-YWRM4";

/** Adressen der beiden Ansichten, relativ zu dieser Seite. */
const SEITEN = {
  website: { "": "site/", de: "site/de/", fr: "site/fr/" },
  verwaltung: "verwaltung/",
};

/* -------------------------------------------------------------------- hilfen */

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, kinder = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "dataset") Object.assign(n.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  (Array.isArray(kinder) ? kinder : [kinder]).forEach((k) => {
    if (k == null) return;
    n.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
  });
  return n;
}

let meldungTimer = null;
function meldung(text, art = "") {
  document.querySelector(".meldung")?.remove();
  const n = el("div", { class: "meldung " + art }, text);
  document.body.appendChild(n);
  clearTimeout(meldungTimer);
  meldungTimer = setTimeout(() => n.remove(), 5200);
}

/** "gerade eben", "vor 3 Min." — kurz genug für die Seitenleiste. */
function vorWieLange(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "gerade eben";
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  return `vor ${Math.round(s / 3600)} Std.`;
}

/* -------------------------------------------------------------------- zustand */

const Z = {
  ansicht: "website",
  sprache: "",
  handy: false,
  wunschAn: false,
  genauigkeit: "element",
  filter: "alle",
};

/** Ansicht → { frame, rahmen, picker } */
const ansichten = {
  website: { frame: $("#frame-website"), rahmen: $("#rahmen-website"), picker: null },
  verwaltung: { frame: $("#frame-verwaltung"), rahmen: $("#rahmen-verwaltung"), picker: null },
};

/** Ansichtsname, wie ihn der Picker meldet ("Website") → Schlüssel oben. */
const schluesselVon = (name) => (name === "Verwaltung" ? "verwaltung" : "website");

/* --------------------------------------------------------- auswahl-werkzeug */

/**
 * Das Werkzeug in eine Ansicht hängen. Nach jedem Laden neu — beim Wechsel der
 * Sprache oder wenn in der Website ein Link angetippt wurde, ist das Dokument
 * ein anderes.
 */
function hefteAn(name) {
  const a = ansichten[name];
  let win;
  try {
    win = a.frame.contentWindow;
    if (!win || !win.document) return;
    // Zugriff prüfen: bei fremder Herkunft wirft das hier.
    void win.document.body;
  } catch (e) {
    console.warn("[Präsentation] Ansicht nicht erreichbar:", name, e.message);
    return;
  }

  a.picker?.aufraeumen();
  a.picker = installPicker(win, {
    ansicht: name === "website" ? "Website" : "Verwaltung",
    istVerwaltung: name === "verwaltung",
    onHover: (info) => {
      if (Z.ansicht !== name) return;
      $("#band-ziel").textContent = info.label ? `${info.art}: ${info.label}` : "";
    },
    onPick: (auswahl) => {
      if (Z.ansicht !== name) return;
      oeffneDialog(auswahl, a.picker);
    },
  });
  a.picker.setzeModus(Z.wunschAn && Z.ansicht === name, Z.genauigkeit);
}

Object.entries(ansichten).forEach(([name, a]) => {
  a.frame.addEventListener("load", () => hefteAn(name));
});

/* ------------------------------------------------------------------ umschalten */

function zeigeAnsicht(name) {
  Z.ansicht = name;

  Object.entries(ansichten).forEach(([n, a]) => {
    a.rahmen.hidden = n !== name;
    // Nur die sichtbare Ansicht darf auf Klicks lauern.
    a.picker?.setzeModus(Z.wunschAn && n === name, Z.genauigkeit);
  });

  document.querySelectorAll(".um-knopf").forEach((b) => {
    const an = b.dataset.ansicht === name;
    b.classList.toggle("an", an);
    b.setAttribute("aria-selected", String(an));
  });

  document.querySelectorAll("[data-nur]").forEach((n) => {
    n.hidden = n.dataset.nur !== name;
  });

  document.body.classList.toggle("handy", Z.handy && name === "website");
  $("#band-ziel").textContent = "";
}

function setzeWunschModus(an) {
  Z.wunschAn = !!an;
  const knopf = $("#wunsch-schalter");
  knopf.setAttribute("aria-pressed", String(Z.wunschAn));
  knopf.textContent = Z.wunschAn ? "Wunsch-Modus beenden" : "Anpassungswunsch";
  $("#band").hidden = !Z.wunschAn;
  document.body.classList.toggle("mit-band", Z.wunschAn);
  Object.entries(ansichten).forEach(([n, a]) =>
    a.picker?.setzeModus(Z.wunschAn && n === Z.ansicht, Z.genauigkeit)
  );
  if (!Z.wunschAn) $("#band-ziel").textContent = "";
}

/* ---------------------------------------------------------------- dialog */

/**
 * Nach der Auswahl: zeigen, was getroffen wurde, die Stufe wählen lassen
 * (Wort → Absatz → ganzer Abschnitt) und den Wunsch entgegennehmen.
 */
function oeffneDialog(auswahl, picker) {
  const stufen = auswahl.stufen;
  let index = 0;

  const feld = el("textarea", {
    placeholder: "Was soll hier geändert werden?",
    "aria-label": "Anpassungswunsch",
  });

  const zielKarte = el("div", { class: "ziel-karte" });
  const stufenReihe = el("div", { class: "stufen-reihe" });
  const senden = el("button", { class: "knopf voll", type: "submit" }, "Aufgabe anlegen");

  function zeichneZiel() {
    const info = stufen[index].info;
    zielKarte.textContent = "";
    zielKarte.append(
      el("div", { class: "ziel-art" }, info.ansicht + " · " + info.art),
      el("div", { class: "ziel-name" }, info.label || "(ohne Text)"),
      el(
        "div",
        { class: "ziel-pfad" },
        [info.abschnittTitel && "Abschnitt: " + info.abschnittTitel, info.pfad]
          .filter(Boolean)
          .join("  ·  ")
      )
    );
    Array.from(stufenReihe.children).forEach((b, i) => b.classList.toggle("an", i === index));
    picker.hervorhebe(stufen[index].ziel);
  }

  stufen.forEach((s, i) => {
    stufenReihe.appendChild(
      el(
        "button",
        {
          class: "stufe",
          type: "button",
          title: s.info.label,
          onclick: () => {
            index = i;
            zeichneZiel();
            feld.focus();
          },
        },
        i === 0 && s.info.art === "Wort" ? `„${s.info.label}“` : s.info.art
      )
    );
  });

  const schleier = el("div", { class: "schleier" });

  function schliessen() {
    schleier.remove();
    document.removeEventListener("keydown", beiTaste);
    picker.weiter();
  }

  function beiTaste(e) {
    if (e.key === "Escape") schliessen();
  }

  const formular = el(
    "form",
    {
      class: "dialog",
      onsubmit: async (e) => {
        e.preventDefault();
        const text = feld.value.trim();
        if (!text) return feld.focus();
        senden.disabled = true;
        senden.textContent = "lege an …";
        try {
          const eintrag = await sendeWunsch(stufen[index].info, text);
          schliessen();
          ergaenzeListe(eintrag);
          meldung("Wunsch abgeschickt — wird in Quantus zur Aufgabe.");
        } catch (err) {
          senden.disabled = false;
          senden.textContent = "Aufgabe anlegen";
          meldung("Konnte die Aufgabe nicht anlegen: " + err.message, "fehler");
        }
      },
    },
    [
      el("div", { class: "dialog-kopf" }, [el("h2", {}, "Anpassungswunsch")]),
      el("div", { class: "dialog-koerper" }, [
        zielKarte,
        stufen.length > 1
          ? el("div", { class: "stufen" }, [
              el("p", { class: "stufen-titel" }, "Grösse der Auswahl — vom Wort bis zum ganzen Abschnitt:"),
              stufenReihe,
            ])
          : null,
        feld,
      ]),
      el("div", { class: "dialog-fuss" }, [
        el("span", { class: "hinweis" }, `Wird Aufgabe im Projekt ${PROJEKT}. Strg/Cmd + Enter schickt ab.`),
        el("button", { class: "knopf leise", type: "button", onclick: schliessen }, "Abbrechen"),
        senden,
      ]),
    ]
  );

  feld.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") formular.requestSubmit();
  });

  schleier.appendChild(formular);
  schleier.addEventListener("mousedown", (e) => {
    if (e.target === schleier) schliessen();
  });
  document.addEventListener("keydown", beiTaste);
  document.body.appendChild(schleier);

  zeichneZiel();
  feld.focus();
}

/* ------------------------------------------------------------- abschicken */

/** Lesbarer Name der Stelle — daraus wird der Aufgabentitel. */
function stelleVon(info) {
  const teile = [info.ansicht];
  if (info.abschnittTitel) teile.push(info.abschnittTitel.replace(/[.!?…]+$/, ""));
  else if (info.abschnitt) teile.push(info.abschnitt);
  return teile.join(" › ");
}

/**
 * Titelzusatz: das Angewählte in einem Stück. Bei grossen Bereichen ist der
 * Text die ganze Abschnittsfläche — dann sagt die Art mehr als ein
 * abgeschnittener Absatz, und die Einzelheiten stehen ohnehin im Text darunter.
 */
function zusatzVon(info) {
  const label = String(info.label || "").replace(/\s+/g, " ").trim();
  if (!label) return info.art;
  if (label.length <= 60) return label;
  return `${info.art} „${label.slice(0, 40).trim()}…“`;
}

/**
 * Wunsch in die Warteschlange legen. Bewusst über die REST-Schnittstelle der
 * Realtime Database: der Rahmen kommt so ohne Firebase-SDK aus, und der Knoten
 * `quantus_task_inbox` ist in den Regeln ohnehin offen (er enthält nur, was
 * gerade auf dem Weg zu Quantus ist).
 */
async function sendeWunsch(info, text) {
  const stelle = stelleVon(info);

  const zeilen = [text, ""];
  zeilen.push("— Anpassungswunsch aus der Präsentation Sam Sparking —");
  zeilen.push(`Ansicht: ${info.ansicht}`);
  if (info.abschnittTitel || info.abschnitt)
    zeilen.push(`Abschnitt: ${info.abschnittTitel || "—"}${info.abschnitt ? ` (#${info.abschnitt})` : ""}`);
  zeilen.push(`Angewählt: ${info.art} — ${info.label || "(ohne Text)"}`);
  if (info.pfad) zeilen.push(`Stelle im Aufbau: ${info.pfad}`);
  if (info.kontext && info.kontext !== info.label) zeilen.push(`Umgebender Text: ${info.kontext}`);
  if (info.lang) zeilen.push(`Sprache: ${info.lang}`);
  if (info.url) zeilen.push(`Seite: ${info.url}`);

  const jetzt = new Date().toISOString();
  const eintrag = {
    title: `Website-Wunsch: ${stelle} — ${zusatzVon(info)}`.slice(0, 200),
    description: zeilen.join("\n"),
    status: "todo",
    priority: 3,
    source: "samsparking-praesentation",
    type: "anpassungswunsch",
    projectExternalId: PROJEKT,
    tags: ["Website", "Sam Sparking"],
    createdAt: jetzt,
    createdBy: "Präsentation",
  };

  const res = await fetch(`${RTDB}/${INBOX}.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(eintrag),
  });
  if (!res.ok) throw new Error(`Datenbank antwortet ${res.status}`);
  const { name: key } = await res.json();

  return {
    key,
    stelle,
    text,
    stand: "wartet",
    zeit: jetzt,
    ansicht: info.ansicht,
    art: info.art,
    label: info.label,
    selektor: info.selektor,
    sprache: info.lang,
  };
}

/* --------------------------------------------------------- seitenleiste */

const gesendet = [];

/** Zurück zu der Stelle, um die es in diesem Eintrag ging. */
function springeZu(eintrag) {
  const schluessel = schluesselVon(eintrag.ansicht);

  const hin = () => {
    const picker = ansichten[schluessel].picker;
    if (!picker) return meldung("Die Ansicht ist noch nicht bereit.", "fehler");
    if (!picker.zeigeStelle(eintrag.selektor))
      meldung("Diese Stelle gibt es so nicht mehr — die Ansicht hat sich geändert.", "fehler");
  };

  if (Z.ansicht !== schluessel) {
    zeigeAnsicht(schluessel);
    // Der Ansichtswechsel blendet nur um; kurz warten, bis gerechnet ist.
    setTimeout(hin, 120);
  } else {
    hin();
  }
}

function eintragKnoten(eintrag, nummer) {
  const springbar = !!eintrag.selektor;
  const stand =
    eintrag.stand === "ok"
      ? "in Quantus angelegt"
      : eintrag.stand === "fehler"
      ? "Quantus war nicht offen"
      : "wartet auf Quantus";

  return el(
    springbar ? "button" : "div",
    {
      class: "eintrag" + (springbar ? " springbar" : ""),
      type: springbar ? "button" : null,
      title: springbar ? "Zur Stelle springen" : null,
      onclick: springbar ? () => springeZu(eintrag) : null,
    },
    [
      el("div", { class: "ei-kopf" }, [
        el("span", { class: "ei-quelle " + eintrag.ansicht }, eintrag.ansicht),
        el("span", { class: "ei-nummer" }, "#" + nummer),
      ]),
      el("div", { class: "ei-stelle" }, eintrag.stelle),
      el(
        "div",
        { class: "ei-art", title: eintrag.label || "" },
        `${eintrag.art}: ${eintrag.label || "—"}`
      ),
      el("div", { class: "ei-text" }, eintrag.text),
      el("div", { class: "ei-fuss" }, [
        el("span", { class: "ei-stand " + eintrag.stand }, stand),
        el("span", { class: "ei-zeit" }, vorWieLange(eintrag.zeit)),
      ]),
    ]
  );
}

function zeichneListe() {
  const host = $("#sl-inhalt");
  host.textContent = "";

  $("#sl-zahl").textContent = String(gesendet.length);
  $("#zahl-chip").textContent = String(gesendet.length);

  const sichtbar =
    Z.filter === "alle" ? gesendet : gesendet.filter((g) => g.ansicht === Z.filter);

  if (!sichtbar.length) {
    host.appendChild(
      el("div", { class: "sl-leer" }, [
        el("strong", {}, gesendet.length ? "Nichts unter diesem Filter" : "Noch keine Änderung"),
        el(
          "span",
          {},
          gesendet.length
            ? "In der anderen Ansicht liegt etwas."
            : "Oben „Anpassungswunsch“ einschalten und in der Vorschau auf die Stelle tippen, die anders werden soll."
        ),
      ])
    );
  } else {
    // Neueste zuoberst; die Nummer zählt trotzdem in der Reihenfolge des Abschickens.
    sichtbar.forEach((g) => host.appendChild(eintragKnoten(g, gesendet.length - gesendet.indexOf(g))));
  }

  const offen = gesendet.filter((g) => g.stand === "wartet").length;
  const fertig = gesendet.filter((g) => g.stand === "ok").length;
  const punkt = $(".sl-punkt");
  const bilanz = $("#sl-bilanz");
  if (!gesendet.length) {
    punkt.className = "sl-punkt";
    bilanz.textContent = "Noch nichts abgeschickt";
  } else if (offen) {
    punkt.className = "sl-punkt wartet";
    bilanz.textContent = `${offen} wartet auf Quantus, ${fertig} angelegt`;
  } else {
    punkt.className = "sl-punkt ok";
    bilanz.textContent = `Alle ${gesendet.length} in Quantus angelegt`;
  }
}

function ergaenzeListe(eintrag) {
  gesendet.unshift(eintrag);
  if (window.matchMedia("(max-width: 1180px)").matches) oeffneLeiste(true);
  zeichneListe();
  beobachte(eintrag);
}

/**
 * Warten, bis Quantus den Eintrag abgeholt hat. Quantus entfernt ihn nach dem
 * Anlegen — ist er weg, existiert die Aufgabe. Nach zehn Minuten hören wir auf
 * zu fragen; dann war Quantus in dieser Zeit schlicht nicht offen.
 */
function beobachte(eintrag) {
  const bis = Date.now() + 10 * 60 * 1000;
  const frage = async () => {
    if (eintrag.stand !== "wartet") return;
    if (Date.now() > bis) {
      eintrag.stand = "fehler";
      return zeichneListe();
    }
    try {
      const res = await fetch(`${RTDB}/${INBOX}/${eintrag.key}.json`, { cache: "no-store" });
      const val = res.ok ? await res.json() : undefined;
      if (val === null) {
        eintrag.stand = "ok";
        return zeichneListe();
      }
    } catch (e) {
      /* Netz kurz weg — beim nächsten Mal wieder */
    }
    setTimeout(frage, 5000);
  };
  setTimeout(frage, 3000);
}

// Die Zeitangaben ("vor 3 Min.") altern mit.
setInterval(() => gesendet.length && zeichneListe(), 60000);

/* ------------------------------------------------------------- bedienung */

function oeffneLeiste(auf) {
  $("#seitenleiste").classList.toggle("offen", auf);
  $("#leiste-auf").setAttribute("aria-expanded", String(auf));
}

document.querySelectorAll(".um-knopf").forEach((b) =>
  b.addEventListener("click", () => zeigeAnsicht(b.dataset.ansicht))
);

document.querySelectorAll(".gen-knopf").forEach((b) =>
  b.addEventListener("click", () => {
    Z.genauigkeit = b.dataset.genauigkeit;
    document.querySelectorAll(".gen-knopf").forEach((k) =>
      k.classList.toggle("an", k.dataset.genauigkeit === Z.genauigkeit)
    );
    Object.entries(ansichten).forEach(([n, a]) =>
      a.picker?.setzeModus(Z.wunschAn && n === Z.ansicht, Z.genauigkeit)
    );
  })
);

document.querySelectorAll(".fil-knopf").forEach((b) =>
  b.addEventListener("click", () => {
    Z.filter = b.dataset.filter;
    document.querySelectorAll(".fil-knopf").forEach((k) =>
      k.classList.toggle("an", k.dataset.filter === Z.filter)
    );
    zeichneListe();
  })
);

$("#wunsch-schalter").addEventListener("click", () => setzeWunschModus(!Z.wunschAn));

$("#sprache").addEventListener("change", (e) => {
  Z.sprache = e.target.value;
  ansichten.website.frame.src = SEITEN.website[Z.sprache] || SEITEN.website[""];
});

$("#geraet").addEventListener("click", () => {
  Z.handy = !Z.handy;
  document.body.classList.toggle("handy", Z.handy && Z.ansicht === "website");
  $("#geraet").textContent = Z.handy ? "Desktop-Ansicht" : "Handy-Ansicht";
  $("#geraet").setAttribute("aria-pressed", String(Z.handy));
});

$("#neu-laden").addEventListener("click", () => {
  const a = ansichten[Z.ansicht];
  a.frame.src = a.frame.src;
});

$("#leiste-auf").addEventListener("click", () =>
  oeffneLeiste(!$("#seitenleiste").classList.contains("offen"))
);
$("#leiste-zu").addEventListener("click", () => oeffneLeiste(false));

// Escape beendet den Wunsch-Modus (wenn kein Dialog offen ist).
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || document.querySelector(".schleier")) return;
  if ($("#seitenleiste").classList.contains("offen")) oeffneLeiste(false);
  else if (Z.wunschAn) setzeWunschModus(false);
});

$("#sl-projekt").textContent = PROJEKT;
zeigeAnsicht("website");
zeichneListe();
