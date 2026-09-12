#!/usr/bin/env python3
"""
Costruisce il messaggio Telegram della proposta SEO — ben strutturato (HTML),
con sezioni scandite, KPI in tabella monospace, keyword e modifiche numerate.

Legge da .state/: gsc_snapshot.json, keyword_report.json, report.json (se claude
lo produce, strutturato) oppure report.md (fallback). Stampa il messaggio HTML
pronto per sendMessage(parse_mode=HTML). Rispetta il limite 4096 caratteri.

================================================================================
CONFORMITÀ HTML — 9 direttive della Telegram Bot API (formattazione "HTML style"):
  1. Solo i tag elencati in ALLOWED_TAGS sono supportati (b/strong, i/em, u/ins,
     s/strike/del, span class="tg-spoiler"/tg-spoiler, a href, code, pre, blockquote).
  2. Ogni <, >, & che NON fa parte di un tag o di una entity va sostituito con
     &lt; &gt; &amp; → tutto il contenuto dinamico passa per esc() (html.escape).
  3. Sono supportate tutte le entity numeriche (&#NN;).
  4. Tra le named entity sono supportate SOLO &lt; &gt; &amp; &quot; (esc() le rispetta).
  5. Per indicare il linguaggio di un blocco si annida <pre><code class="language-..">.
  6. Per un <code> isolato NON si può specificare il linguaggio.
  7. Gli emoji devono essere emoji Unicode validi (usati come testo, non come tag).
  8. Le custom-emoji (tg-emoji) sono riservate ai bot con username Fragment → non usate.
  9. I tag devono essere bilanciati e correttamente annidati; niente attributi non
     supportati. _sanitize() neutralizza tag non ammessi e _close_open_tags() ribilancia
     dopo l'eventuale troncamento a 4096 (così un taglio non lascia mai un tag aperto).
================================================================================

Uso: python3 format_telegram_msg.py <DATESTAMP> [--title "Proposta"] [--files "f1,f2"]
"""
import html
import json
import os
import re
import sys

STATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".state")
TG_LIMIT = 4096
SEP = "━━━━━━━━━━━━━━━━━━━━"

# Direttiva 1+9: insieme chiuso dei tag che Telegram accetta in parse_mode=HTML.
ALLOWED_TAGS = {"b", "strong", "i", "em", "u", "ins", "s", "strike", "del",
                "a", "code", "pre", "blockquote", "span", "tg-spoiler"}
# Tag che NON portano testo proprio da ribilanciare se restano aperti dopo il taglio.
_VOID = set()


def _sanitize(msg):
    """Direttiva 1+9: neutralizza qualsiasi tag fuori da ALLOWED_TAGS rendendolo testo
    letterale (&lt;…&gt;), così un tag non previsto non fa fallire sendMessage con 400."""
    def repl(m):
        name = m.group(1).lower()
        if name in ALLOWED_TAGS:
            return m.group(0)
        return m.group(0).replace("<", "&lt;").replace(">", "&gt;")
    return re.sub(r"</?([a-zA-Z0-9-]+)(?:\s[^>]*)?>", repl, msg)


def _close_open_tags(msg):
    """Direttiva 9: dopo un eventuale troncamento, chiude i tag rimasti aperti nell'ordine
    inverso (uno <b> tagliato a metà messaggio romperebbe il parsing HTML di Telegram)."""
    stack = []
    for m in re.finditer(r"<(/?)([a-zA-Z0-9-]+)(?:\s[^>]*)?>", msg):
        closing, name = m.group(1), m.group(2).lower()
        if name not in ALLOWED_TAGS or name in _VOID:
            continue
        if closing:
            if stack and stack[-1] == name:
                stack.pop()
        else:
            stack.append(name)
    for name in reversed(stack):
        msg += f"</{name}>"
    return msg

