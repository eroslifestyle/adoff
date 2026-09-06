#!/usr/bin/env python3
"""Suite di controlli SEO/AEO deterministici (zero LLM) sul sito in site/.

Esecuzione dalla root del progetto:
    python3 sviluppo/seo-tools/seo_audit.py [--offline] [--json]

Output: sviluppo/seo-tools/.state/audit_findings.json
L'id di ogni finding è stabile tra run (sha1 di area+title+file, 12 char),
così a valle si può tracciare cosa è già stato risolto.

HEALTH SCORE = 100 - 10*high - 3*medium - 1*low, con minimo 0.
"""

import hashlib
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

# stesso dir dello script: pattern/lessici SEO (vedi audit_patterns.py)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_patterns import (  # noqa: E402
    ADOFF_PRO_RE, AI_CRAWLERS, BROKEN_PHRASES, FRESHNESS_RE, GENERIC_PRO_RE,
    RULES_NUM_RE, TRIAL_CTX_RE, TRIAL_RE, VERSION_RE,
)

# rimozione noise HTML per l'estrazione numerica (path SVG = finte versioni)
SVG_NOISE_RE = re.compile(r"(?is)<svg\b.*?</svg>")
STYLE_NOISE_RE = re.compile(r"(?is)<style\b.*?</style>")

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
STATE_DIR = ROOT / "sviluppo" / "seo-tools" / ".state"

SITEMAP_PATH = SITE / "sitemap.xml"
ROBOTS_PATH = SITE / "robots.txt"
LLMS_PATH = SITE / "llms.txt"
REDIRECTS_PATH = SITE / "_redirects"
I18N_DIR = SITE / "i18n"
MANIFEST_PATH = ROOT / "app" / "manifest.json"
RULES_PATH = ROOT / "app" / "rules" / "adblock-rules.json"

# I 15 dizionari reali del sito (esclusi _matrix.json e _same_ok.json, file interni)
LANGS = ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko",
         "pl", "pt", "ru", "tr", "zh"]

SITE_HOST = "adoff.app"
CURL_UA = "Mozilla/5.0 AdOff-audit"

# Soglie onpage (caratteri, da best practice SERP)
TITLE_MAX = 60
TITLE_MIN = 30
META_MAX = 160
META_MIN = 70

# tech.lastmod_uniform: sopra questa quota identica = freschezza non credibile
LASTMOD_UNIFORM_RATIO = 0.80

# crawl.sitemap_status: quante URL campionare via curl
SITEMAP_SAMPLE_N = 15
# tech.hreflang_reciprocity: quanti cluster verificare
RECIPROCITY_SAMPLE_N = 10
CURL_TIMEOUT_S = 10

# aeo.external_citations / aeo.freshness: pagine chiave per l'AEO
KEY_PAGES = [
    "vs/ublock-origin", "vs/adblock-plus", "vs/adguard", "vs/brave",
    "vs/totaladblock", "best-ad-blocker-2026", "how-it-works",
    "free-ad-blocker",
]
# Pattern "last updated" e lessici multilingua: in audit_patterns.py (import sopra)


# ══════════════════════════ UTILS ═══════════════════════════════════════

def finding_id(area: str, title: str, file: str = "") -> str:
    """Id stabile tra run: stesso problema = stesso id."""
    raw = f"{area}|{title}|{file}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def html_files() -> list:
    """Tutti gli HTML del sito (lingue incluse), deterministic order."""
    return sorted(SITE.rglob("*.html"))


def strip_scripts(html: str) -> str:
    """Rimuove il contenuto dei <script> prima di estrarre link/testi."""
    return re.sub(r"(?is)<script\b[^>]*>.*?</script>", " ", html)


def url_to_relpath(url: str):
    """URL del sito -> path locale sotto site/ (clean URL -> .html/index.html)."""
    path = urlparse(url).path
    clean = path.lstrip("/").rstrip("/")
    if clean == "":
        cand = SITE / "index.html"
        return cand if cand.exists() else None
    # ordine conta: file esatto prima di .html, e SOLO alla fine la dir/
    # (una dir esistente non è una pagina: se non c'è nemmeno index -> None)
    for cand in (SITE / clean, SITE / (clean + ".html"),
                 SITE / clean / "index.html"):
        if cand.is_file():
            return cand
    return None


def page_key(url_or_path: str) -> str:
    """Normalizza URL/path alla pagina logica senza prefisso lingua.

    /de/vs/adguard.html, /vs/adguard, vs/adguard.html -> vs/adguard
    Serve per confrontare sitemap, link e file su uno spazio comune.
    """
    p = url_or_path
    if p.startswith(("http://", "https://")):
        p = urlparse(p).path
    p = p.split("#")[0].split("?")[0]
    p = p.lstrip("/").removesuffix(".html").rstrip("/")
    first = p.split("/", 1)[0]
    if first in LANGS:
        p = p.split("/", 1)[1] if "/" in p else ""
    return p


def parse_sitemap():
    """Ritorna la lista dei <url>: dict(loc, lastmod, alts=[(hreflang, href)])."""
    ns = {"x": "http://www.sitemaps.org/schemas/sitemap/0.9",
          "xh": "http://www.w3.org/1999/xhtml"}
    tree = ET.parse(SITEMAP_PATH)
    out = []
    for u in tree.getroot().findall("x:url", ns):
        loc_el = u.find("x:loc", ns)
        lastmod_el = u.find("x:lastmod", ns)
        alts = []
        for link in u.findall("xh:link", ns):
            alts.append((link.get("hreflang", ""), link.get("href", "")))
        out.append({"loc": loc_el.text.strip(), "lastmod": lastmod_el.text if lastmod_el is not None else "",
                    "alts": alts})
    return out


