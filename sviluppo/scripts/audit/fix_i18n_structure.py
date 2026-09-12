#!/usr/bin/env python3
"""
Fix i18n and nav/footer structure across site HTML files.
Applies 3 tasks:
1. Add adoff-i18n.js to pages missing it (excl. admin pages)
2. Migrate 12 legacy pages to shared nav/footer scripts
3. Fix relative icon128.png paths to absolute
"""
import re
import os
from pathlib import Path

PROJECT = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site")
AUDIT_DIR = PROJECT.parent / "sviluppo/scripts/audit"
I18N_SCRIPT = '  <script src="/adoff-i18n.js?v=260718-fix"></script>'
NAV_SCRIPT = '  <script src="/adoff-nav.js?v=260718"></script>\n  <script src="/adoff-footer.js?v=260613d"></script>'

# Admin pages: skip nav/footer migration (may also skip i18n)
ADMIN_PAGES = {"admin-console.html", "mgmt-9f4a/index.html", "panel.html", "account/index.html"}

# 12 pages needing nav/footer migration
MIGRATE_NAV_PAGES = {
    "vs/adblock.html", "vs/adguard.html", "vs/brave.html", "vs/cyberghost.html",
    "vs/expressvpn.html", "vs/ghostery.html", "vs/nordvpn.html", "vs/privacyspy.html",
    "vs/protonvpn.html", "vs/ublock-origin.html", "about-data/index.html", "it/about-data/index.html"
}

# Regex patterns
RE_I18N_EXISTS = re.compile(r'<script\s+src=["\']/(?:/)?adoff-i18n\.js', re.IGNORECASE)
RE_HEAD_END = re.compile(r'(</head>)', re.IGNORECASE)
RE_BODY_END = re.compile(r'(</body>)', re.IGNORECASE)

# Nav legacy pattern (flexible: match id, class names)
RE_NAV_LEGACY = re.compile(
    r'<nav\s+id="site-nav"[^>]*>.*?</nav>',
    re.DOTALL | re.IGNORECASE
)
NAV_REPLACEMENT = '<nav id="site-nav" role="navigation" aria-label="Navigazione principale"></nav>'

# Footer legacy pattern (has footer__inner)
RE_FOOTER_LEGACY = re.compile(
    r'<footer>(?:(?!</footer>).)*footer__inner(?:(?!</footer>).)*</footer>',
    re.DOTALL | re.IGNORECASE
)
FOOTER_REPLACEMENT = "<footer></footer>"

# Icon paths
RE_ICON_48 = re.compile(r'src="/assets/icon-48\.png"')
ICON_48_REPL = 'src="/assets/icon128.png"'
RE_REL_ICON = re.compile(r'src="assets/icon128\.png"')
REL_ICON_REPL = 'src="/assets/icon128.png"'


def load_need_i18n_list():
    """Load list of pages needing i18n from audit file."""
    need_i18n_file = AUDIT_DIR / "out/need_i18n.txt"
    with open(need_i18n_file, "r") as f:
        return [line.strip() for line in f if line.strip()]


def add_i18n_script(content):
    """Add i18n script to <head> if not already present."""
    if RE_I18N_EXISTS.search(content):
        return content, False  # Already has it

    # Insert before </head>
    content, count = RE_HEAD_END.subn(I18N_SCRIPT + "\n\\1", content, count=1)
    if count:
        return content, True
    return content, False


def fix_nav_legacy(content):
    """Replace legacy nav with empty container."""
    new_content, count = RE_NAV_LEGACY.subn(NAV_REPLACEMENT, content)
    return new_content, count > 0


def fix_footer_legacy(content):
    """Replace legacy footer with empty container."""
    new_content, count = RE_FOOTER_LEGACY.subn(FOOTER_REPLACEMENT, content)
    return new_content, count > 0


def add_body_scripts(content):
    """Add nav/footer scripts before </body>."""
    new_content, count = RE_BODY_END.subn(NAV_SCRIPT + "\n\\1", content, count=1)
    return new_content, count > 0


def fix_icon_48(content):
    """Fix icon-48.png -> icon128.png."""
    new_content, count = RE_ICON_48.subn(ICON_48_REPL, content)
    return new_content, count > 0


