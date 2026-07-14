#!/usr/bin/env python3
"""AdOff — enqueue CONTROLLATO dei master voiced+synced in social_posts.

NON bulk. Solo i 4 master tech-reveal/hyper-spec (it/en) prodotti da
render-tech-voiced.mjs (audio==testo per lingua, regola inviolabile).
Per ogni master crea 3 draft: instagram, facebook, tiktok(no-logo).
Tutti status='draft' → gate umano nella admin UI (social.adoff.app).
Idempotente. NON pubblica nulla (dispatcher resta fermo finché l'utente
non approva + si riabilita esplicitamente).

Pre-req: i file in output/typologies/{id}-{lang}.mp4 e
{id}-{lang}__nologo.mp4 devono esistere. Lo script li COPIA in
output/bank/ (così media.adoff.app li serve per IG/FB e
/opt/n8n/local-files/adoff-bank li espone per TikTok FILE_UPLOAD).

Uso:  enqueue_voiced_masters.py [--dry-run]
"""
import shutil
import subprocess
import sys
from pathlib import Path

VE = Path("/home/mrxxx/adoff/sviluppo/marketing/video-engine")
TYP = VE / "output" / "typologies"
BANK = VE / "output" / "bank"
TT_DIR = "/opt/n8n/local-files/adoff-bank"        # symlink -> output/bank
MEDIA = "https://media.adoff.app"

# (id, lang, caption, hashtags) — brand-safe: nessun brand reale, no
# "15-day"/"149KB"/dati personali. Caption editabile poi nella UI.
MASTERS = [
    ("tech-reveal", "it",
     "Volevi solo guardare un video. Invece: pubblicità prima, durante, "
     "ovunque. Un click e torna il silenzio.",
     "#adblock #privacy #browser #adoff"),
    ("tech-reveal", "en",
     "You just wanted to watch. Instead: ads before, mid, everywhere. "
     "One click and the silence is back.",
     "#adblock #privacy #browser #adoff"),
    ("hyper-spec", "it",
     "Zero pubblicità, ovunque. Invisibile all'anti-adblock. Su ogni "
     "browser. Zero dati raccolti.",
     "#adblock #privacy #browser #adoff"),
    ("hyper-spec", "en",
     "Zero ads, everywhere. Invisible to anti-adblock. Every browser. "
     "Zero data collected.",
     "#adblock #privacy #browser #adoff"),
]


def esc(s):
    return str(s).replace("'", "''")


def main():
    dry = "--dry-run" in sys.argv
    missing = []
    for mid, lang, _, _ in MASTERS:
        std = TYP / f"{mid}-{lang}.mp4"
        nol = TYP / f"{mid}-{lang}__nologo.mp4"
        if not std.exists():
            missing.append(str(std))
        if not nol.exists():
            missing.append(str(nol))
    if missing:
        raise SystemExit("Master mancanti (renderizza prima):\n  " +
                          "\n  ".join(missing))

    BANK.mkdir(parents=True, exist_ok=True)
    sql = []
    for mid, lang, caption, tags in MASTERS:
        std_name = f"{mid}-{lang}.mp4"
        nol_name = f"{mid}-{lang}__nologo.mp4"
        if not dry:
            shutil.copy2(TYP / std_name, BANK / std_name)
            shutil.copy2(TYP / nol_name, BANK / nol_name)
        std_host = str(BANK / std_name)
        pub = f"{MEDIA}/{std_name}"
        tt_path = f"{TT_DIR}/{nol_name}"
        for plat, mp, mpu, nolog in (
            ("instagram", std_host, pub, False),
            ("facebook", std_host, pub, False),
            ("tiktok", tt_path, "", True),
        ):
            mpu_sql = "NULL" if not mpu else f"'{esc(mpu)}'"
            sql.append(
                "INSERT INTO adoff_autopilot.social_posts "
                "(brand,platform,account_ref,media_type,media_path,"
                "media_public_url,no_logo_variant,caption,hashtags,lang,"
                "ai_generated,status) "
                f"SELECT 'adoff','{plat}','adoff','video','{esc(mp)}',"
                f"{mpu_sql},{'true' if nolog else 'false'},"
                f"'{esc(caption)}','{esc(tags)}','{esc(lang)}',true,'draft' "
                "WHERE NOT EXISTS (SELECT 1 FROM adoff_autopilot.social_posts "
                f"WHERE platform='{plat}' AND media_path='{esc(mp)}' "
                "AND status IN ('draft','approved','publishing','published'))")

    full = ";\n".join(sql) + ";"
    if dry:
        print(f"[DRY-RUN] {len(sql)} INSERT (12 attesi). Nessuna modifica.")
        print(full[:600] + "\n...")
        return
    r = subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n",
         "-d", "n8n", "-v", "ON_ERROR_STOP=1"],
        input=full, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"psql err: {r.stderr.strip()[:400]}")
    q = subprocess.run(
        ["docker", "exec", "-i", "n8n-postgres", "psql", "-U", "n8n",
         "-d", "n8n", "-tAc",
         "SELECT platform,status,count(*) FROM adoff_autopilot.social_posts "
         "GROUP BY platform,status ORDER BY platform,status;"],
        capture_output=True, text=True)
    print(f"[OK] {len(sql)} INSERT eseguiti (idempotenti). Stato coda:")
    print(q.stdout.strip())
    print("\nDraft pronti per revisione su https://social.adoff.app "
          "(NIENTE pubblicato: dispatcher fermo finché non approvi + "
          "riabiliti esplicitamente).")


if __name__ == "__main__":
    main()
