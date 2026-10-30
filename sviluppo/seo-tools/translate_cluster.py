#!/usr/bin/env python3
"""Translate SEO streaming-cluster pages to 13 languages via local LLM (coder-next-ablit).

Resume-safe: skips existing valid <slug>.<lang>.json, writes each file as soon
as complete. Per-unit translation (never whole JSON to the model).
"""
import argparse, json, os, re, subprocess, sys, time
from pathlib import Path

BASE = Path(__file__).resolve().parent
CONTENT = BASE / "streaming-cluster" / "content"
LOG = BASE / "streaming-cluster" / "translate.log"
REVIEW = BASE / "streaming-cluster" / "REVIEW-NEEDED.md"
API_URL = "http://127.0.0.1:4000/v1/chat/completions"
DEFAULT_MODEL = "coder-next-ablit"

LANG_NAMES = {
    "ar": "Arabic", "de": "German", "es": "Spanish", "fr": "French",
    "hi": "Hindi", "id": "Indonesian", "ja": "Japanese", "ko": "Korean",
    "pl": "Polish", "pt": "Brazilian Portuguese", "ru": "Russian",
    "tr": "Turkish", "zh": "Simplified Chinese",
}
ALL_LANGS = list(LANG_NAMES)
# Pages whose `answer` states AdOff does NOT block the platform — negation gate.
NEGATION_SLUGS = {
    "server-side-ad-insertion-explained", "twitch-ad-blocker",
    "prime-video-ad-blocker", "netflix-ad-blocker",
    "spotify-ad-blocker", "disney-plus-ad-blocker",
}
FORBIDDEN = ["100%", "guaranteed", "garantito", "garantisce",
             "eroslifestyle", "erosdegrande", "github.com/", "netflix"]
PREAMBLE_RE = re.compile(
    r"^\s*(here is|here's|translation:|sure[,!]|certainly[,!]|below is)[^\n]*\n?",
    re.IGNORECASE)
TAGS = ("p", "li", "a", "strong", "table")
# Tag di sola enfasi: perderne uno NON scarta la pagina (nota in REVIEW-NEEDED).
EMPHASIS_TAGS = {"strong", "em", "b", "i"}
BLOCK_TAG_RE = re.compile(r"<(p|li|table|ul|ol|h[1-6]|blockquote)[\s>]", re.IGNORECASE)
# Bake limits (Unicode chars): CJK tighter, others title ≤70 (incl. " | AdOff"), desc 120-165.
CJK_LANGS = {"ja", "ko", "zh"}


def limits_for(lang):
    if lang in CJK_LANGS:
        return {"title_max": 40, "desc_min": 60, "desc_max": 100}
    return {"title_max": 70, "desc_min": 120, "desc_max": 165}


def _dist(n, lo, hi):
    if lo <= n <= hi:
        return 0
    return lo - n if n < lo else n - hi


SHORTEN_PROMPT = ("The following translation is {n} characters long, but the limit is "
                  "{lim} characters. Rewrite it tighter — same meaning, natural phrasing, "
                  "never cut a sentence in half, never drop a negation. Output ONLY the "
                  "rewritten translation, max {lim} characters.")
EXPAND_PROMPT = ("The following translation is {n} characters long, but it must be at "
                 "least {lim} characters. Expand it naturally to fit, using only "
                 "information already present in the original — never add new claims. "
                 "Output ONLY the expanded translation.")
# LLM shorten target: stricter than the real limit, gives the model margin.
SHORTEN_TARGET = {"cjk": 90, "other": 150}
SENT_TERMINATORS = ".!?。！？،؟।"
TITLE_SUFFIX = " | AdOff"
# Titles whose beginning asserts a negation — a hard truncation could invert it.
NEGATIVE_TITLE_STARTS = ("no,", "nein", "non,", "nunca", "jamás", "нет", "nie,",
                         "いいえ", "아니요", "不", "hayır", "nie", "नहीं", "tidak")


def split_sentences(text):
    """Split into sentences keeping terminators; multilingual terminators."""
    parts, cur = [], ""
    for ch in text:
        cur += ch
        if ch in SENT_TERMINATORS:
            parts.append(cur)
            cur = ""
    if cur.strip():
        parts.append(cur)
    return parts