def load_redirects() -> set:
    """Set dei path sorgente in _redirects (normalizzati senza .html)."""
    rules = set()
    if not REDIRECTS_PATH.exists():
        return rules
    for line in REDIRECTS_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        src = line.split()[0]
        rules.add(page_key(src))
    return rules


def make_check(cid, area, status, measured=None, threshold=None, detail=""):
    return {"id": cid, "area": area, "status": status,
            "measured": measured, "threshold": threshold, "detail": detail}


def make_finding(area, severity, title, evidence, fix, auto, files):
    # files ordinato: l'id non deve dipendere dall'ordine della lista
    files = sorted(files)
    return {"id": finding_id(area, title, files[0] if files else ""),
            "area": area, "severity": severity, "title": title,
            "evidence": evidence, "fix": fix, "auto": auto, "files": files}


def health_score(findings: list) -> int:
    """100 - 10/high - 3/medium - 1/low, minimo 0 (formula documentata)."""
    penalty = {"high": 10, "medium": 3, "low": 1}
    return max(0, 100 - sum(penalty.get(f["severity"], 0) for f in findings))


# ══════════════════════════ CRAWLABILITY ════════════════════════════════

def build_link_graph():
    """Set delle pagine logiche linkate da <a href> negli HTML + nav/footer JS."""
    linked = set()
    href_re = re.compile(r"""<a\s[^>]*href=["']([^"']+)["']""", re.I)
    js_helper_re = re.compile(r"""\b(?:enRoot|itRoot|lp)\(\s*['"]([^'"]+)['"]""")
    js_path_re = re.compile(r"""['"](/[a-z0-9][a-z0-9/_.-]*)['"]""")
    for f in html_files():
        for href in href_re.findall(strip_scripts(f.read_text(encoding="utf-8", errors="replace"))):
            if href.startswith("#") or ":" in href.split("/")[0]:
                if href.startswith(("mailto:", "tel:", "javascript:")):
                    continue
                if href.startswith(("http://", "https://")) and urlparse(href).netloc != SITE_HOST:
                    continue
            linked.add(page_key(href))
    for js in ("adoff-nav.js", "adoff-footer.js"):
        p = SITE / js
        if not p.exists():
            continue
        src = p.read_text(encoding="utf-8", errors="replace")
        for arg in js_helper_re.findall(src):
            linked.add(page_key(arg))
        for path in js_path_re.findall(src):
            if not path.endswith((".js", ".css", ".png", ".svg", ".json", ".zip")):
                linked.add(page_key(path))
    linked.discard("")
    return linked


def check_crawl_orphans(urls):
    """Pagine in sitemap senza nessun link interno entrante."""
    linked = build_link_graph()
    sitemap_pages = {page_key(u["loc"]) for u in urls}
    orphans = sorted(p for p in sitemap_pages - linked if p)
    check = make_check("crawl.orphans", "crawlability",
                       "pass" if not orphans else "warn",
                       measured=len(orphans), threshold=0,
                       detail=f"pagine in sitemap senza link entranti: {orphans[:20]}")
    findings = []
    if orphans:
        findings.append(make_finding(
            "crawlability", "medium", "Orphan pages in sitemap",
            f"{len(orphans)} pagine in sitemap senza nessun link interno: {', '.join(orphans[:10])}",
            "Aggiungere link interni verso queste pagine (da nav, footer o pagine correlate).",
            False, [f"site/{o}" for o in orphans[:10]]))
    return check, findings


def curl_status(url: str) -> tuple:
    """Ritorna (http_code, redirect_url) o ('ERR', motivo)."""
    try:
        out = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{redirect_url}",
             "-A", CURL_UA, "--max-time", str(CURL_TIMEOUT_S), url],
            capture_output=True, text=True, timeout=CURL_TIMEOUT_S + 5,
        ).stdout.strip()
        code, _, redir = out.partition(" ")
        return code, redir
    except (OSError, subprocess.SubprocessError) as exc:
        return "ERR", str(exc)[:80]