MONTHS_IT = ["", "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
             "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]


def esc(s):
    return html.escape(str(s), quote=False)


def load(name):
    try:
        return json.load(open(os.path.join(STATE_DIR, name)))
    except Exception:
        return None


def pretty_date(datestamp):
    try:
        y, m, d = datestamp[:4], int(datestamp[4:6]), int(datestamp[6:8])
        return f"{d} {MONTHS_IT[m]} {y}"
    except Exception:
        return datestamp


def kpi_table(totals):
    """Tabella KPI allineata in monospace."""
    if not totals:
        return ""
    rows = [
        ("Click", str(totals.get("clicks", 0))),
        ("Impression", str(totals.get("impressions", 0))),
        ("CTR medio", f"{totals.get('ctr', 0)}%"),
        ("Posizione", str(totals.get("position", 0))),
    ]
    w = max(len(r[0]) for r in rows)
    body = "\n".join(f"{name.ljust(w)}  {val}" for name, val in rows)
    return f"<pre>{esc(body)}</pre>"


def clean_md(s):
    """Rimuove markdown inline e normalizza spazi."""
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)   # grassetto
    s = s.replace("`", "").replace("*", "")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def truncate(s, n):
    """Taglia a confine di parola con ellissi."""
    if len(s) <= n:
        return s
    return s[:n].rsplit(" ", 1)[0].rstrip(" ,;:.") + "…"


def delta(now, prev, lower_better=False):
    """Freccia con segno: ▲/▼/=, emoji verde/rosso secondo se è un miglioramento."""
    d = round(now - prev, 1)
    if d == 0:
        return "="
    better = (d < 0) if lower_better else (d > 0)
    emo = "🟢" if better else "🔴"
    arrow = "▲" if d > 0 else "▼"
    return f"{emo}{arrow}{abs(d)}"


def wow_line(wow):
    """Riga compatta confronto settimana corrente vs precedente."""
    c, i = wow.get("clicks", {}), wow.get("impressions", {})
    p = wow.get("position", {})
    parts = []
    if c:
        parts.append(f"Click {c.get('now', 0)} ({delta(c.get('now', 0), c.get('prev', 0))})")
    if i:
        parts.append(f"Impr {i.get('now', 0)} ({delta(i.get('now', 0), i.get('prev', 0))})")
    if p:
        parts.append(f"Pos {p.get('now', 0)} ({delta(p.get('now', 0), p.get('prev', 0), lower_better=True)})")
    return "  ·  ".join(parts)


def parse_report_md(datestamp):
    """Fallback: estrae modifiche + impatto dal report.md di claude.
    Supporta sia '- **file** — what' sia '1. **file** — what'.
    Il file può stare su nome semplice (site/x.html) o con backtick."""
    path = os.path.join(STATE_DIR, f"report_{datestamp}.md")
    if not os.path.isfile(path):
        return [], "", ""
    raw = open(path).read()
    # isola la sezione "Cosa ho cambiato" se presente
    section = raw
    m = re.search(r"##\s*Cosa ho cambiato(.+?)(?:\n##\s|\Z)", raw, re.S | re.I)
    if m:
        section = m.group(1)
    changes = []
    for cm in re.finditer(r"^\s*(?:[-*]|\d+\.)\s+\*\*`?([^`*\n]+?)`?\*\*\s*[—\-:]\s*(.+?)(?=\n\s*(?:[-*]|\d+\.)\s+\*\*|\n##|\Z)",
                          section, re.S | re.M):
        f = cm.group(1).strip().replace("site/", "")
        changes.append({"file": f, "what": truncate(clean_md(cm.group(2)), 150)})
    # impatto atteso
    impact = ""
    im = re.search(r"##\s*Impatto atteso\s*(.+?)(?:\n##\s|\Z)", raw, re.S | re.I)
    if im:
        impact = truncate(clean_md(im.group(1)), 240)
    return changes, "", impact