def truncate_at_word(text, max_len):
    """Hard cut at last word boundary under max_len, closed with ellipsis."""
    cut = text[: max_len - 1].rsplit(" ", 1)[0].rstrip()
    return cut + "…"


def shorten_desc_deterministic(text, lo, hi):
    """Drop trailing sentences until under hi. If that would drop under lo,
    keep the previous (overlong) version. If even the first sentence is too
    long, word-truncate with '…'.
    Returns (text, note) — note None when clean, else a REVIEW-NEEDED reason.
    """
    if len(text) <= hi:
        return text, None
    sents = split_sentences(text)
    acc = text
    for i in range(len(sents) - 1, 0, -1):
        candidate = "".join(sents[:i]).strip()
        if len(candidate) <= hi:
            if len(candidate) >= lo:
                return candidate, None
            break  # would go under min: keep previous overlong version
        acc = candidate
    # first sentence alone still over hi → word truncate
    first = sents[0].strip() if sents else text
    if len(first) > hi:
        return truncate_at_word(first, hi), "troncata a confine parola con … (prima frase > max)"
    return acc, "mantenuta versione sforante (sotto-frasi < min)"


def fix_title(text, lang, tr):
    """One LLM retry, then deterministic word-truncation preserving ' | AdOff'.
    Returns (text, retries, problem) — problem set => caller discards page.
    """
    tmax = limits_for(lang)["title_max"]
    retries = 0
    if len(text) > tmax:
        retries = 1
        target = SHORTEN_TARGET["cjk"] if lang in CJK_LANGS else SHORTEN_TARGET["other"]
        target = min(target, tmax)
        text2 = tr(SHORTEN_PROMPT.format(n=len(text), lim=target) + "\n\n" + text)
        if len(text2) <= tmax:
            return text2, retries, None
        # deterministic: reserve space for suffix
        budget = tmax - len(TITLE_SUFFIX)
        body = text2 if len(text2) <= tmax else text2
        stripped = body.rstrip()
        if stripped.endswith(TITLE_SUFFIX):
            stripped = stripped[: -len(TITLE_SUFFIX)].rstrip()
        low = stripped.lower()
        if any(low.startswith(neg) for neg in NEGATIVE_TITLE_STARTS):
            return text2, retries, f"title {len(text2)} > {tmax} e inizia con negazione: niente troncamento"
        cut = truncate_at_word(stripped, budget)
        return cut + TITLE_SUFFIX, retries, None
    return text, retries, None


def fix_desc(text, lang, tr):
    """One LLM retry (shrink or expand), then deterministic fallback.
    Returns (text, retries, problem) — problem not-None => REVIEW-NEEDED.
    """
    lim = limits_for(lang)
    lo, hi = lim["desc_min"], lim["desc_max"]
    retries = 0
    if _dist(len(text), lo, hi) == 0:
        return text, 0, None
    n = len(text)
    if _dist(n, lo, hi) != 0:
        retries = 1
        if n > hi:
            target = SHORTEN_TARGET["cjk"] if lang in CJK_LANGS else SHORTEN_TARGET["other"]
            target = max(target, lo)
            text = tr(SHORTEN_PROMPT.format(n=n, lim=target) + "\n\n" + text)
        else:
            text = tr(EXPAND_PROMPT.format(n=n, lim=lo) + "\n\n" + text)
        if _dist(len(text), lo, hi) == 0:
            return text, retries, None
    if len(text) > hi:
        shortened, note = shorten_desc_deterministic(text, lo, hi)
        return shortened, retries, note
    return text, retries, f"description len {len(text)} < {lo} min anche dopo retry"


def fix_length(text, kind, lang, tr):
    """Dispatch: title or description. Returns (text, retries, problem)."""
    if kind == "title":
        return fix_title(text, lang, tr)
    return fix_desc(text, lang, tr)


