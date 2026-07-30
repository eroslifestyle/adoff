#!/usr/bin/env python3
"""Traduce le ultime chiavi residue per pl/hi/id."""
import json, re, pathlib, subprocess

I18N = pathlib.Path(__file__).resolve().parents[3] / "site" / "i18n"
en = json.load(open(I18N / "en.json", encoding="utf-8"))
RESIDUE = [
    'pricing.free.cta', 'pricing.free.features', 'pricing.hero.sub',
    'pricing.meta.description', 'pricing.meta.og.description', 'pricing.meta.og.title',
    'pricing.meta.title', 'pricing.meta.twitter.description', 'pricing.pro.annual.note',
    'pricing.pro.cta', 'pricing.pro.features', 'pricing.vpn.annual.note',
    'pricing.vpn.cta', 'pricing.vpn.features',
]
LANGS = {'pl': 'POLACCO', 'hi': 'HINDI', 'id': 'INDONESIANO'}
NOTE = {'hi': 'Scrivi in devanagari.'}

for lang, name in LANGS.items():
    fp = I18N / f"{lang}.json"
    d = json.load(open(fp, encoding="utf-8"))
    todo = {k: en[k] for k in RESIDUE if d.get(k, "") == en.get(k, "")}
    if not todo:
        print(f"  [{lang}] niente da fare")
        continue
    note = NOTE.get(lang, "")
    prompt = (
        f"Traduci in {name} il testo umano dentro questo JSON. "
        "Tag HTML, attributi, classi, onclick, prezzi restano IDENTICI. "
        "AdOff, Pro, Free, Premium VPN non si traducono. "
        f"{note} SOLO JSON output.\n\n"
        + json.dumps(todo, ensure_ascii=False)
    )
    r = subprocess.run(["m3-code", "--code", prompt], capture_output=True, text=True, timeout=300)
    raw = r.stdout.strip()
    m = re.findall(r"```(?:json)?\s*\n(.*?)```", raw, re.S)
    if m:
        raw = m[0].strip()
    i, j = raw.find("{"), raw.rfind("}")
    if i >= 0 and j >= 0:
        try:
            got = json.loads(raw[i:j + 1])
        except json.JSONDecodeError:
            print(f"  [{lang}] JSON non valido, salto")
            continue
        n = 0
        for k in todo:
            if k in got and isinstance(got[k], str) and got[k].strip():
                src_tags = sorted(re.findall(r"<[^>]+>", todo[k]))
                got_tags = sorted(re.findall(r"<[^>]+>", got[k]))
                if src_tags == got_tags:
                    d[k] = got[k]
                    n += 1
        json.dump(d, open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
        print(f"  [{lang}] {n}/{len(todo)} accettate")
    else:
        print(f"  [{lang}] nessun JSON valido in risposta")
