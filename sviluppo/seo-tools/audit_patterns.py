"""Pattern e lessici per seo_audit.py: regex di rilevamento + soglie lessicali.

Modulo separato per responsabilità: qui vive SOLO il "cosa cercare",
il "come cercare" (su quali file, con quali esclusioni) sta in seo_audit.py.

Nota falsi positivi content.model_claims (perché i pattern sono costruiti così):
- Tedesco "pro" = "per" ("Umsatz pro Plan"): GENERIC_PRO_RE esige "Pro" con
  maiuscola, quindi "pro Plan" minuscolo non matcha mai.
- Hindi प्रो in parole comuni (प्रोग्राम, प्रोफाइल): ADOFF_PRO_RE esige
  "AdOff" letterale subito prima, le parole comuni non matchano.
- Francese: nessun pattern basato su "-eur" (moteur, ordinateur...).
- Prezzi/piani dei COMPETITOR nelle pagine /vs/*: i pattern generici (trial,
  "Pro plan") sono valutati solo FUORI da /vs/* (in seo_audit.py);
  "AdOff Pro/Premium" invece vale ovunque: parla del NOSTRO prodotto.

Nota falso positivo content.stale_numbers:
- "30,000 static rules" / "30.000 regole estáticas" (limiti Chrome, liste
  competitor): il separatore di migliaia precede il numero catturato, quindi
  RULES_NUM_RE esige che il numero NON sia preceduto né seguito da cifra o
  separatore (lookaround su [\\d.,]).
"""

import re

# Parole "regola" nelle 15 lingue del sito (vicino al numero = claim di conteggio)
RULE_WORDS = (
    "rules?|regole|Regeln|règles|reglas|regras|reguły|правил\\w*|kurallar|"
    "aturan|नियम|ルール|规则|규칙|قواعد"
)
# Il numero non dev'essere un pezzo di un numero più grande: in "30,000 static
# rules" (limite Chrome) il vecchio \b agganciava "000" e lo confrontava con 180.
RULES_NUM_RE = re.compile(rf"(?<![\d.,])(\d{{2,4}})(?!\d|[.,]\d)\s*(?:[\w' ]{{0,30}}?\b(?:{RULE_WORDS})\b)", re.I)
# Versioni con confini puliti: i path SVG contengono sequenze numeriche tipo
# "C.92 16.46 0 20.12" che sembrano versioni (lookaround esclude quelle incollate)
VERSION_RE = re.compile(r"(?<![\d.])3\.\d{1,2}\.\d+(?![\d.])")

# "AdOff Pro"/"AdOff Premium" non esistono più come piani (gratis al 100%)
ADOFF_PRO_RE = re.compile(r"\bAdOff\s+(?:Pro|Premium)\b", re.I)
GENERIC_PRO_RE = re.compile(
    r"\bPro\s+(?:plan|tier|version|versione|piano)\b|\b(?:piano|versione)\s+Pro\b"
)
# "15/30 giorni" richiede contesto trial vicino (TRIAL_CTX_RE) per contare
TRIAL_RE = re.compile(
    r"\b(?:15|30)[\s\-‑]?(?:day|days|giorni|giorno|días|día|Tage|Tag|jours|"
    r"дней|дня|日|日間|일|gün)\b",
    re.I,
)
TRIAL_CTX_RE = re.compile(
    r"(?i)\b(?:trial|prova\s+gratuita|Probe|Testversion|essai\s+gratuit|"
    r"परीक्षण|体験|thử\w*|deneme|пробн\w+|تجريبي)\b"
)

# Residui di find&replace "ad" → "free ad" finiti dentro parole inglesi
BROKEN_PHRASES = ["free adds", "its free adds", "free guarantee", 'a free for"']

# Crawler AI che robots.txt NON deve bloccare (apertura ai motori AI)
AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended",
               "anthropic-ai", "ChatGPT-User"]

# Pattern "last updated" visibile. Il sito usa "Updated April 2026", quindi
# accetto anche "updated/aggiornat*" da solo: meglio un falso negativo
# (testo generico con "updated") che un falso positivo.
# Copertura multilingua: ar/hi/id/ko/pl/pt/tr aggiunte; `aggiorna\w+` copre
# anche "aggiornamento". Niente \b su CJK/arabo/hindi: \b non esiste fra
# caratteri non-latini (in "最終更新日" tutti sono \w, nessun boundary → non
# matcherebbe mai), e lì non servono.
FRESHNESS_RE = re.compile(
    r"(?i)(?:\b(?:last\s+updated|updated|aggiorna\w+|zuletzt\s+aktualisiert|"
    r"aktualizacj\w*|actualizad[oa]s?|atualizad\w*|mis\s+à\s+jour|diperbarui|"
    r"güncelle\w*|обновлен\w*)\b|更新|업데이트|تحديث|अपडेट)"
)