def check_crawl_sitemap_status(urls, offline):
    """Campiona URL della sitemap: devono essere 200 senza redirect."""
    if offline:
        return make_check("crawl.sitemap_status", "crawlability", "pass",
                          detail="skipped (--offline)"), []
    step = max(1, len(urls) // SITEMAP_SAMPLE_N)
    sample = [u["loc"] for u in urls[::step]][:SITEMAP_SAMPLE_N]
    bad_404, bad_redir, errors = [], [], []
    for url in sample:
        code, redir = curl_status(url)
        if code == "404":
            bad_404.append(url)
        elif code.startswith("3"):
            bad_redir.append(f"{url} -> {redir}")
        elif code == "ERR":
            errors.append(url)
    problems = bad_404 + bad_redir
    check = make_check("crawl.sitemap_status", "crawlability",
                       "pass" if not problems else "fail",
                       measured=len(problems), threshold=0,
                       detail=f"campione {len(sample)}: 404={bad_404} redirect={bad_redir} err={errors}")
    findings = []
    if bad_404:
        findings.append(make_finding(
            "crawlability", "high", "URL 404 in sitemap",
            f"404 su: {', '.join(bad_404)}",
            "Rimuovere dalla sitemap o ripristinare la pagina.", False,
            bad_404))
    if bad_redir:
        findings.append(make_finding(
            "crawlability", "medium", "Redirect in sitemap spreca crawl budget",
            f"redirect su: {'; '.join(bad_redir)}",
            "Far puntare la sitemap direttamente all'URL finale (200).", False,
            [r.split(" -> ")[0] for r in bad_redir]))
    return check, findings


def robots_bot_is_blocked(txt: str, bot: str) -> bool:
    """True se la sezione del bot contiene Disallow senza Allow che la copre.

    robots.txt di AdOff dichiara esplicitamente i bot AI con `Allow: /`
    (politica di apertura verso i motori AI): dichiarare un bot NON è
    bloccarlo — va letta la direttiva nella sua sezione.
    """
    section_re = re.compile(
        rf"(?is)user-agent:\s*{re.escape(bot)}\s*\n(.*?)(?=\n\s*(?:user-agent|sitemap|$))")
    m = section_re.search(txt)
    if not m:
        return False  # bot non menzionato: rientra in User-agent: * (che gestisce l'utente)
    rules = m.group(1)
    if re.search(r"(?im)^\s*allow:\s*/?\s*$", rules):
        return False
    return bool(re.search(r"(?im)^\s*disallow:", rules))


def check_crawl_robots():
    """robots.txt esiste, dichiara la Sitemap, non blocca i crawler AI."""
    findings = []
    problems = []
    if not ROBOTS_PATH.exists():
        problems.append("robots.txt mancante")
    else:
        txt = ROBOTS_PATH.read_text(encoding="utf-8", errors="replace")
        if "sitemap" not in txt.lower():
            problems.append("direttiva Sitemap assente")
        blocked = [bot for bot in AI_CRAWLERS if robots_bot_is_blocked(txt, bot)]
        if blocked:
            problems.append(f"crawler AI bloccati: {', '.join(blocked)}")
    check = make_check("crawl.robots", "crawlability",
                       "pass" if not problems else "fail",
                       measured=len(problems), threshold=0, detail="; ".join(problems))
    if problems:
        findings.append(make_finding(
            "crawlability", "high", "Problemi in robots.txt",
            "; ".join(problems),
            "Correggere robots.txt: dichiarare la Sitemap e non bloccare i crawler AI.",
            False, ["site/robots.txt"]))
    return check, findings


# ══════════════════════════ TECHNICAL ═══════════════════════════════════

def check_tech_hreflang_dupes(urls):
    """Cluster con lo stesso hreflang dichiarato due volte nella stessa <url>."""
    dupes = []
    for u in urls:
        seen, dups = set(), set()
        for lang, _ in u["alts"]:
            if lang in seen:
                dups.add(lang)
            seen.add(lang)
        if dups:
            dupes.append((u["loc"], sorted(dups)))
    check = make_check("tech.hreflang_dupes", "technical",
                       "pass" if not dupes else "fail",
                       measured=len(dupes), threshold=0,
                       detail=f"cluster con hreflang duplicato: {dupes[:10]}")
    findings = []
    if dupes:
        findings.append(make_finding(
            "technical", "high", "Hreflang duplicato nello stesso cluster",
            f"{len(dupes)} cluster affetti, es. {dupes[0][0]} dichiara {dupes[0][1]} due volte. "
            f"Google ignora l'intera annotazione.",
            "Rigenerare la sitemap senza hreflang duplicati (gen_sitemap.py).",
            True, [d[0] for d in dupes[:10]]))
    return check, findings


def check_tech_hreflang_reciprocity(urls):
    """Campiona cluster: se A dichiara B, B deve dichiarare A."""
    by_loc = {u["loc"].rstrip("/"): u for u in urls}
    step = max(1, len(urls) // RECIPROCITY_SAMPLE_N)
    sample = urls[::step][:RECIPROCITY_SAMPLE_N]
    violations = []
    for u in sample:
        for lang, href in u["alts"]:
            if lang == "x-default":
                continue
            back = by_loc.get(href.rstrip("/"))
            if back is None:
                violations.append(f"{u['loc']} dichiara {lang}={href} ma non è in sitemap")
            elif not any(h.rstrip("/") == u["loc"].rstrip("/") for _, h in back["alts"]):
                violations.append(f"{u['loc']} dichiara {href} ma {href} non dichiara {u['loc']}")
    check = make_check("tech.hreflang_reciprocity", "technical",
                       "pass" if not violations else "fail",
                       measured=len(violations), threshold=0,
                       detail=f"violazioni su campione {len(sample)}: {violations[:5]}")
    findings = []
    if violations:
        findings.append(make_finding(
            "technical", "medium", "Hreflang non reciproco",
            f"{len(violations)} violazioni: {violations[0]}",
            "Rigenerare le annotazioni hreflang in modo reciproco (gen_sitemap.py).",
            True, [v.split(" dichiara ")[0] for v in violations[:10]]))
    return check, findings


def check_tech_xdefault(urls):
    """Ogni cluster multilingua ha esattamente un x-default; cluster della
    stessa pagina logica devono puntare allo stesso x-default.

    Le URL con 0 annotazioni (pagine mono-lingua) non sono cluster: escluse.
    """
    problems = []
    xd_by_page = {}  # pagina logica -> set dei target x-default dei suoi cluster
    for u in urls:
        if not u["alts"]:
            continue  # pagina mono-lingua, non un cluster hreflang
        xds = [h for lang, h in u["alts"] if lang == "x-default"]
        if len(xds) != 1:
            problems.append(f"{u['loc']}: {len(xds)} x-default")
            continue
        target = page_key(xds[0])
        page = page_key(u["loc"])
        xd_by_page.setdefault(page, set()).add(target)
    # incoerenza = cluster della stessa pagina che puntano a x-default diversi
    inconsistent = {p: sorted(t) for p, t in xd_by_page.items() if len(t) > 1}
    n_issues = len(problems) + len(inconsistent)
    check = make_check("tech.xdefault", "technical",
                       "fail" if n_issues else "pass",
                       measured=n_issues, threshold=0,
                       detail=f"problemi={problems[:5]}; incoerenze={list(inconsistent.items())[:5]}")
    findings = []
    if problems:
        findings.append(make_finding(
            "technical", "medium", "x-default mancante o multiplo",
            f"{len(problems)} cluster: {problems[0]}",
            "Ogni cluster deve avere esattamente un x-default (gen_sitemap.py).",
            True, [p.split(":")[0] for p in problems[:10]]))
    if inconsistent:
        ex = list(inconsistent.items())[0]
        findings.append(make_finding(
            "technical", "medium", "x-default incoerente tra cluster della stessa pagina",
            f"{len(inconsistent)} pagine con cluster che puntano a x-default diversi, "
            f"es. {ex[0]}: {ex[1][:3]}",
            "Allineare l'x-default alla stessa pagina logica in tutti i cluster.",
            True, []))
    return check, findings


def check_tech_canonical_self(urls):
    """Pagine in sitemap con canonical che punta a un'altra URL."""
    conflicts = []
    for u in urls:
        f = url_to_relpath(u["loc"])
        if f is None:
            continue
        m = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"',
                      f.read_text(encoding="utf-8", errors="replace"))
        if not m:
            continue
        can = m.group(1).split("?")[0].rstrip("/")
        if can != u["loc"].split("?")[0].rstrip("/"):
            conflicts.append(f"{u['loc']} -> canonical {can}")
    check = make_check("tech.canonical_self", "technical",
                       "pass" if not conflicts else "warn",
                       measured=len(conflicts), threshold=0,
                       detail=f"canonical non self-referencing: {conflicts[:10]}")
    findings = []
    if conflicts:
        findings.append(make_finding(
            "technical", "medium", "Canonical non self-referencing in sitemap",
            f"{len(conflicts)} pagine, es. {conflicts[0]}",
            "Se la pagina è canonica di se stessa, puntare il canonical all'URL itself.",
            True, [c.split(" -> ")[0] for c in conflicts[:10]]))
    return check, findings


def check_tech_lastmod_uniform(urls):
    """Se >80% delle URL condivide lo stesso lastmod, freschezza non credibile."""
    with_lm = [u["lastmod"] for u in urls if u["lastmod"]]
    if not with_lm:
        return make_check("tech.lastmod_uniform", "technical", "pass",
                          detail="nessun lastmod in sitemap"), []
    top, count = max(((v, with_lm.count(v)) for v in set(with_lm)), key=lambda t: t[1])
    ratio = count / len(with_lm)
    check = make_check("tech.lastmod_uniform", "technical",
                       "warn" if ratio > LASTMOD_UNIFORM_RATIO else "pass",
                       measured=round(ratio, 3), threshold=LASTMOD_UNIFORM_RATIO,
                       detail=f"{count}/{len(with_lm)} URL con lastmod {top}")
    findings = []
    if ratio > LASTMOD_UNIFORM_RATIO:
        findings.append(make_finding(
            "technical", "low", "lastmod uniforme su quasi tutta la sitemap",
            f"{count}/{len(with_lm)} URL ({ratio:.0%}) hanno lastmod {top}",
            "Scrivere lastmod reali per pagina (data dell'ultima modifica effettiva).",
            True, ["site/sitemap.xml"]))
    return check, findings


def check_tech_jsonld_valid():
    """Ogni blocco application/ld+json deve essere JSON parsabile (file+riga)."""
    broken = []
    scanned = 0
    for f in html_files():
        html = f.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r"(?is)<script[^>]*application/ld\+json[^>]*>(.*?)</script>", html):
            scanned += 1
            line = html[:m.start()].count("\n") + 1
            try:
                json.loads(m.group(1))
            except json.JSONDecodeError as exc:
                rel = str(f.relative_to(ROOT))
                broken.append(f"{rel}:{line} ({exc.msg})")
    check = make_check("tech.jsonld_valid", "technical",
                       "pass" if not broken else "fail",
                       measured=len(broken), threshold=0,
                       detail=f"{scanned} blocchi scansionati, rotti: {broken[:5]}")
    findings = []
    if broken:
        findings.append(make_finding(
            "technical", "medium", "JSON-LD malformato",
            f"{len(broken)} blocchi non parsabili: {broken[0]}",
            "Correggere la sintassi JSON del blocco ld+json indicato.",
            True, [b.rsplit(":", 1)[0] for b in broken[:10]]))
    return check, findings