def fix_relative_icon(content):
    """Fix relative assets/icon128.png -> /assets/icon128.png."""
    new_content, count = RE_REL_ICON.subn(REL_ICON_REPL, content)
    return new_content, count > 0


def process_file(rel_path, stats):
    """Process a single HTML file."""
    file_path = PROJECT / rel_path
    if not file_path.exists():
        stats["errors"].append(f"NOT FOUND: {rel_path}")
        return

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        stats["errors"].append(f"READ ERROR {rel_path}: {e}")
        return

    original = content
    modified = False

    # TASK 1: Add i18n script (skip admin pages for i18n)
    if rel_path not in ADMIN_PAGES:
        content, added = add_i18n_script(content)
        if added:
            stats["i18n_added"].append(rel_path)
            modified = True

    # TASK 2: Migrate nav/footer (only for specific pages, skip admin)
    if rel_path in MIGRATE_NAV_PAGES and rel_path not in ADMIN_PAGES:
        content, changed = fix_nav_legacy(content)
        if changed:
            stats["nav_migrated"].append(rel_path)
            modified = True

        content, changed = fix_footer_legacy(content)
        if changed:
            stats["footer_migrated"].append(rel_path)
            modified = True

        content, added = add_body_scripts(content)
        if added:
            stats["body_scripts"].append(rel_path)
            modified = True

        content, fixed = fix_icon_48(content)
        if fixed:
            stats["icon_48_fixed"].append(rel_path)
            modified = True

    # TASK 3: Fix relative icon paths (global)
    content, fixed = fix_relative_icon(content)
    if fixed:
        stats["rel_icon_fixed"].append(rel_path)
        modified = True

    # Write if modified
    if modified:
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            stats["files_modified"] += 1
        except Exception as e:
            stats["errors"].append(f"WRITE ERROR {rel_path}: {e}")


def main():
    stats = {
        "i18n_added": [],
        "nav_migrated": [],
        "footer_migrated": [],
        "body_scripts": [],
        "icon_48_fixed": [],
        "rel_icon_fixed": [],
        "errors": [],
        "files_modified": 0
    }

    # TASK 1: Load need_i18n list and process
    need_i18n = load_need_i18n_list()
    print(f"[*] Loaded {len(need_i18n)} pages needing i18n")

    for rel_path in need_i18n:
        process_file(rel_path, stats)

    # TASK 3: Scan ALL HTML files for relative icon paths
    print("[*] Scanning for relative icon128.png paths...")
    for html_file in PROJECT.rglob("*.html"):
        rel_path = str(html_file.relative_to(PROJECT))
        # Skip if already processed (to avoid double counting)
        if rel_path not in need_i18n:
            process_file(rel_path, stats)

    # Report
    print("\n" + "=" * 60)
    print("REPORT")
    print("=" * 60)
    print(f"Files modified: {stats['files_modified']}")
    print(f"\n[TASK 1] i18n scripts added: {len(stats['i18n_added'])}")
    for f in stats['i18n_added']:
        print(f"  + {f}")

    print(f"\n[TASK 2] Nav migrated: {len(stats['nav_migrated'])}")
    for f in stats['nav_migrated']:
        print(f"  ~ {f}")

    print(f"\n[TASK 2] Footer migrated: {len(stats['footer_migrated'])}")
    for f in stats['footer_migrated']:
        print(f"  ~ {f}")

    print(f"\n[TASK 2] Body scripts added: {len(stats['body_scripts'])}")
    for f in stats['body_scripts']:
        print(f"  + {f}")

    print(f"\n[TASK 3] icon-48.png -> icon128.png: {len(stats['icon_48_fixed'])}")
    for f in stats['icon_48_fixed']:
        print(f"  ~ {f}")

    print(f"\n[TASK 3] Relative icon paths fixed: {len(stats['rel_icon_fixed'])}")
    for f in stats['rel_icon_fixed']:
        print(f"  ~ {f}")

    if stats['errors']:
        print(f"\n[!] ERRORS: {len(stats['errors'])}")
        for e in stats['errors']:
            print(f"  ! {e}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
