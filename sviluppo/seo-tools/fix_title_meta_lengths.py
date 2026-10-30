#!/usr/bin/env python3
"""Fix title (30-60) e meta description (70-160) fuori range, stessa logica di seo_audit.py.
Modalita': scan (default, solo report) / fix. CJK-aware (tronca a char, non a parola)."""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
TITLE_MIN, TITLE_MAX = 30, 60
META_MIN, META_MAX = 70, 160
TGT_T = (45, 60)   # target title
TGT_D = (120, 155) # target description

LANG = {"ar":"ar","de":"de","en":"en","es":"es","fr":"fr","hi":"hi","id":"id",
        "it":"it","ja":"ja","ko":"ko","pl":"pl","pt":"pt","ru":"ru","tr":"tr","zh":"zh"}
def lang_of(rel): return LANG.get(rel.split("/")[0] if "/" in rel else "en", "en")

# suffisso per title troppo corti (keyword generica gia' vera nella pagina) + coda AdOff
T_SUF = {
 "en": "Free Ad Blocker", "it": "Blocco Pubblicita Gratis", "de": "Kostenloser Adblocker",
 "fr": "Bloqueur de Publicites Gratuit", "es": "Bloqueador de Anuncios Gratis",
 "pt": "Bloqueador de Anuncios Gratis", "ru": "Бесплатный Блокировщик Рекламы",
 "ar": "مانع إعلانات مجاني", "zh": "免费广告拦截", "tr": "Ücretsiz Reklam Engelleyici",
 "pl": "Darmowy Bloker Reklam", "hi": "मुफ्त विज्ञापन ब्लॉकर", "ja": "無料広告ブロッカー",
 "ko": "무료 광고 차단기", "id": "Pemblokir Iklan Gratis"}
# frase aggiuntiva per description troppo corte (fatti gia' nella pagina: gratis, no account)
D_FILL = {
 "en": "AdOff is 100% free and needs no account — install and browse ad-free.",
 "it": "AdOff e gratuito al 100% e non richiede alcun account: installa e naviga senza pubblicita.",
 "de": "AdOff ist zu 100% kostenlos und ohne Konto: installieren und werbefrei surfen.",
 "fr": "AdOff est 100% gratuit et sans compte : installez et naviguez sans publicite.",
 "es": "AdOff es 100% gratis y sin cuenta: instala y navega sin anuncios.",
 "pt": "AdOff e 100% gratis e sem conta: instale e navegue sem anuncios.",
 "ru": "AdOff на 100% бесплатен и без аккаунта: установите и сёрфите без рекламы.",
 "ar": "AdOff مجاني 100% وبلا حساب: ثبّته وتصفح دون إعلانات.",
 "zh": "AdOff 100% 免费且无需账户：安装后即可无广告浏览。",
 "tr": "AdOff %100 ücretsiz ve hesapsız: kurun, reklamsız gezinin.",
 "pl": "AdOff jest w 100% darmowy i bez konta: zainstaluj i przegladaj bez reklam.",
 "hi": "AdOff 100% मुफ्त है, खाता ज़रूरी नहीं: इंस्टॉल करें, बिना विज्ञापन ब्राउज़ करें।",
 "ja": "AdOffは100%無料・アカウント不要。インストールして広告なしで閲覧できます。",
 "ko": "AdOff는 100% 무료이며 계정이 필요 없습니다. 설치하고 광고 없이 탐색하세요.",
 "id": "AdOff 100% gratis dan tanpa akun: pasang dan jelajah tanpa iklan."}
CJK = {"ja","ko","zh"}

def head(html):
    tm = re.search(r"(?is)<title[^>]*>(.*?)</title>", html)
    m = re.search(r'(?is)<meta\s[^>]*\bname=["\']description["\'][^>]*>', html)
    if not m or 'content=' not in m.group(0):
        m = re.search(r'(?is)<meta\s[^>]*\bcontent=["\'][^"\']*["\'][^>]*\bname=["\']description["\']', html)
    d = ""
    if m:
        cm = re.search(r'(?i)\bcontent=(["\'])(.*?)\1', m.group(0))
        if cm: d = cm.group(2).strip()
    return (tm.group(1).strip() if tm else ""), d

def cut(txt, mx, lang):
    """Tronca a <=mx senza spezzare parole (CJK: a carattere)."""
    if len(txt) <= mx: return txt
    if lang in CJK: return txt[:mx].rstrip()
    cutd = txt[:mx]
    if " " in cutd: cutd = cutd.rsplit(" ", 1)[0]
    return cutd.rstrip(" ,;:·-–—")