def build(datestamp, title, files_csv):
    snap = (load("gsc_snapshot.json") or {}).get("snapshot") or {}
    kw = load("keyword_report.json") or {}
    rep = load("report.json")  # strutturato se claude lo produce

    if rep and isinstance(rep, dict):
        changes = rep.get("changes", [])
        summary = rep.get("summary", "")
        impact = rep.get("expectedImpact", "")
    else:
        changes, summary, impact = parse_report_md(datestamp)

    P = []
    P.append(f"🔍 <b>{esc(title)} — {esc(pretty_date(datestamp))}</b>")
    if summary:
        # Direttiva 9: blockquote per la sintesi (contenuto escaped dentro un tag ammesso).
        P.append(f"<blockquote>{esc(summary)}</blockquote>")

    # Sezione dati
    totals = snap.get("totals")
    if totals:
        P.append(f"\n{SEP}\n📊 <b>Search Console</b> <i>(ultimi 28 giorni)</i>")
        P.append(kpi_table(totals))
        wow = snap.get("wow")
        if wow:
            P.append("<b>Settimana vs precedente:</b>")
            P.append(wow_line(wow))

    # Pagina top
    tp = snap.get("topPageItem")
    if tp:
        page = tp.get("key", "").replace("https://adoff.app", "").replace("http://adoff.app", "") or "/"
        P.append(f"\n⭐ <b>Pagina top:</b> <code>{esc(page)}</code>")
        P.append(f"   <i>{tp.get('impressions', 0)} impr · CTR {tp.get('ctr', 0)}% · pos {tp.get('position', 0)}</i>")

    # Sezione keyword
    gaps = (kw.get("gaps") or [])[:5]
    push = (kw.get("toPush") or [])[:4]
    if gaps or push:
        P.append(f"\n{SEP}\n🔑 <b>Keyword del momento</b>")
        if push:
            items = ", ".join(f"{esc(p['q'])} <i>(pos {p['position']})</i>" for p in push)
            P.append(f"▫️ <b>Da spingere:</b> {items}")
        if gaps:
            P.append(f"▫️ <b>Gap da coprire:</b> {esc(', '.join(gaps))}")
        if kw.get("totalKeywords"):
            P.append(f"<i>{kw['totalKeywords']} keyword analizzate in {len(kw.get('languages', []))} lingue</i>")

    # Sezione modifiche
    if changes:
        P.append(f"\n{SEP}\n✏️ <b>Modifiche proposte ({len(changes)})</b>")
        for i, c in enumerate(changes, 1):
            f = esc(c.get("file", ""))
            what = esc(c.get("what", ""))
            why = c.get("why", "")
            line = f"<b>{i}.</b> <code>{f}</code> — {what}"
            if why:
                line += f"\n   <i>{esc(why)}</i>"
            P.append(line)

    # Sezione AUTORITÀ off-page (azioni manuali — il vero collo di bottiglia citabilità AI)
    auth = load("authority_report.json")
    if auth and isinstance(auth, dict):
        todo = [t for t in auth.get("targets", []) if not t.get("present")]
        if todo:
            P.append(f"\n{SEP}\n🏆 <b>Autorità off-page</b> <i>({auth.get('offsiteMentions', 0)} menzioni off-site)</i>")
            P.append("<i>Azioni manuali ad alto impatto sulla citabilità AI:</i>")
            for t in sorted(todo, key=lambda x: x.get("priority", 9))[:3]:
                P.append(f"▫️ <b>[P{t.get('priority','?')}] {esc(t.get('name',''))}</b>: {esc(truncate(t.get('action',''), 110))}")

    # Verdetto freno content-sprawl (se CONSOLIDATE, spiega perché non ci sono pagine nuove)
    spr = load("sprawl_guard.json")
    if spr and isinstance(spr, dict) and spr.get("verdict") == "CONSOLIDATE":
        wt = len(spr.get("withTraction", [])); n = spr.get("landingCount", 0)
        P.append(f"\n🧱 <b>Freno anti-sprawl attivo</b>: solo {wt}/{n} landing hanno trazione → "
                 f"consolido le esistenti, niente pagine nuove (evita penalità thin-content).")

    # File toccati
    if files_csv:
        flist = [f.strip() for f in files_csv.split(",") if f.strip()]
        if flist:
            P.append(f"\n📁 <b>File:</b> {esc(', '.join(flist))}")

    if impact:
        P.append(f"\n🎯 <b>Impatto atteso:</b> {esc(impact)}")

    # Call to action
    P.append(f"\n{SEP}\n➡️ Rispondi <b>OK</b> per pubblicare, oppure scrivi <b>cosa migliorare</b>.")

    msg = "\n".join(P)
    msg = _sanitize(msg)                       # direttiva 1: solo tag ammessi
    if len(msg) > TG_LIMIT:
        cta = f"\n\n{SEP}\n➡️ Rispondi <b>OK</b> per pubblicare."
        msg = msg[:TG_LIMIT - len(cta) - 20].rsplit("\n", 1)[0]
        msg = _close_open_tags(msg) + cta      # direttiva 9: niente tag aperti dopo il taglio
    return msg


if __name__ == "__main__":
    ds = sys.argv[1] if len(sys.argv) > 1 else ""
    title = "Proposta SEO/AEO settimanale"
    files_csv = ""
    args = sys.argv[2:]
    for i, a in enumerate(args):
        if a == "--title" and i + 1 < len(args):
            title = args[i + 1]
        if a == "--files" and i + 1 < len(args):
            files_csv = args[i + 1]
    print(build(ds, title, files_csv))