# ══════════════════════════ ONPAGE ══════════════════════════════════════

def page_head(html: str) -> dict:
    """Estrae title, meta description e conteggio h1 da un HTML."""
    title_m = re.search(r"(?is)<title[^>]*>(.*?)</title>", html)
    # order-agnostic: nel sito esistono sia name->content sia content->name
    meta_tag = re.search(
        r'(?is)<meta\s[^>]*\bname=["\']description["\'][^>]*>', html)
    if not meta_tag or 'content=' not in meta_tag.group(0):
        meta_tag = re.search(
            r'(?is)<meta\s[^>]*\bcontent=["\'][^"\']*["\'][^>]*\bname=["\']description["\']', html)
    desc = ""
    if meta_tag:
        # backreference (["\']).*\1: il valore puo' contenere apostrofi
        # (es. coreano '광고') quando il tag e' delimitato da doppi
        cm = re.search(r'(?i)\bcontent=(["\'])(.*?)\1', meta_tag.group(0))
        if cm:
            desc = cm.group(2).strip()
    return {
        "title": title_m.group(1).strip() if title_m else "",
        "desc": desc,
        "h1_count": len(re.findall(r"(?i)<h1[\s>]", html)),
    }


def check_onpage_title_length():
    """Title >60 char (troncato in SERP) o <30. Elenca i peggiori 10."""
    too_long, too_short = [], []
    for f in html_files():
        t = page_head(f.read_text(encoding="utf-8", errors="replace"))["title"]
        if not t:
            continue
        rel = str(f.relative_to(ROOT))
        if len(t) > TITLE_MAX:
            too_long.append((len(t), rel, t))
        elif len(t) < TITLE_MIN:
            too_short.append((len(t), rel, t))
    too_long.sort(reverse=True)
    worst = too_long[:10]
    n = len(too_long) + len(too_short)
    check = make_check("onpage.title_length", "onpage",
                       "pass" if n == 0 else "warn",
                       measured=n, threshold=0,
                       detail=f"lunghi={[(l, p) for l, p, _ in worst]}; corti={too_short[:5]}")
    findings = []
    if n:
        ev = "; ".join(f"{p} ({l} char)" for l, p, _ in worst[:3])
        findings.append(make_finding(
            "onpage", "low", "Title fuori range 30-60 char",
            f"{len(too_long)} troppo lunghi, {len(too_short)} troppo corti. Peggiori: {ev}",
            f"Riscrivere i title entro {TITLE_MIN}-{TITLE_MAX} char mantenendo la keyword.",
            False, [p for _, p, _ in worst]))
    return check, findings