def fix_title(t, lang):
    if TGT_T[0] <= len(t) <= TGT_T[1]: return t
    # troppo lungo: togli coda "| AdOff" se serve
    core = re.sub(r"\s*[\|｜]\s*AdOff\s*$", "", t)
    if len(core) > TGT_T[1]:
        core = cut(core, TGT_T[1], lang)
    else:
        t2 = core + " | AdOff"
        if len(t2) <= TGT_T[1]: core = t2
    if len(core) < TITLE_MIN:
        suf = " " + T_SUF.get(lang, T_SUF["en"])
        base = core if len(core + suf + " | AdOff") <= TITLE_MAX else cut(core + suf, TITLE_MAX - 8, lang)
        cand = base + suf + " | AdOff"
        core = cand if len(cand) <= TITLE_MAX else cut(cand, TITLE_MAX, lang)
    return core

def fix_desc(d, lang):
    if TGT_D[0] <= len(d) <= TGT_D[1]: return d
    if len(d) > META_MAX:
        out = cut(d, TGT_D[1], lang)
        # preferisci taglio a fine frase
        for p in ("。", "!", "?", ".", "…"):
            idx = out.rfind(p)
            if idx != -1 and idx + 1 >= TGT_D[0]:
                return out[:idx + 1]
        return out
    # troppo corta: appendi filler nei limiti
    for fill in (D_FILL[lang],):
        cand = d.rstrip(".!?。 ") + ("" if d.rstrip().endswith((".","!","?","。")) else ". ") + fill if not d.rstrip().endswith((".","!","?","。")) else d.rstrip() + " " + fill
        if len(cand) <= TGT_D[1]: return cand
        return cut(cand, TGT_D[1], lang)
    return d

def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

def set_meta(html, new_t, new_d, old_t, old_d):
    html = re.sub(r"(?is)(<title[^>]*>).*?(</title>)", lambda m: m.group(1) + esc(new_t) + m.group(2), html, count=1)
    def repl_desc(m):
        tag = m.group(0)
        return re.sub(r'(?i)(\bcontent=(["\']))(.*?)(\2)', lambda c: c.group(1) + esc(new_d) + c.group(4), tag, count=1)
    html = re.sub(r'(?is)<meta\s[^>]*\bname=["\']description["\'][^>]*>', repl_desc, html, count=1)
    # og/twitter: allinea solo se erano uguali al vecchio valore
    for prop, newv, oldv in (("og:title", new_t, old_t), ("og:description", new_d, old_d),
                             ("twitter:title", new_t, old_t), ("twitter:description", new_d, old_d)):
        pat = re.compile(r'(?is)<meta\s[^>]*\b(?:property|name)=["\']' + prop + r'["\'][^>]*>')
        m = pat.search(html)
        if not m: continue
        tag = m.group(0)
        cm = re.search(r'(?i)\bcontent=(["\'])(.*?)\1', tag)
        if cm and cm.group(2) == oldv:
            ntag = re.sub(r'(?i)(\bcontent=(["\']))(.*?)(\2)', lambda c: c.group(1) + esc(newv) + c.group(4), tag, count=1)
            html = html[:m.start()] + ntag + html[m.end():]
    return html

def main():
    do_fix = "fix" in sys.argv
    bad_t = bad_d = 0
    changed = []
    for f in sorted(SITE.rglob("*.html")):
        rel = str(f.relative_to(SITE))
        html = f.read_text(encoding="utf-8", errors="replace")
        old_t, old_d = head(html)
        lang = lang_of(rel)
        nt, nd = old_t, old_d
        if old_t and (len(old_t) > TITLE_MAX or len(old_t) < TITLE_MIN):
            bad_t += 1; nt = fix_title(old_t, lang)
        if not old_d or len(old_d) > META_MAX or len(old_d) < META_MIN:
            bad_d += 1; nd = fix_desc(old_d, lang) if old_d else old_d
        if do_fix and (nt != old_t or nd != old_d):
            html2 = set_meta(html, nt, nd, old_t, old_d)
            f.write_text(html2, encoding="utf-8")
            changed.append(rel)
    mode = "FIXED" if do_fix else "SCAN"
    print(f"{mode}: title out-of-range={bad_t} desc out-of-range={bad_d} files_changed={len(changed)}")
    if do_fix and changed:
        Path("/tmp/seo_fix_changed.txt").write_text("\n".join(changed))

if __name__ == "__main__":
    main()