def est_tokens(s):
    return max(1, len(s) // 4)


def load_key():
    env = Path.home() / ".claude" / "secrets" / "local-llm.env"
    if env.exists():
        for line in env.read_text().splitlines():
            m = re.match(r"^([A-Z_]+)=(.*)$", line)
            if m and m.group(2).strip():
                if m.group(1) in ("LITELLM_MASTER_KEY", "LITELLM_API_KEY", "LOCAL_LLM_KEY"):
                    return m.group(2).strip()
    return None


def clean_output(text):
    """Strip markdown fences, wrapping quotes, preamble lines."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z0-9]*\n?", "", t)
        t = re.sub(r"\n?```\s*$", "", t)
    while len(t) >= 2 and t[0] == t[-1] and t[0] in "\"'“”‘’`":
        t = t[1:-1].strip()
    t = PREAMBLE_RE.sub("", t)
    return t.strip()


def est_tokens(s):
    return max(1, len(s) // 4)


def call_llm(text, lang, model, api_key, back_to_en=False, timeout=180,
             batch=False):
    if back_to_en:
        sys_prompt = ("You are a professional translator. Translate the text "
                      "into English faithfully. Output ONLY the translation.")
    elif batch:
        sys_prompt = (
            f"You are a professional translator localising SEO marketing copy "
            f"for a browser extension into {LANG_NAMES[lang]}. The user message "
            f"contains multiple numbered segments, each introduced by a marker "
            f"line '<<<N>>>'. Return EXACTLY the same number of segments, with "
            f"the SAME markers '<<<N>>>' in the SAME order, translating only "
            f"the content between markers into {LANG_NAMES[lang]}. Never add, "
            f"remove, weaken or invert any claim — negations in particular "
            f"must be preserved exactly. Preserve all HTML tags and attributes "
            f"unchanged, translating only human-readable text. Never translate "
            f"URLs or href values. Output ONLY the numbered segments — no "
            f"preamble, notes, extra numbering or text outside the segments.")
    else:
        sys_prompt = (
            f"You are a professional translator localising SEO marketing copy "
            f"for a browser extension into {LANG_NAMES[lang]}. Translate "
            f"faithfully and idiomatically for a native reader. Never add, "
            f"remove, weaken or invert any claim — negations in particular "
            f"must be preserved exactly. Preserve all HTML tags and attributes "
            f"unchanged, translating only human-readable text. Never translate "
            f"URLs or href values. Output ONLY the translation with no "
            f"preamble, notes, quotes or reasoning.")
    max_tokens = max(300, 4 * est_tokens(text))
    import urllib.request
    body = json.dumps({
        "model": model, "temperature": 0.2, "max_tokens": max_tokens,
        "messages": [{"role": "system", "content": sys_prompt},
                     {"role": "user", "content": text}],
    }).encode()
    req = urllib.request.Request(API_URL, data=body, headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
    last_err = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.load(resp)
            out = clean_output(data["choices"][0]["message"]["content"] or "")
            if out:
                return out
            last_err = "empty after clean"
        except Exception as e:
            last_err = str(e)
        time.sleep(2 ** attempt * 3)
    raise RuntimeError(f"LLM call failed after retries: {last_err}")


# Block-batching: numbered segments so one call translates N strings.
# ponytail: per-group fallback to unit-per-unit keeps it safe if the model
# miscounts; log any fall to measure how often it happens.
BLOCK_RE = re.compile(r"<<<(\d+)>>>\n?")


def build_blocks(strings):
    return "\n".join(f"<<<{i + 1}>>>\n{s}" for i, s in enumerate(strings))


def parse_blocks(text, n):
    """Re-segment a numbered-block response. None if count/order wrong or a
    segment is empty (caller falls back to unit-per-unit)."""
    parts = BLOCK_RE.split(text)
    seen = [int(parts[i]) for i in range(1, len(parts) - 1, 2)]
    if len(set(seen)) != len(seen) or seen != sorted(seen):
        return None
    if seen != list(range(1, n + 1)):
        return None
    out = [parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)]
    if any(not s for s in out):
        return None
    return out


def count_tags(s):
    return {t: len(re.findall(rf"<{t}[\s>]", s)) for t in TAGS}


def repair_unwrapped_paragraph(orig_text, trans_text):
    """Se l'originale è un solo <p> che avvolge tutto e la traduzione è testo
    nudo (zero <p>, nessun altro tag di blocco), riavvolgila in <p>...</p>."""
    mo = re.fullmatch(r"<p>(.*)</p>", orig_text, re.DOTALL)
    if not mo:
        return trans_text
    if count_tags(trans_text).get("p", 0) != 0:
        return trans_text
    if BLOCK_TAG_RE.search(trans_text):
        return trans_text
    return f"<p>{trans_text.strip()}</p>"


def emphasis_only_diffs(orig_text, trans_text):
    """True se l'unica differenza di conteggi riguarda i tag di enfasi
    (strong/em/b/i) e tutto il resto (p/li/a/table) combacia."""
    co, ct = count_tags(orig_text), count_tags(trans_text)
    for t in TAGS:
        if t in EMPHASIS_TAGS:
            continue
        if co[t] != ct[t]:
            return False
    return co != ct  # combaciano i strutturali, ma c'è pur una differenza


def repair_bodies(orig, trans):
    """Riparazioni deterministiche sui body prima della validazione.
    1. riavvolgimento del paragrafo nudo; 2. marcatura enfasi persa.
    Ritorna (trans, lista note REVIEW-NEEDED)."""
    notes = []  # (prob_prefix da tollerare, nota per REVIEW-NEEDED)
    for i, (so, st) in enumerate(zip(orig["sections"], trans["sections"])):
        for j, (bo, bt) in enumerate(zip(so["body"], st["body"])):
            st["body"][j] = bt = repair_unwrapped_paragraph(bo, bt)
            if emphasis_only_diffs(bo, bt):
                lost = [t for t in TAGS if t in EMPHASIS_TAGS
                        and count_tags(bo)[t] != count_tags(bt)[t]]
                prefix = f"section{i}.body{j} tags differ"
                note = (f"section{i}.body{j} enfasi persa: {','.join(lost)}")
                notes.append((prefix, note))
    return trans, notes


def validate(orig, trans):
    """Return list of problems (empty = OK)."""
    probs = []
    if len(trans["sections"]) != len(orig["sections"]):
        probs.append(f"sections {len(trans['sections'])} != {len(orig['sections'])}")
        return probs
    for i, (so, st) in enumerate(zip(orig["sections"], trans["sections"])):
        if len(st["body"]) != len(so["body"]):
            probs.append(f"section{i} body len {len(st['body'])} != {len(so['body'])}")
        for j, (bo, bt) in enumerate(zip(so["body"], st["body"])):
            if count_tags(bo) != count_tags(bt):
                probs.append(f"section{i}.body{j} tags differ {count_tags(bo)} vs {count_tags(bt)}")
            for w in FORBIDDEN:
                if w.lower() in bt.lower():
                    probs.append(f"section{i}.body{j} forbidden: {w}")
            if PREAMBLE_RE.match(bt):
                probs.append(f"section{i}.body{j} preamble residue")
    if len(trans["faq"]) != len(orig["faq"]):
        probs.append(f"faq {len(trans['faq'])} != {len(orig['faq'])}")
    else:
        for i, (qo, qt) in enumerate(zip(orig["faq"], trans["faq"])):
            for key in ("q", "a"):
                for w in FORBIDDEN:
                    if w.lower() in qt[key].lower():
                        probs.append(f"faq{i}.{key} forbidden: {w}")
    if len(trans["related"]) != len(orig["related"]):
        probs.append(f"related {len(trans['related'])} != {len(orig['related'])}")
    else:
        for i, (ro, rt) in enumerate(zip(orig["related"], trans["related"])):
            if ro["href"] != rt["href"]:
                probs.append(f"related{i}.href changed: {ro['href']} -> {rt['href']}")
            for w in FORBIDDEN:
                if w.lower() in rt["text"].lower():
                    probs.append(f"related{i}.text forbidden: {w}")
    if orig.get("report") and trans.get("report"):
        if orig["report"]["btn_href"] != trans["report"]["btn_href"]:
            probs.append("report.btn_href changed")
    for field in ("title", "description", "h1", "answer"):
        for w in FORBIDDEN:
            if w.lower() in trans[field].lower():
                probs.append(f"{field} forbidden: {w}")
    return probs


def hhem_score(source, claim):
    """HHEM back-translation gate. Returns score or None if unavailable."""
    try:
        r = subprocess.run(["hhem-score", "--source", source, "--claim", claim],
                           capture_output=True, text=True, timeout=120)
        m = re.search(r"([01]\.\d+)", r.stdout)
        return float(m.group(1)) if m else None
    except Exception:
        return None


def translate_page(slug, lang, model, api_key, dry_run=False):
    src = json.loads((CONTENT / f"{slug}.en.json").read_text())
    out = json.loads(json.dumps(src))  # deep copy keeps hrefs/dates/report hrefs
    out["lang"] = lang
    calls = 0
    t0 = time.time()

    def tr(text):
        nonlocal calls
        calls += 1
        return call_llm(text, lang, model, api_key)

    fallbacks = [0]

    def tr_group(strings, group_name):
        """Translate a list of strings in ONE batched call; on any
        mis-segmentation fall back to unit-per-unit for this group only."""
        nonlocal calls
        if not strings:
            return strings
        calls += 1
        try:
            resp = call_llm(build_blocks(strings), lang, model, api_key,
                            batch=True)
            segs = parse_blocks(resp, len(strings))
            if segs is not None and len(segs) == len(strings):
                return segs
        except Exception:
            pass
        fallbacks[0] += 1
        log(f"{slug} {lang}: batch fallback su gruppo '{group_name}' "
            f"({len(strings)} unità)")
        return [tr(s) for s in strings]

    if not dry_run:
        out["title"], tr_t, prob_t = fix_length(tr(src["title"]), "title", lang, tr)
        out["description"], tr_d, prob_d = fix_length(tr(src["description"]), "description", lang, tr)
        if prob_t:
            raise ValueError(f"length: {prob_t}")
        out["h1"] = tr(src["h1"])
        out["answer"] = tr(src["answer"])
        h2s = [so["h2"] for so in src["sections"]]
        h2t = tr_group(h2s, "h2")
        bodies = [b for so in src["sections"] for b in so["body"]]
        bodyt = tr_group(bodies, "body")
        pos = hpos = 0
        for so, st in zip(src["sections"], out["sections"]):
            st["h2"] = h2t[hpos]; hpos += 1
            st["body"] = bodyt[pos:pos + len(so["body"])]
            pos += len(so["body"])
        fqs = [fo["q"] for fo in src["faq"]]
        fas = [fo["a"] for fo in src["faq"]]
        fqt = tr_group(fqs, "faq-q")
        fat = tr_group(fas, "faq-a")
        for ft, q, a in zip(out["faq"], fqt, fat):
            ft["q"], ft["a"] = q, a
        misc = [ro["text"] for ro in src["related"]]
        misc += [src["cta"]["h3"], src["cta"]["p"], src["cta"]["btn"]]
        has_report = bool(src.get("report"))
        if has_report:
            misc += [src["report"]["intro"], src["report"]["btn_text"]]
        misct = tr_group(misc, "misc")
        i = 0
        for ro, rt in zip(src["related"], out["related"]):
            rt["text"] = misct[i]; i += 1
        out["cta"]["h3"], out["cta"]["p"], out["cta"]["btn"] = misct[i:i + 3]
        i += 3
        if has_report:
            out["report"]["intro"], out["report"]["btn_text"] = misct[i], misct[i + 1]

        out, emph_notes = repair_bodies(src, out)
        probs = validate(src, out)
        for prefix, note in emph_notes:
            probs = [p for p in probs if not p.startswith(prefix)]
            with open(REVIEW, "a") as f:
                f.write(f"\n## {slug} / {lang} — enfasi persa\n\n{note}\n")
            log(f"{slug} {lang}: {note}, in REVIEW-NEEDED.md")
        if probs:
            raise ValueError("validation: " + "; ".join(probs[:5]))

        if prob_d:
            with open(REVIEW, "a") as f:
                f.write(f"\n## {slug} / {lang} — description length\n\n"
                        f"{prob_d}\n\n**Valore accettato (closest):**\n\n{out['description']}\n")
            log(f"{slug} {lang}: {prob_d}, in REVIEW-NEEDED.md")

        # Negation gate: back-translate answer, score with HHEM.
        if slug in NEGATION_SLUGS:
            calls += 1
            back = call_llm(out["answer"], lang, model, api_key, back_to_en=True)
            score = hhem_score(src["answer"], back)
            if score is None:
                log(f"{slug} {lang}: HHEM non disponibile, proseguo")
            elif score < 0.5:
                with open(REVIEW, "a") as f:
                    f.write(f"\n## {slug} / {lang} — score {score}\n\n"
                            f"**Original EN answer:**\n\n{src['answer']}\n\n"
                            f"**Back-translation:**\n\n{back}\n")
                log(f"{slug} {lang}: HHEM score {score} < 0.5, in REVIEW-NEEDED.md")
            else:
                log(f"{slug} {lang}: negation gate OK (score {score})")

        (CONTENT / f"{slug}.{lang}.json").write_text(
            json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    return calls, fallbacks[0], time.time() - t0


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def load_translated(path):
    """For resume: a file is valid if it parses and has the expected keys."""
    try:
        d = json.loads(path.read_text())
        return all(k in d for k in ("slug", "lang", "title", "sections", "faq"))
    except Exception:
        return False


def selfcheck():
    # clean_output
    assert clean_output("Here is the translation:\nHallo Welt") == "Hallo Welt"
    assert clean_output("```text\nCiao\n```") == "Ciao"
    assert clean_output('"Bonjour"') == "Bonjour"
    assert clean_output("`Hola`") == "Hola"
    # validator: FAQ count mismatch rejected
    orig = {"sections": [{"h2": "a", "body": ["<p>x</p>"]}],
            "faq": [{"q": "q1", "a": "a1"}, {"q": "q2", "a": "a2"}],
            "related": [{"href": "/x", "text": "x"}],
            "report": None, "title": "t", "description": "d", "h1": "h", "answer": "a"}
    bad = json.loads(json.dumps(orig)); bad["faq"] = bad["faq"][:1]
    assert validate(orig, bad)
    # validator: lost <a> tag in body rejected
    bad2 = json.loads(json.dumps(orig))
    bad2["sections"][0]["body"] = ["<p>text no link</p>"]
    orig["sections"][0]["body"] = ['<p>see <a href="/slug">page</a></p>']
    assert validate(orig, bad2)
    # good copy passes
    good = json.loads(json.dumps(orig))
    good["faq"], good["sections"][0]["body"] = orig["faq"], ['<p>vedi <a href="/slug">pagina</a></p>']
    good["title"] = good["description"] = good["h1"] = good["answer"] = "ok"
    good["related"][0]["text"] = "x"
    assert validate(orig, good) == []
    # hrefs copied identically (deep copy semantics)
    copy = json.loads(json.dumps(orig))
    copy["related"][0]["href"] == orig["related"][0]["href"]

    # length limits: fake translator returns the model line unchanged (stubborn)
    def stubborn(s):
        return s.split("\n\n")[-1]

    # de description, two sentences, 183 chars: retry fails -> deterministic
    # fallback drops the second sentence, keeping the first (131 chars, in range)
    d_first = ("Twitch integriert Werbung direkt in den Live-Stream – keine "
               "Erweiterung kann sie entfernen, ohne die Wiedergabe zu unterbrechen.")
    d190 = d_first + " Was wirklich passiert, warum und Ihre echten Optionen."
    assert len(d190) == 183, len(d190)
    fixed, retries, prob = fix_length(d190, "description", "de", stubborn)
    assert fixed == d_first and 120 <= len(fixed) <= 165 and prob is None

    # description whose first sentence alone is 200 chars: word-truncate with …
    long_first = ("Das " + "Wort " * 39).strip() + "."  # 200 chars, one sentence
    fixed2, _, prob2 = fix_length(long_first, "description", "de", stubborn)
    assert len(fixed2) <= 165 and fixed2.endswith("…") and prob2 is not None

    # overlong title: deterministic cut preserves " | AdOff" suffix
    t_long = "Twitch Werbeblocker funktionieren nicht wirklich, aber hier ist " \
             "die ganze Wahrheit über den violetten Bildschirm von Twitch"
    fixed_t, _, prob_t = fix_title(t_long, "de", stubborn)
    assert len(fixed_t) <= 70 and fixed_t.endswith(" | AdOff") and prob_t is None

    # title starting with a negation that still overflows after retry: rejected
    t_neg = "Nein, Twitch-Werbeanzeigen können durch Browser-Erweiterungen " \
            "nicht zuverlässig blockiert werden, das ist ein Fakt"
    _, _, prob_neg = fix_title(t_neg, "de", stubborn)
    assert prob_neg is not None

    # ja description of 80 chars fits (60-100) with zero retries
    _, retries0, prob0 = fix_desc("こ" * 80, "ja", stubborn)
    assert retries0 == 0 and prob0 is None
    # limits table sanity
    assert limits_for("ja")["title_max"] == 40 and limits_for("de")["title_max"] == 70

    # block batching: round-trip on 5 strings (HTML + newlines inside)
    strs = ["Home", "<p>Ciao <a href=\"/x\">mondo</a></p>", "Due righe:\nseconda",
            "Domanda?", "Risposta con — trattino"]
    resp = build_blocks(strs)
    assert parse_blocks(resp, 5) == strs
    # 4 segments instead of 5 -> fallback (None), not corrupted data
    bad = build_blocks(strs[:4])
    assert parse_blocks(bad, 5) is None
    # empty segment -> fallback
    empty = resp.replace("Domanda?", "")
    assert parse_blocks(empty, 5) is None
    # missing marker entirely -> fallback
    assert parse_blocks("solo testo senza marcatori", 1) is None
    # duplicate marker -> fallback
    dup = "<<<1>>>\na\n<<<1>>>\nb"
    assert parse_blocks(dup, 2) is None
    # out-of-order markers -> rejected (order must be preserved)
    reorder = "<<<1>>>\na\n<<<3>>>\nc\n<<<2>>>\nb"
    assert parse_blocks(reorder, 3) is None

    # repair: testo nudo con originale <p> unico → riavvolto
    assert repair_unwrapped_paragraph("<p>Ciao mondo</p>", "مرحبا بالعالم") == "<p>مرحبا بالعالم</p>"
    # traduzione già con <p> → invariata
    assert repair_unwrapped_paragraph("<p>x</p>", "<p>y</p>") == "<p>y</p>"
    # traduzione con altro tag di blocco → non toccata
    assert repair_unwrapped_paragraph("<p>x</p>", "<ul><li>y</li></ul>") == "<ul><li>y</li></ul>"
    # originale senza <p> unico → non toccata
    assert repair_unwrapped_paragraph("testo", "traduzione") == "traduzione"
    # enfasi persa: strong differisce, resto uguale → tollerata
    assert emphasis_only_diffs("<p>un <strong>firm</strong> qui</p>", "<p>un firm qui</p>")
    # a perso → NON tollerata (struttura/link)
    assert not emphasis_only_diffs('<p>vedi <a href="/x">q</a></p>', "<p>vedi q</p>")
    # tutto uguale → non è una differenza
    assert not emphasis_only_diffs("<p>x</p>", "<p>y</p>")

    # repair_bodies end-to-end: strong perso → probs filtrate, nota emessa
    orig_b = {"sections": [{"h2": "h", "body": ['<p>un <strong>firm</strong> qui</p>']}],
              "faq": [], "related": [], "report": None}
    trans_b = json.loads(json.dumps(orig_b))
    trans_b["sections"][0]["body"] = ["<p>un firm qui</p>"]
    trans_b, notes = repair_bodies(orig_b, trans_b)
    for k in ("title", "description", "h1", "answer"):
        orig_b[k] = trans_b[k] = "ok"
    probs = validate(orig_b, trans_b)
    for prefix, note in notes:
        probs = [p for p in probs if not p.startswith(prefix)]
    assert probs == [], probs
    assert len(notes) == 1 and "strong" in notes[0][1], notes
    print("selfcheck OK")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", default=",".join(ALL_LANGS))
    ap.add_argument("--slugs", default=None)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="max pages (test)")
    ap.add_argument("--selfcheck", action="store_true")
    args = ap.parse_args()
    if args.selfcheck:
        sys.exit(selfcheck())

    api_key = load_key()
    if not api_key:
        sys.exit("ERROR: no LLM API key found in ~/.claude/secrets/local-llm.env")
    langs = [l for l in args.langs.split(",") if l]
    slugs = ([s for s in args.slugs.split(",") if s] if args.slugs
             else sorted(p.name.split(".")[0] for p in CONTENT.glob("*.en.json")))
    jobs = [(s, l) for s in slugs for l in langs]
    if args.limit:
        jobs = jobs[:args.limit]

    done = skipped = failed = 0
    for slug, lang in jobs:
        dest = CONTENT / f"{slug}.{lang}.json"
        if dest.exists() and load_translated(dest):
            skipped += 1
            continue
        try:
            calls, fb, secs = translate_page(slug, lang, args.model, api_key, args.dry_run)
            done += 1
            log(f"{slug} {lang} ✓ ({calls} chiamate, {fb} fallback batch, {secs:.0f}s)")
        except Exception as e:
            failed += 1
            log(f"{slug} {lang} FAIL: {e}")
    log(f"RIEPILOGO: completate={done} saltate(esistenti)={skipped} fallite={failed} su {len(jobs)}")


if __name__ == "__main__":
    main()
