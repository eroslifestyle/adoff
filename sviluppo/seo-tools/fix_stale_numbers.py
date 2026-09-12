#!/usr/bin/env python3
"""
AdOff — Fix una-tantum dei numeri STANTII live in site/ (prezzi/trial/regole/lingue)
+ fix JSON-LD invalido cinese. Context-aware e SICURO:
  - i prezzi si sostituiscono SOLO se vicino c'è un indicatore di valuta/prezzo
    (evita i falsi positivi nei path SVG, dove "2.69" è una coordinata);
  - separatore decimale preservato (2,69→2,99 ; 2.69→2.99);
  - trial/regole/lingue: ancorati alla parola (giorni/rules/lingue…).
Mappa valori (da site/data/constants.json):
  2,69→2,99 (mensile) · 67,90→99 (lifetime) · 29,59→19,99 (annuale founder)
  range 29,59–59,99→19,99–24,99 · 15gg→30gg · 107 regole→138 · 6 lingue→15
Uso: python3 fix_stale_numbers.py [--dry-run]
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = os.path.join(ROOT, "site")
DRY = "--dry-run" in sys.argv

# Indicatori di valuta/prezzo nelle 15 lingue (basta uno nella finestra ±18 char).
CURRENCY = re.compile(
    r"EUR|€|&#8364;|\$|£|¥|₹|zł|₺|руб|грн|يورو|円|원|欧元|元|유로|"
    r"/\s*(?:month|year|mo|yr)|per\s+(?:month|year)|"
    r"mese|anno|mes|año|ano|mois|Monat|Jahr|miesi|rok|/?\s*ay\b|yıl|bulan|tahun|月|월|년|年|माह|वर्ष|शहर|mensil|annual|lifetime|vita|Hidup|Vida|Vie|Leben|Życie|Ömür|永久|평생|मदى|sekali|终身|年度|月度",
    re.I,
)

DAY_WORDS = r"(giorni|days|jours|tage|días|dias|gün|dni|日|일|दिन|أيام|hari|dní|dagen)"
RULE_WORDS = r"(regole|rules|reglas|regras|règles|regeln|правил|kural|reguł|قواعد|aturan|규칙|नियम|条)"
LANG_WORDS = r"(lingue|languages|idiomas|langues|sprachen|языков|diller|języków|언어|भाषा|لغات|bahasa|語|种语言)"


def near_currency(line, start, end):
    w = line[max(0, start - 18):end + 18]
    return bool(CURRENCY.search(w))


def fix_price_singles(line, old_re, new_comma, new_dot):
    """Sostituisce un prezzo solo se vicino c'è contesto valuta. Preserva separatore."""
    out, i, changed = [], 0, 0
    for m in re.finditer(old_re, line):
        if not near_currency(line, m.start(), m.end()):
            continue
        out.append((m.start(), m.end(), m.group()))
    if not out:
        return line, 0
    res, last = [], 0
    for s, e, g in out:
        res.append(line[last:s])
        sep = "," if "," in g else "."
        res.append(new_comma if sep == "," else new_dot)
        last = e
        changed += 1
    res.append(line[last:])
    return "".join(res), changed


def process(text):
    n = 0
    lines = text.split("\n")
    for idx, line in enumerate(lines):
        orig = line
        # 1) RANGE annuale 29,59–59,99 → 19,99–24,99 (prima dei singoli)
        def range_repl(m):
            sep = "," if "," in m.group(1) else "."
            lo = "19,99" if sep == "," else "19.99"
            hi = "24,99" if sep == "," else "24.99"
            return lo + m.group(2) + hi
        line = re.sub(r"(29[.,]59)(\s*(?:&ndash;|–|~|-|&#8211;)\s*)(?:59[.,]99|49[.,]99)",
                      range_repl, line)
        # 2) prezzi singoli (currency-anchored)
        line, c1 = fix_price_singles(line, r"2[.,]69", "2,99", "2.99")
        line, c2 = fix_price_singles(line, r"67[.,]90", "99", "99")
        line, c3 = fix_price_singles(line, r"29[.,]59", "19,99", "19.99")
        # 3) trial 15 → 30 (ancorato alla parola giorni)
        line = re.sub(r"\b15(\s*[-]?\s*)" + DAY_WORDS, r"30\g<1>\g<2>", line, flags=re.I)
        # 4) regole 107 → 138
        line = re.sub(r"\b107(\s*)" + RULE_WORDS, r"138\g<1>\g<2>", line, flags=re.I)
        # 5) lingue 6 → 15
        line = re.sub(r"\b6(\s*)" + LANG_WORDS, r"15\g<1>\g<2>", line, flags=re.I)
        if line != orig:
            n += 1
            lines[idx] = line
    return "\n".join(lines), n


def fix_zh_jsonld(text):
    """Virgolette ASCII dentro stringhe cinesi del JSON-LD → 「」 (rompevano il JSON)."""
    # pattern: "…cinese"parola-cinese"…" → solo dentro testo CJK
    return text.replace('点击"添加至 Chrome"并确认', '点击「添加至 Chrome」并确认')


def main():
    total_files, total_lines = 0, 0
    for dp, _, names in os.walk(SITE):
        for nm in names:
            if not nm.endswith(".html"):
                continue
            p = os.path.join(dp, nm)
            text = open(p, encoding="utf-8").read()
            new, n = process(text)
            if "/zh/" in p.replace("\\", "/") or os.path.basename(dp) == "zh":
                new = fix_zh_jsonld(new)
            if new != text:
                total_files += 1
                total_lines += n
                rel = os.path.relpath(p, SITE)
                print(f"  {rel}: {n} righe")
                if not DRY:
                    open(p, "w", encoding="utf-8").write(new)
    print(f"\n{'[DRY] ' if DRY else ''}{total_files} file, {total_lines} righe modificate")


if __name__ == "__main__":
    main()
