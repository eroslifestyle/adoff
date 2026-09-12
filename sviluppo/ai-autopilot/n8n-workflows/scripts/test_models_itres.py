import json, urllib.request, time, sys

PROMPT = ("Transcreate the AD into NATIVE flawless Italian and Spanish. "
          "Correct verb conjugations and agreement, re-read and fix errors. "
          "Keep brand AdOff and url adoff.app verbatim. "
          'Output ONLY minified JSON {"it":"...","es":"..."}. '
          "AD (English): Ads secretly track everything you do online. AdOff blocks them "
          "invisibly across the web - faster pages, full privacy. Try AdOff free at adoff.app.")

for m in ["huihui_ai/llama3.3-abliterated:70b", "huihui_ai/qwen3-abliterated:32b"]:
    t0 = time.time()
    body = json.dumps({"model": m, "stream": False,
                        "options": {"temperature": 0.2, "num_predict": 400},
                        "prompt": PROMPT}).encode()
    try:
        req = urllib.request.Request("http://172.17.0.1:11434/api/generate", body,
                                     {"Content-Type": "application/json"})
        r = json.load(urllib.request.urlopen(req, timeout=220))
        print("=== %s (%ss) ===" % (m, int(time.time() - t0)))
        print(r.get("response", "").strip()[:500])
    except Exception as e:
        print("=== %s FAIL: %s" % (m, e))