def check_onpage_meta_desc():
    """Meta description mancante, fuori range 70-160 o duplicata."""
    missing, wrong_len, dupes = [], [], {}
    for f in html_files():
        d = page_head(f.read_text(encoding="utf-8", errors="replace"))["desc"]
        rel = str(f.relative_to(ROOT))
        if not d:
            missing.append(rel)
        elif len(d) > META_MAX or len(d) < META_MIN:
            wrong_len.append((len(d), rel))
        dupes.setdefault(d, []).append(rel) if d else None
    duplicated = {d: fs for d, fs in dupes.items() if len(fs) > 1}
    n = len(missing) + len(wrong_len) + sum(len(v) for v in duplicated.values())
    check = make_check("onpage.meta_desc", "onpage",
                       "pass" if n == 0 else "warn", measured=n, threshold=0,
                       detail=f"mancanti={missing[:5]}; fuori range={wrong_len[:5]}; "
                              f"duplicati={list(duplicated)[:3]}")
    findings = []
    if missing:
        findings.append(make_finding(
            "onpage", "medium", "Meta description mancante",
            f"{len(missing)} pagine senza meta description: {missing[:5]}",
            "Scrivere una meta description 70-160 char per ogni pagina.", False,
            missing[:10]))
    if duplicated:
        ex = list(duplicated.items())[0]
        findings.append(make_finding(
            "onpage", "medium", "Meta description duplicata",
            f"Stessa description su {len(ex[1])} pagine, es. {ex[1][:3]}",
            "Differenziare la description per ogni pagina.", False,
            ex[1][:10]))
    if wrong_len:
        findings.append(make_finding(
            "onpage", "low", "Meta description fuori range 70-160 char",
            f"{len(wrong_len)} pagine, es. {wrong_len[:3]}",
            f"Portare le description a {META_MIN}-{META_MAX} char.", False,
            [p for _, p in wrong_len[:10]]))
    return check, findings


def check_onpage_h1():
    """Pagine con 0 o più di 1 <h1>."""
    bad = []
    for f in html_files():
        n = page_head(f.read_text(encoding="utf-8", errors="replace"))["h1_count"]
        if n != 1:
            bad.append(f"{f.relative_to(ROOT)} ({n} h1)")
    check = make_check("onpage.h1", "onpage",
                       "pass" if not bad else "warn", measured=len(bad), threshold=0,
                       detail=f"pagine con h1 != 1: {bad[:10]}")
    findings = []
    if bad:
        findings.append(make_finding(
            "onpage", "medium", "Pagine con zero o multipli h1",
            f"{len(bad)} pagine, es. {bad[0]}",
            "Esattamente un <h1> per pagina, con la keyword principale.", False,
            [b.split(" (")[0] for b in bad[:10]]))
    return check, findings


def check_onpage_img_alt():
    """<img> senza attributo alt (decorativi inclusi: alt='' basta)."""
    bad = []
    total = 0
    img_re = re.compile(r"<img\b[^>]*>", re.I)
    for f in html_files():
        for m in img_re.finditer(strip_scripts(f.read_text(encoding="utf-8", errors="replace"))):
            total += 1
            if not re.search(r'(?i)\balt=', m.group(0)):
                bad.append(f"{f.relative_to(ROOT)}: {m.group(0)[:60]}")
    check = make_check("onpage.img_alt", "onpage",
                       "pass" if not bad else "warn", measured=len(bad), threshold=0,
                       detail=f"{total} img totali, senza alt: {bad[:5]}")
    findings = []
    if bad:
        findings.append(make_finding(
            "onpage", "low", "Immagini senza attributo alt",
            f"{len(bad)}/{total} img senza alt, es. {bad[0]}",
            "Aggiungere alt descrittivo (alt=\"\" per immagini decorative).", False,
            sorted({b.split(":")[0] for b in bad})[:10]))
    return check, findings


