#!/usr/bin/env python3
"""
Guardia anti-regressione su Safari.

Durante i fix di contenuto tre agenti hanno rimosso le sezioni Safari dalle pagine
di installazione, interpretando male `constants.json` (`browsers_coming_soon: ["Safari"]`).
La realta': `site/adoff-safari.zip` esiste ed e' scaricabile — Safari non e' sul
Mac App Store, ma l'estensione c'e' e le pagine di installazione la documentano
correttamente (richiede Xcode).

Questo script confronta le occorrenze di "Safari" con un riferimento git e segnala
ogni calo, cosi' la regressione non puo' ripresentarsi silenziosamente.

Uso:  python3 guard_safari.py [--ref HEAD] [--fix]
      --fix ripristina dal riferimento i file che hanno perso occorrenze
"""
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"

# tolleranza: rimuovere Safari da un ELENCO di browser supportati e' legittimo
# (il conteggio ufficiale resta 5), quindi un calo minimo non e' un errore.
TOLLERANZA = 2


def git_show(ref, rel):
    r = subprocess.run(["git", "show", f"{ref}:{rel}"],
                       capture_output=True, text=True, cwd=str(ROOT))
    return r.stdout if r.returncode == 0 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", default="HEAD")
    ap.add_argument("--fix", action="store_true")
    a = ap.parse_args()

    problemi = []
    for p in sorted(SITE.rglob("*.html")):
        rel = p.relative_to(ROOT).as_posix()
        before = git_show(a.ref, rel)
        if before is None:
            continue  # file nuovo, niente da confrontare
        b = before.lower().count("safari")
        if b == 0:
            continue
        after = p.read_text(encoding="utf-8", errors="replace").lower().count("safari")
        if after < b - TOLLERANZA:
            problemi.append((rel, b, after))

    if not problemi:
        print(f"OK — nessuna rimozione di Safari oltre la tolleranza ({TOLLERANZA}) "
              f"rispetto a {a.ref}")
        return 0

    print(f"{len(problemi)} file hanno perso riferimenti a Safari rispetto a {a.ref}:\n")
    for rel, b, af in problemi:
        print(f"  {rel:<44} {b:>3} -> {af:<3} ({af-b:+d})")

    if a.fix:
        print("\nripristino dal riferimento:")
        for rel, _, _ in problemi:
            subprocess.run(["git", "checkout", a.ref, "--", rel], cwd=str(ROOT), check=True)
            print(f"  ripristinato {rel}")
        print("\nATTENZIONE: il ripristino annulla anche le altre correzioni fatte su "
              "quei file (versione, trial). Vanno riapplicate.")
        return 0

    print("\nRilancia con --fix per ripristinarli, oppure correggi a mano.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
