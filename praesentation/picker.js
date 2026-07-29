/* ==========================================================================
   Auswahl-Werkzeug für den Anpassungswunsch

   Wird vom Präsentations-Rahmen in beide eingebetteten Ansichten gehängt —
   Website wie Verwaltung. Weil beide von derselben Herkunft ausgeliefert
   werden, darf der Rahmen direkt im Dokument der Ansicht arbeiten; es wird
   also nichts in die Seiten eingebaut, was dort dauerhaft bliebe.

   Zwei Genauigkeiten:
     "element" — was unter dem Zeiger liegt: Bild, Knopf, Absatz, ganzer Shop …
     "wort"    — genau ein Wort im Text, über die Schreibmarke an dieser Stelle

   Ausgewählt wird nichts verändert: die Markierung liegt als eigene Fläche
   über der Seite (durchlässig für Mausereignisse), damit weder Layout noch
   Inhalt der Ansicht angefasst werden.
   ========================================================================== */

/** Zeichen, die zu einem Wort gehören (inkl. Umlaute, Ziffern, Bindestrich). */
const WORTZEICHEN = /[\p{L}\p{N}'’‑-]/u;

/** Elemente, die als Auswahl nichts hergeben. */
const UEBERSPRINGEN = new Set(["HTML", "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

const kurz = (v, n = 90) => {
  const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};

/* ------------------------------------------------------------- benennung */

/** Menschenlesbare Art des Elements. */
function art(node) {
  if (!node || node.nodeType !== 1) return "Text";
  const tag = node.tagName;
  const rolle = (node.getAttribute("role") || "").toLowerCase();
  if (tag === "IMG" || tag === "PICTURE") return "Bild";
  if (tag === "VIDEO") return "Video";
  if (tag === "svg" || tag === "SVG") return "Grafik";
  if (tag === "BUTTON" || rolle === "button") return "Knopf";
  if (tag === "A") return "Link";
  if (/^H[1-6]$/.test(tag)) return "Überschrift";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return "Eingabefeld";
  if (tag === "LABEL") return "Feldbeschriftung";
  if (tag === "LI") return "Listenpunkt";
  if (tag === "UL" || tag === "OL") return "Liste";
  if (tag === "P") return "Absatz";
  if (tag === "FORM") return "Formular";
  if (tag === "TABLE") return "Tabelle";
  if (tag === "SECTION") return "Abschnitt";
  if (tag === "HEADER") return "Kopfbereich";
  if (tag === "FOOTER") return "Fussbereich";
  if (tag === "NAV") return "Navigation";
  if (tag === "FIGURE") return "Bild mit Beschriftung";
  if (tag === "BODY") return "Ganze Seite";
  return "Bereich";
}

/** Kurzer Name des Elements — was man beim Hinschauen sagen würde. */
function bezeichnung(node) {
  if (!node || node.nodeType !== 1) return "";
  const attr = (n) => (node.getAttribute(n) || "").trim();
  const t =
    attr("aria-label") ||
    attr("alt") ||
    node.title ||
    attr("placeholder") ||
    (node.tagName === "INPUT" || node.tagName === "SELECT" || node.tagName === "TEXTAREA"
      ? String(node.value || "")
      : "") ||
    (node.textContent || "");
  const sauber = kurz(t);
  if (sauber) return sauber;
  if (node.tagName === "IMG") return "Bild ohne Beschriftung";
  if (node.tagName === "VIDEO") return "Video";
  return node.tagName.toLowerCase();
}

/** Pfad im Dokument — damit sich die Stelle im Code wiederfinden lässt. */
function pfad(node) {
  const teile = [];
  let n = node;
  while (n && n.nodeType === 1 && n.tagName !== "BODY" && teile.length < 6) {
    let teil = n.tagName.toLowerCase();
    if (n.id) {
      teile.unshift(teil + "#" + n.id);
      break; // eine id ist eindeutig — weiter oben braucht es nichts mehr
    }
    const klasse = Array.from(n.classList || []).find((c) => !c.startsWith("wunsch-"));
    if (klasse) teil += "." + klasse;
    const gleiche = n.parentElement
      ? Array.from(n.parentElement.children).filter((k) => k.tagName === n.tagName)
      : [];
    if (gleiche.length > 1) teil += `:nth-of-type(${gleiche.indexOf(n) + 1})`;
    teile.unshift(teil);
    n = n.parentElement;
  }
  return teile.join(" › ") || "body";
}

/**
 * Umgebender Abschnitt. Auf der Website sind das die `section`-Blöcke, in der
 * Verwaltung die Ansicht samt Gruppe — beides führt zur Stelle, an der man es
 * ändern würde.
 */
function abschnittVon(node, istVerwaltung) {
  if (!node || node.nodeType !== 1) return { id: "", titel: "" };

  if (istVerwaltung) {
    const doc = node.ownerDocument;
    const aktiv = doc.querySelector(".nav-item.on");
    const ansichtTitel = kurz(doc.querySelector(".view-head h2")?.textContent || "", 60);
    const gruppe = node.closest?.(".group");
    const gruppenTitel = kurz(gruppe?.querySelector(".group-title")?.textContent || "", 60);
    const id = aktiv?.dataset?.nav || "";
    const titel = [ansichtTitel, gruppenTitel].filter(Boolean).join(" › ");
    return { id, titel: titel || ansichtTitel || "Verwaltung" };
  }

  const sec = node.closest?.("section[id], section, header, footer");
  if (!sec) return { id: "", titel: "" };
  const id = sec.id || (sec.tagName === "HEADER" ? "header" : sec.tagName === "FOOTER" ? "footer" : "");
  const h = sec.querySelector?.("h1, h2, h3");
  return { id, titel: kurz(h?.textContent || "", 60) };
}

/* --------------------------------------------------------------- wort finden */

/** Schreibmarke an einer Bildschirmstelle — die Browser können das verschieden. */
function markeBei(doc, x, y) {
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

/** Bereich um genau das Wort unter dem Zeiger — oder null, wenn dort keins ist. */
function wortBei(doc, x, y) {
  const marke = markeBei(doc, x, y);
  if (!marke || !marke.node || marke.node.nodeType !== 3) return null;

  const text = marke.node.nodeValue || "";
  if (!text.trim()) return null;

  // Steht die Marke hinter dem Wort (Klick auf die rechte Hälfte des letzten
  // Zeichens), zählt das Zeichen davor.
  let i = Math.min(marke.offset, text.length - 1);
  if (!WORTZEICHEN.test(text[i] || "") && WORTZEICHEN.test(text[i - 1] || "")) i -= 1;
  if (!WORTZEICHEN.test(text[i] || "")) return null;

  let start = i;
  let ende = i + 1;
  while (start > 0 && WORTZEICHEN.test(text[start - 1])) start--;
  while (ende < text.length && WORTZEICHEN.test(text[ende])) ende++;

  const bereich = doc.createRange();
  bereich.setStart(marke.node, start);
  bereich.setEnd(marke.node, ende);
  return bereich;
}

/* ------------------------------------------------------------------ einbau */

/**
 * Auswahl-Werkzeug in ein eingebettetes Fenster hängen.
 *
 * @param {Window} win  Fenster der Ansicht (gleiche Herkunft)
 * @param {{onPick:Function, onHover?:Function, istVerwaltung?:boolean, ansicht:string}} opts
 */
export function installPicker(win, opts) {
  const doc = win.document;
  const { onPick, onHover, istVerwaltung = false, ansicht } = opts;

  let an = false;
  let genauigkeit = "element";
  let pausiert = false;
  let ziel = null; // Element oder Range

  /* --------------------------------------------------------- markierung */

  const huelle = doc.createElement("div");
  huelle.className = "wunsch-huelle";
  huelle.setAttribute("aria-hidden", "true");
  Object.assign(huelle.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483646",
    pointerEvents: "none",
    display: "none",
  });

  const stil = doc.createElement("style");
  stil.textContent = `
    .wunsch-an, .wunsch-an * { cursor: crosshair !important; }
    .wunsch-kasten {
      position: fixed; pointer-events: none;
      outline: 2px solid #ff3d6e; outline-offset: 1px;
      background: rgba(255,61,110,.14);
      border-radius: 2px;
    }
    .wunsch-fahne {
      position: fixed; pointer-events: none;
      background: #ff3d6e; color: #fff; border-radius: 4px;
      font: 600 11px/1.35 system-ui, sans-serif; letter-spacing: .02em;
      padding: 3px 7px; white-space: nowrap;
      max-width: 60vw; overflow: hidden; text-overflow: ellipsis;
      box-shadow: 0 4px 14px rgba(0,0,0,.4);
    }
  `;

  function anhaengen() {
    if (!huelle.isConnected) (doc.body || doc.documentElement).appendChild(huelle);
    if (!stil.isConnected) (doc.head || doc.documentElement).appendChild(stil);
  }

  /** Rechtecke des Ziels — ein Bereich kann über mehrere Zeilen laufen. */
  const rechtecke = (z) => {
    if (!z) return [];
    const r = typeof z.getClientRects === "function" ? Array.from(z.getClientRects()) : [];
    if (r.length) return r.filter((k) => k.width > 0 && k.height > 0);
    const b = z.getBoundingClientRect?.();
    return b && b.width > 0 ? [b] : [];
  };

  function zeichne(text) {
    huelle.textContent = "";
    const r = rechtecke(ziel);
    if (!r.length) {
      huelle.style.display = "none";
      return;
    }
    huelle.style.display = "block";
    r.forEach((k) => {
      const kasten = doc.createElement("div");
      kasten.className = "wunsch-kasten";
      Object.assign(kasten.style, {
        left: k.left + "px",
        top: k.top + "px",
        width: k.width + "px",
        height: k.height + "px",
      });
      huelle.appendChild(kasten);
    });
    if (text) {
      const erste = r[0];
      const fahne = doc.createElement("div");
      fahne.className = "wunsch-fahne";
      fahne.textContent = text;
      // Über dem Ziel, ausser ganz oben — dann darunter.
      const obenDrueber = erste.top > 26;
      Object.assign(fahne.style, {
        left: Math.max(4, erste.left) + "px",
        top: (obenDrueber ? erste.top - 24 : erste.bottom + 6) + "px",
      });
      huelle.appendChild(fahne);
    }
  }

  function loesche() {
    ziel = null;
    huelle.textContent = "";
    huelle.style.display = "none";
  }

  /* ----------------------------------------------------------- beschreiben */

  /** Element, zu dem ein Ziel gehört (bei einem Wort: dessen Elternelement). */
  const elementVon = (z) => {
    if (!z) return null;
    if (z.nodeType === 1) return z;
    const n = z.commonAncestorContainer || z.startContainer;
    return n && n.nodeType === 1 ? n : n?.parentElement || null;
  };

  function beschreibe(z) {
    const istWort = !!z && z.nodeType !== 1;
    const element = elementVon(z);
    const abschnitt = abschnittVon(element, istVerwaltung);
    const label = istWort ? String(z.toString()).trim() : bezeichnung(element);

    return {
      ansicht,
      art: istWort ? "Wort" : art(element),
      label,
      tag: element ? element.tagName.toLowerCase() : "",
      pfad: pfad(element),
      abschnitt: abschnitt.id,
      abschnittTitel: abschnitt.titel,
      kontext: istWort ? kurz(element?.textContent || "", 180) : kurz(element?.textContent || "", 180),
      url: String(win.location.href),
      lang: doc.documentElement.getAttribute("lang") || "",
    };
  }

  /**
   * Stufenleiter von der genauesten Auswahl nach oben — damit sich im Dialog
   * auch „der ganze Shop“ statt nur „dieses eine Wort“ wählen lässt.
   */
  function stufenVon(z) {
    const stufen = [];
    if (z && z.nodeType !== 1) stufen.push({ ziel: z, info: beschreibe(z) });
    let n = elementVon(z);
    while (n && n.nodeType === 1 && !UEBERSPRINGEN.has(n.tagName) && stufen.length < 9) {
      stufen.push({ ziel: n, info: beschreibe(n) });
      if (n.tagName === "BODY") break;
      n = n.parentElement;
    }
    return stufen;
  }

  /* --------------------------------------------------------------- zeiger */

  let letztesX = 0;
  let letztesY = 0;

  function zielBei(x, y) {
    if (genauigkeit === "wort") {
      const w = wortBei(doc, x, y);
      if (w) return w;
    }
    const el = doc.elementFromPoint(x, y);
    if (!el || UEBERSPRINGEN.has(el.tagName)) return doc.body;
    return el;
  }

  function beiBewegung(e) {
    if (!an || pausiert) return;
    letztesX = e.clientX;
    letztesY = e.clientY;
    const neu = zielBei(e.clientX, e.clientY);
    if (!neu) return loesche();
    ziel = neu;
    const info = beschreibe(ziel);
    zeichne(`${info.art} · ${kurz(info.label, 46) || "—"}`);
    onHover?.(info);
  }

  function beiKlick(e) {
    if (!an) return;
    e.preventDefault();
    e.stopPropagation();
    if (pausiert) return;
    const gewaehlt = zielBei(e.clientX, e.clientY);
    if (!gewaehlt) return;
    ziel = gewaehlt;
    zeichne(kurz(beschreibe(ziel).label, 46));
    pausiert = true;
    onPick({ stufen: stufenVon(ziel) });
  }

  /* Im Wunsch-Modus soll die Ansicht nichts tun — nicht navigieren, nichts
     abschicken, keine Tasten auslösen. Sonst führt ein Klick auf „Speichern“
     in der Verwaltung eine echte Aktion aus, statt die Stelle zu melden. */
  function abfangen(e) {
    if (!an) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function beiScroll() {
    if (!an || !ziel) return;
    // Beim Rollen wandert die Stelle mit; bei Wörtern lieber neu suchen,
    // damit die Markierung nicht auf einem alten Rechteck kleben bleibt.
    if (!pausiert && genauigkeit === "wort") {
      const w = wortBei(doc, letztesX, letztesY);
      if (w) ziel = w;
    }
    zeichne(kurz(beschreibe(ziel).label, 46));
  }

  const zuhoerer = [
    ["mousemove", beiBewegung, true],
    ["click", beiKlick, true],
    ["submit", abfangen, true],
    ["keydown", abfangen, true],
    ["scroll", beiScroll, true],
    ["mouseleave", () => an && !pausiert && loesche(), true],
  ];
  zuhoerer.forEach(([typ, fn, capture]) => doc.addEventListener(typ, fn, capture));
  win.addEventListener("resize", beiScroll);

  /* ------------------------------------------------------------------ nach aussen */

  return {
    /** Modus setzen: an/aus und Genauigkeit ("element" | "wort"). */
    setzeModus(neuAn, neueGenauigkeit) {
      an = !!neuAn;
      if (neueGenauigkeit) genauigkeit = neueGenauigkeit;
      pausiert = false;
      anhaengen();
      doc.documentElement.classList.toggle("wunsch-an", an);
      if (!an) loesche();
      else if (letztesX || letztesY) {
        const neu = zielBei(letztesX, letztesY);
        if (neu) {
          ziel = neu;
          zeichne(kurz(beschreibe(ziel).label, 46));
        }
      }
    },
    /** Auswahl von aussen umsetzen (Stufenwahl im Dialog). */
    hervorhebe(z) {
      ziel = z;
      zeichne(kurz(beschreibe(z).label, 46));
    },
    /** Nach dem Dialog wieder auf Zeigerbewegung hören. */
    weiter() {
      pausiert = false;
      loesche();
    },
    aufraeumen() {
      zuhoerer.forEach(([typ, fn, capture]) => doc.removeEventListener(typ, fn, capture));
      win.removeEventListener("resize", beiScroll);
      doc.documentElement.classList.remove("wunsch-an");
      huelle.remove();
      stil.remove();
    },
  };
}