def check_onpage_broken_internal_links():
    """<a href="/..."> verso path inesistenti in site/ e non coperti da _redirects."""
    redirects = load_redirects()
    broken = []
    href_re = re.compile(r"""<a\s[^>]*href=["'](/[^"']*)["']""", re.I)
    for f in html_files():
        for href in href_re.findall(strip_scripts(f.read_text(encoding="utf-8", errors="replace"))):
            key = page_key(href)
            if not key or key in redirects:
                continue
            clean = href.split("#")[0].split("?")[0]
            if url_to_relpath("https://" + SITE_HOST + clean) is None:
                broken.append(f"{f.relative_to(ROOT)} -> {clean}")
    check = make_check("onpage.broken_internal_links", "onpage",
                       "pass" if not broken else "fail", measured=len(broken), threshold=0,
                       detail=f"link interni rotti: {broken[:10]}")
    findings = []
    if broken:
        findings.append(make_finding(
            "onpage", "high", "Link interni rotti",
            f"{len(broken)} link verso path inesistenti, es. {broken[0]}",
            "Correggere il path, creare la pagina, o aggiungere una regola in _redirects.",
            True, sorted({b.split(" -> ")[0] for b in broken})[:10]))
    return check, findings


# ══════════════════════════ CONTENT ═════════════════════════════════════

def iter_content_texts(strip_svg=False):
    """Yield (file_rel, testo) per HTML (senza script) e dizionari i18n.

    strip_svg=True rimuove anche <svg>/<style>: i path SVG contengono
    sequenze numeriche che sembrano versioni (falso positivo stale_numbers).
    """
    for f in html_files():
        text = strip_scripts(f.read_text(encoding="utf-8", errors="replace"))
        if strip_svg:
            text = SVG_NOISE_RE.sub(" ", text)
            text = STYLE_NOISE_RE.sub(" ", text)
        yield str(f.relative_to(ROOT)), text
    # derivo da SITE a runtime: così i test possono reindirizzare SITE
    i18n_dir = SITE / "i18n"
    if i18n_dir.exists():
        for f in sorted(i18n_dir.glob("*.json")):
            if f.stem in LANGS:
                yield str(f.relative_to(ROOT)), f.read_text(encoding="utf-8", errors="replace")


def check_content_stale_numbers():
    """Conteggio regole e versione dichiarati != valori reali di app/."""
    real_rules = len(json.loads(RULES_PATH.read_text(encoding="utf-8")))
    real_version = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))["version"]
    hits = []
    for rel, text in iter_content_texts(strip_svg=True):
        for m in RULES_NUM_RE.finditer(text):
            num = m.group(1)
            # "30.000 regole" (limite Chrome, citato nelle /vs/): il separatore
            # di migliaia spezza il numero -> escludo i gruppi di 3 cifre finali
            tail = text[m.end(1):m.end(1) + 4]
            if re.match(r"\.000\b|,000\b| 000\b", tail):
                continue
            if int(num) != real_rules:
                hits.append(f"{rel}: '{m.group(0)[:40]}' (reale: {real_rules})")
        for m in VERSION_RE.finditer(text):
            # "3.3.1+" = versione MINIMA richiesta, non un claim di versione corrente
            if text[m.end():m.end() + 1] == "+":
                continue
            if m.group(0) != real_version:
                hits.append(f"{rel}: versione {m.group(0)} (reale: {real_version})")
    check = make_check("content.stale_numbers", "content",
                       "pass" if not hits else "fail", measured=len(hits), threshold=0,
                       detail=f"reale: {real_rules} regole, v{real_version}; stantii: {hits[:10]}")
    findings = []
    if hits:
        findings.append(make_finding(
            "content", "high", "Numeri stantii (conteggio regole / versione)",
            f"{len(hits)} occorrenze, es. {hits[0]}",
            f"Allineare ai valori reali: {real_rules} regole, versione {real_version}.",
            True, sorted({h.split(":")[0] for h in hits})[:10]))
    return check, findings


def check_content_model_claims():
    """Claim che contraddicono 'gratis al 100%, nessun piano, nessun trial'."""
    hits = []
    for rel, text in iter_content_texts():
        # i prezzi/piani dei COMPETITOR nelle /vs/* sono legittimi: salto lì i pattern generici
        in_vs = "vs" in Path(rel).parts
        for m in ADOFF_PRO_RE.finditer(text):
            hits.append(f"{rel}: '{m.group(0)}'")
        if in_vs:
            continue
        for m in GENERIC_PRO_RE.finditer(text):
            hits.append(f"{rel}: '{m.group(0)}'")
        for m in TRIAL_RE.finditer(text):
            ctx = text[max(0, m.start() - 80):m.end() + 80]
            if TRIAL_CTX_RE.search(ctx):
                hits.append(f"{rel}: '{m.group(0)}' (contesto trial)")
    check = make_check("content.model_claims", "content",
                       "pass" if not hits else "fail", measured=len(hits), threshold=0,
                       detail=f"claim contraddittori: {hits[:10]}")
    findings = []
    if hits:
        findings.append(make_finding(
            "content", "high", "Claim di piani/trial contraddittori",
            f"{len(hits)} occorrenze, es. {'; '.join(hits[:3])}",
            "Riscrivere nella lingua giusta: AdOff è gratis al 100%, nessun piano a pagamento, "
            "nessun trial a tempo.", False,
            sorted({h.split(":")[0] for h in hits})[:10]))
    return check, findings


def check_content_broken_phrases():
    """Frasi rotte da find&replace (lowercase match su testo e JSON)."""
    hits = []
    for rel, text in iter_content_texts():
        low = text.lower()
        for phrase in BROKEN_PHRASES:
            idx = low.find(phrase)
            if idx != -1:
                ctx = re.sub(r"\s+", " ", text[max(0, idx - 40):idx + 60])
                hits.append(f"{rel}: ...{ctx}...")
    check = make_check("content.broken_phrases", "content",
                       "pass" if not hits else "fail", measured=len(hits), threshold=0,
                       detail=f"frasi rotte: {hits[:10]}")
    findings = []
    if hits:
        findings.append(make_finding(
            "content", "medium", "Frasi rotte da find&replace",
            f"{len(hits)} occorrenze, es. {hits[0]}",
            "Correggere la frase in prosa corretta nella lingua della pagina.", False,
            sorted({h.split(":")[0] for h in hits})[:10]))
    return check, findings


def collect_i18n_keys():
    """Chiavi i18n richieste: data-i18n* negli HTML e negli HTML-string dei JS del sito."""
    keys = set()
    attr_re = re.compile(r'data-i18n(?:-html|-placeholder)?=["\']([a-z0-9_.]+)["\']')
    files = [f for f in html_files()]
    files += [SITE / n for n in ("adoff-nav.js", "adoff-footer.js", "adoff-i18n.js")
              if (SITE / n).exists()]
    for f in files:
        keys.update(attr_re.findall(f.read_text(encoding="utf-8", errors="replace")))
    return keys


def check_content_i18n_integrity():
    """Ogni chiave usata deve esistere in TUTTI e 15 i dizionari lingua."""
    dicts = {}
    for lang in LANGS:
        p = I18N_DIR / f"{lang}.json"
        if p.exists():
            dicts[lang] = json.loads(p.read_text(encoding="utf-8"))
    keys = collect_i18n_keys()
    missing = {}  # lang -> [chiavi]
    for lang, d in dicts.items():
        miss = sorted(k for k in keys if k not in d)
        if miss:
            missing[lang] = miss
    total_missing = sum(len(v) for v in missing.values())
    check = make_check("content.i18n_integrity", "content",
                       "pass" if not missing else "fail",
                       measured=total_missing, threshold=0,
                       detail=f"{len(keys)} chiavi richieste; mancanti: "
                              f"{ {l: v[:5] for l, v in list(missing.items())[:3]} }")
    findings = []
    if missing:
        worst = max(missing, key=lambda l: len(missing[l]))
        findings.append(make_finding(
            "content", "high", "Chiavi i18n mancanti in alcune lingue",
            f"{total_missing} coppie lingua/chiave mancanti su {len(keys)} chiavi; "
            f"peggio {worst} ({len(missing[worst])}), es. {missing[worst][:5]}",
            "Aggiungere le chiavi mancanti nei dizionari indicati (il sito serve ?lang=xx su ogni pagina).",
            True, [f"site/i18n/{l}.json" for l in missing]))
    return check, findings


# ══════════════════════════ AUTHORITY (AEO) ═════════════════════════════

def check_aeo_llms_txt():
    """llms.txt esiste, senza numeri stantii, con sezione Q&A."""
    problems, stale = [], []
    if not LLMS_PATH.exists():
        problems.append("site/llms.txt mancante")
    else:
        txt = LLMS_PATH.read_text(encoding="utf-8", errors="replace")
        real_rules = len(json.loads(RULES_PATH.read_text(encoding="utf-8")))
        real_version = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))["version"]
        for m in RULES_NUM_RE.finditer(txt):
            if int(m.group(1)) != real_rules:
                stale.append(f"'{m.group(0)[:40]}' (reale: {real_rules})")
        for m in VERSION_RE.finditer(txt):
            if m.group(0) != real_version:
                stale.append(f"versione {m.group(0)} (reale: {real_version})")
        if not re.search(r"(?im)^#{1,3}.*(q&a|faq|questions)", txt):
            problems.append("sezione Q&A assente")
    check = make_check("aeo.llms_txt", "authority",
                       "pass" if not (problems or stale) else "fail",
                       measured=len(problems) + len(stale), threshold=0,
                       detail=f"problemi={problems}; numeri stantii={stale}")
    findings = []
    if stale:
        findings.append(make_finding(
            "authority", "medium", "Numeri stantii in llms.txt",
            f"es. {stale[0]}",
            f"Allineare llms.txt ai valori reali (regole e versione).", True,
            ["site/llms.txt"]))
    if problems:
        findings.append(make_finding(
            "authority", "medium", "llms.txt incompleto",
            "; ".join(problems),
            "Creare/completare site/llms.txt con panoramica prodotto e sezione Q&A.", False,
            ["site/llms.txt"]))
    return check, findings


def key_page_files():
    """File locali delle pagine chiave AEO (tutte le lingue)."""
    out = []
    for page in KEY_PAGES:
        for f in sorted(SITE.glob(page + "*.html")) + sorted(
                SITE.glob("*/" + page + ".html")):
            if f.is_file() and f.name.startswith(page.split("/")[-1][:4]):
                out.append(f)
    return sorted(set(out))


def check_aeo_external_citations(offline):
    """Pagine chiave senza link esterni (non adoff.app) = perdita di autorevolezza AI."""
    link_re = re.compile(r"""<a\s[^>]*href=["'](https?://[^"']+)["']""", re.I)
    zero = []
    total_cites = 0
    for f in key_page_files():
        if offline and not f.exists():
            continue
        cites = [h for h in link_re.findall(
            strip_scripts(f.read_text(encoding="utf-8", errors="replace")))
            if urlparse(h).netloc not in (SITE_HOST, "www." + SITE_HOST,
                                          "www.googletagmanager.com", "github.com")]
        total_cites += len(cites)
        if not cites:
            zero.append(str(f.relative_to(ROOT)))
    check = make_check("aeo.external_citations", "authority",
                       "pass" if not zero else "warn", measured=len(zero), threshold=0,
                       detail=f"{total_cites} citazioni esterne totali; pagine senza: {zero[:10]}")
    findings = []
    if zero:
        findings.append(make_finding(
            "authority", "low", "Pagine chiave senza citazioni esterne",
            f"{len(zero)} pagine chiave con 0 link esterni: {zero[:5]}",
            "Aggiungere citazioni a fonti autorevoli (docs ufficiali, studi) nelle pagine chiave.",
            False, zero[:10]))
    return check, findings


def check_aeo_freshness():
    """Pagine chiave senza una data 'last updated' visibile."""
    missing = []
    for f in key_page_files():
        if not FRESHNESS_RE.search(f.read_text(encoding="utf-8", errors="replace")):
            missing.append(str(f.relative_to(ROOT)))
    check = make_check("aeo.freshness", "authority",
                       "pass" if not missing else "warn", measured=len(missing), threshold=0,
                       detail=f"pagine chiave senza data visibile: {missing[:10]}")
    findings = []
    if missing:
        findings.append(make_finding(
            "authority", "low", "Pagine chiave senza data 'last updated'",
            f"{len(missing)} pagine: {missing[:5]}",
            "Mostrare una data di aggiornamento visibile sulle pagine chiave.", False,
            missing[:10]))
    return check, findings


# ══════════════════════════ RUNNER ══════════════════════════════════════

def run_checks(offline: bool) -> dict:
    """Esegue tutti i check: uno che esplode non ferma la suite."""
    urls = parse_sitemap() if SITEMAP_PATH.exists() else []
    # (check_id, funzione zero-arg): l'ordine è quello del report
    registry = [
        ("crawl.orphans", lambda: check_crawl_orphans(urls)),
        ("crawl.sitemap_status", lambda: check_crawl_sitemap_status(urls, offline)),
        ("crawl.robots", lambda: check_crawl_robots()),
        ("tech.hreflang_dupes", lambda: check_tech_hreflang_dupes(urls)),
        ("tech.hreflang_reciprocity", lambda: check_tech_hreflang_reciprocity(urls)),
        ("tech.xdefault", lambda: check_tech_xdefault(urls)),
        ("tech.canonical_self", lambda: check_tech_canonical_self(urls)),
        ("tech.lastmod_uniform", lambda: check_tech_lastmod_uniform(urls)),
        ("tech.jsonld_valid", lambda: check_tech_jsonld_valid()),
        ("onpage.title_length", lambda: check_onpage_title_length()),
        ("onpage.meta_desc", lambda: check_onpage_meta_desc()),
        ("onpage.h1", lambda: check_onpage_h1()),
        ("onpage.img_alt", lambda: check_onpage_img_alt()),
        ("onpage.broken_internal_links", lambda: check_onpage_broken_internal_links()),
        ("content.stale_numbers", lambda: check_content_stale_numbers()),
        ("content.model_claims", lambda: check_content_model_claims()),
        ("content.broken_phrases", lambda: check_content_broken_phrases()),
        ("content.i18n_integrity", lambda: check_content_i18n_integrity()),
        ("aeo.llms_txt", lambda: check_aeo_llms_txt()),
        ("aeo.external_citations", lambda: check_aeo_external_citations(offline)),
        ("aeo.freshness", lambda: check_aeo_freshness()),
    ]
    checks, findings = [], []
    for cid, fn in registry:
        try:
            check, found = fn()
        except Exception as exc:  # noqa: BLE001 — un check rotto non ferma la suite
            check = make_check(cid, cid.split(".")[0], "error", detail=f"{type(exc).__name__}: {exc}")
            found = []
        checks.append(check)
        findings.extend(found)
    sev_rank = {"high": 0, "medium": 1, "low": 2}
    findings.sort(key=lambda f: (sev_rank[f["severity"]], f["area"]))
    return {
        "run_id": datetime.now().strftime("%Y%m%d_%H%M"),
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "checks": checks,
        "findings": findings,
        "metrics": {
            "health_score": health_score(findings),
            "orphan_pages": next((c["measured"] for c in checks if c["id"] == "crawl.orphans"), 0),
            "hreflang_dupes": next((c["measured"] for c in checks if c["id"] == "tech.hreflang_dupes"), 0),
            "broken_jsonld": next((c["measured"] for c in checks if c["id"] == "tech.jsonld_valid"), 0),
            "stale_numbers": next((c["measured"] for c in checks if c["id"] == "content.stale_numbers"), 0),
            "titles_too_long": next((c["measured"] for c in checks if c["id"] == "onpage.title_length"), 0),
            "pages_total": len(urls),
        },
    }


def main() -> int:
    offline = "--offline" in sys.argv
    result = run_checks(offline)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    out = STATE_DIR / "audit_findings.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if "--json" in sys.argv:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    errs = [c for c in result["checks"] if c["status"] == "error"]
    # su stderr: con --json stdout deve restare JSON puro per il consumo a valle
    print(f"audit: {len(result['checks'])} check, {len(result['findings'])} finding, "
          f"health={result['metrics']['health_score']} -> {out}"
          + (f" ({len(errs)} check in errore!)" if errs else ""), file=sys.stderr)
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
