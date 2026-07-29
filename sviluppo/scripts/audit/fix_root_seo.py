#!/usr/bin/env python3
"""Fix SEO metadata for root-level HTML pages."""
import re, sys, os
from pathlib import Path

BASE = Path("/mnt/backup/Dropbox/1 Programmazione/Progetti/ChromePlugin/site")
OG_IMAGE = "https://adoff.app/assets/og-image.png"

# Pagine con lingua inglese (canonical English pages)
ENGLISH_PAGES = {
    "premium.html", "vpn-policy.html", "community.html", "press.html",
    "how-it-works.html", "unique-tech.html", "best-ad-blocker-2026.html",
    "about.html", "adblock-detector.html", "android.html", "android-dns.html",
    "android-ad-blocker.html", "free-ad-blocker.html", "manifest-v3-ad-blocker.html",
    "ublock-origin-alternative.html", "undetectable-ad-blocker.html",
    "block-video-ads.html", "bypass-anti-adblock.html", "accessibility.html",
    "install.html", "guide.html", "license-guide.html",
}

# Pagine che sono nella root ma hanno URL /account/ /blog/ /vs/
# canonical deve usare il percorso corretto
SPECIAL_URLS = {
    "account/index.html": "https://adoff.app/account/",
    "account.html": "https://adoff.app/account/",
    "mgmt-9f4a/index.html": "https://adoff.app/mgmt-9f4a/",
    "blog/annuncio-lancio-adblock-vpn.html": "https://adoff.app/blog/annuncio-lancio-adblock-vpn",
    "blog/index.html": "https://adoff.app/blog/",
    "vs/index.html": "https://adoff.app/vs/",
}

# META DESCRIPTIONS (manually crafted per page)
DESCRIPTIONS = {
    "404.html": "Page not found — AdOff",
    "about.html": "About AdOff — Built by one person in Sicily, for everyone who hates being the ATM of the internet. No acceptable ads, full privacy.",
    "accessibility.html": "AdOff Accessibility Statement — Our commitment to making the ad blocker usable by everyone, following WCAG 2.2 AA guidelines.",
    "account/index.html": "Manage your AdOff account — view license, change plan, cancel subscription, update payment method.",
    "account.html": "Manage your AdOff account — view license, change plan, cancel subscription, update payment method.",
    "adblock-detector.html": "How AdOff defeats anti-adblock walls — Stealth Mode browser spoofing, bait simulation, and fetch/XHR interception explained.",
    "admin-console.html": "AdOff Admin Console — License management, statistics, and support dashboard.",
    "affiliati.html": "AdOff Affiliati — Guadagna commissioni promuovendo AdOff. 30% ricorrente, pagamenti mensili PayPal o crypto.",
    "android-ad-blocker.html": "AdBlock for Android — AdOff works on Firefox for Android with full ad blocking. Safari Content Blockers on iPhone.",
    "android-dns.html": "AdBlock via DNS for Android — Block ads at network level on Android without installing any app. Works on all browsers.",
    "android.html": "AdBlock for Android — AdOff on Firefox for Android. DNS-level blocking alternatives. No sideloading required.",
    "best-ad-blocker-2026.html": "Best Ad Blocker 2026 — AdOff wins on price, stealth anti-detection, and no \"acceptable ads\". 144 rules, 15-day free trial.",
    "block-video-ads.html": "Block Video Ads — AdOff neutralizes video ads at the source with IMA SDK stub replacement. No pre-roll, no mid-roll.",
    "blog/annuncio-lancio-adblock-vpn.html": "Annuncio: AdOff lancia la VPN — Protezione privacy senza log, P2P consentito, server in 5 Paesi. A soli €4,99/mese.",
    "blog/index.html": "AdOff Blog — News, updates, and guides about ad blocking and online privacy.",
    "bypass-anti-adblock.html": "Bypass Anti-Adblock Walls — How AdOff's Stealth Mode spoofs browser environment to defeat anti-adblock detection systems.",
    "chi-sono.html": "Chi sono — Eros, 50 anni, Siracusa. Ex negoziante di informatica, ora produttore di serrature e sviluppatore di AdOff.",
    "community.html": "AdOff Community — Join the AdOff community: Telegram channel, feedback, feature requests, and support from the developer.",
    "free-ad-blocker.html": "Free Ad Blocker for Chrome, Firefox, Edge, Opera and Brave — AdOff blocks ads and defeats anti-adblock walls. 100% free, no account needed.",
    "guide.html": "AdOff User Guide — Complete reference for installing, configuring, and troubleshooting AdOff. Covers all browsers and features.",
    "how-it-works.html": "How AdOff Works — Four layers of ad blocking: network rules, CSS filtering, IMA SDK stub, and Stealth anti-detection.",
    "install.html": "Install AdOff — Download and install AdOff for Chrome, Firefox, Edge, Opera and Brave. Free 15-day Pro trial included.",
    "license-guide.html": "AdOff License Guide — Compare Pro and Premium plans. 15-day free trial. No card required. Cancel anytime.",
    "manifest-v3-ad-blocker.html": "Manifest V3 and Ad Blockers — MV3 changes how Chrome extensions work. AdOff is built MV3-native, staying fast and reliable.",
    "mgmt-9f4a/index.html": "AdOff Management — License and statistics dashboard.",
    "panel.html": "AdOff Partner Panel — Affiliate dashboard with commissions, referrals, and payout history.",
    "press.html": "AdOff Press Kit — Logos, screenshots, statistics, and media resources for journalists and reviewers.",
    "premium.html": "AdOff Premium — AdBlock + VPN from €4.99/month. No logs, P2P allowed, servers in 5 countries. 15-day free trial.",
    "privacy.html": "AdOff Privacy Policy — We collect almost nothing. No tracking, no logs, no third-party analytics. Your data stays on your device.",
    "salesletter.html": "AdOff — The ad blocker that actually works. Blocks video ads, defeats anti-adblock walls, works on every browser. 15-day free trial.",
    "success.html": "Purchase Successful — Thank you for supporting AdOff. Your license is now active.",
    "support.html": "AdOff Support — Get help with installation, configuration, licensing, and troubleshooting. Average response: under 2 hours.",
    "terms.html": "AdOff Terms of Service — Legal terms for using AdOff browser extension and related services.",
    "ublock-origin-alternative.html": "uBlock Origin Alternative — AdOff offers deeper video ad blocking, Stealth Mode, and a modern MV3-native codebase.",
    "undetectable-ad-blocker.html": "Undetectable Ad Blocker — AdOff's Stealth Mode makes it invisible to anti-adblock detection systems used by YouTube and news sites.",
    "uninstall.html": "Uninstall AdOff — How to remove AdOff from Chrome, Firefox, Edge, Opera and Brave. Simple step-by-step guide.",
    "unique-tech.html": "AdOff Unique Technology — IMA SDK stub replacement, Stealth Mode browser spoofing, and bait element simulation explained.",
    "vpn-policy.html": "AdOff VPN Policy — Explicit no-log policy for Premium VPN. No browsing history, no IP addresses, no traffic logs, no data volume.",
    "vs/adblock.html": "AdBlock vs AdOff — AdOff is cheaper, has Stealth anti-detection, and doesn't sell Acceptable Ads. Same browser coverage.",
    "vs/adguard.html": "AdGuard vs AdOff — AdOff is cheaper, has Stealth Mode for anti-adblock walls, and no \"acceptable ads\".",
    "vs/brave.html": "Brave vs AdOff — AdOff works on any browser (Chrome, Firefox, Edge) while Brave Shields are browser-locked. AdOff has deeper video ad blocking.",
    "vs/cyberghost.html": "CyberGhost vs AdOff — AdOff blocks ads in-browser while CyberGhost VPN doesn't. Stack both for complete ad + tracker blocking.",
    "vs/expressvpn.html": "ExpressVPN vs AdOff — AdOff blocks ads at the browser level while ExpressVPN focuses on network privacy. Use both for full coverage.",
    "vs/ghostery.html": "Ghostery vs AdOff — AdOff is cheaper, has Stealth anti-detection, and doesn't monetize with Acceptable Ads like Ghostery.",
    "vs/index.html": "AdBlocker Comparisons — See how AdOff stacks up against uBlock Origin, AdGuard, Brave, Ghostery, NordVPN, and more.",
    "vs/nordvpn.html": "NordVPN vs AdOff — AdOff blocks ads in-browser while NordVPN focuses on network VPN. Use both for complete protection.",
    "vs/privacyspy.html": "PrivacySpy vs AdOff — PrivacySpy rates privacy policies. AdOff practices what it preaches: no tracking, no logs, open source.",
    "vs/protonvpn.html": "ProtonVPN vs AdOff — AdOff blocks ads at the browser level while ProtonVPN provides network VPN. AdOff + ProtonVPN = complete stack.",
    "vs/ublock-origin.html": "uBlock Origin vs AdOff — AdOff has IMA SDK video ad stub and Stealth Mode for anti-adblock walls. uBlock Origin is free and open source.",
    "withdrawal.html": "AdOff Withdrawal Request — Request a full refund within 30 days of purchase. No questions asked.",
}

# OG titles (EN)
OG_TITLES = {
    "about.html": "About AdOff — One person, built in public",
    "accessibility.html": "Accessibility — AdOff Ad Blocker",
    "adblock-detector.html": "How AdOff Defeats Anti-Adblock Walls",
    "android-ad-blocker.html": "AdBlock for Android — AdOff Browser Extension",
    "android-dns.html": "AdBlock via DNS for Android — AdOff",
    "android.html": "AdBlock for Android — AdOff",
    "best-ad-blocker-2026.html": "Best Ad Blocker 2026 — AdOff",
    "block-video-ads.html": "Block Video Ads — AdOff",
    "bypass-anti-adblock.html": "Bypass Anti-Adblock Walls — AdOff Stealth Mode",
    "community.html": "Community — AdOff",
    "free-ad-blocker.html": "Free Ad Blocker — AdOff for Chrome, Firefox, Edge, Opera, Brave",
    "guide.html": "User Guide — AdOff Ad Blocker",
    "how-it-works.html": "How It Works — AdOff Ad Blocker",
    "install.html": "Install AdOff — Free Ad Blocker",
    "license-guide.html": "License Guide — AdOff Pro & Premium",
    "manifest-v3-ad-blocker.html": "Manifest V3 and Ad Blockers — AdOff",
    "premium.html": "AdOff Premium — AdBlock + VPN from €4.99/month",
    "press.html": "Press Kit — AdOff",
    "privacy.html": "Privacy Policy — AdOff",
    "ublock-origin-alternative.html": "uBlock Origin Alternative — AdOff",
    "undetectable-ad-blocker.html": "Undetectable Ad Blocker — AdOff Stealth Mode",
    "unique-tech.html": "Unique Technology — AdOff",
    "vpn-policy.html": "VPN Policy — AdOff Premium",
    "vs/adblock.html": "AdBlock vs AdOff",
    "vs/adguard.html": "AdGuard vs AdOff",
    "vs/brave.html": "Brave vs AdOff",
    "vs/cyberghost.html": "CyberGhost vs AdOff",
    "vs/expressvpn.html": "ExpressVPN vs AdOff",
    "vs/ghostery.html": "Ghostery vs AdOff",
    "vs/index.html": "AdBlocker Comparisons — AdOff vs Alternatives",
    "vs/nordvpn.html": "NordVPN vs AdOff",
    "vs/privacyspy.html": "PrivacySpy vs AdOff",
    "vs/protonvpn.html": "ProtonVPN vs AdOff",
    "vs/ublock-origin.html": "uBlock Origin vs AdOff",
}

# OG descriptions (EN)
OG_DESCRIPTIONS = {
    "about.html": "Built by one person in Sicily. No acceptable ads, no tracking, full privacy.",
    "accessibility.html": "AdOff follows WCAG 2.2 AA accessibility guidelines. Built for everyone.",
    "adblock-detector.html": "Stealth Mode spoofs browser environment to bypass anti-adblock detection.",
    "android-ad-blocker.html": "AdOff works on Firefox for Android with full ad blocking. Safari on iPhone via Content Blockers.",
    "android-dns.html": "Block ads on Android at network level using DNS. Works on all browsers, no app needed.",
    "android.html": "AdOff works on Firefox for Android. DNS-level blocking on all Android browsers.",
    "best-ad-blocker-2026.html": "AdOff wins on price, stealth anti-detection, and no acceptable ads. 15-day free trial.",
    "block-video-ads.html": "IMA SDK stub replacement neutralizes video ads at the source. No pre-roll, no mid-roll.",
    "bypass-anti-adblock.html": "AdOff Stealth Mode makes the extension invisible to anti-adblock detection systems.",
    "community.html": "Join the AdOff community on Telegram. News, support, and feature requests.",
    "free-ad-blocker.html": "100% free ad blocker for Chrome, Firefox, Edge, Opera and Brave. No account needed.",
    "guide.html": "Complete installation, configuration and troubleshooting guide for AdOff.",
    "how-it-works.html": "Four layers: network blocking, CSS filtering, IMA SDK stub, and Stealth anti-detection.",
    "install.html": "Install AdOff for Chrome, Firefox, Edge, Opera and Brave. Free 15-day Pro trial.",
    "license-guide.html": "Pro from €2.99/month. Premium (AdBlock+VPN) from €4.99/month. 15-day free trial.",
    "manifest-v3-ad-blocker.html": "AdOff is built MV3-native, staying fast and reliable under Chrome's new extension model.",
    "premium.html": "AdBlock + VPN from €4.99/month. No logs, P2P allowed, servers in 5 countries.",
    "press.html": "Press kit, logos, screenshots and statistics for journalists and reviewers.",
    "privacy.html": "We collect almost nothing. No tracking, no logs, no third-party analytics.",
    "ublock-origin-alternative.html": "AdOff has IMA SDK video ad stub and Stealth anti-detection. Free trial.",
    "undetectable-ad-blocker.html": "AdOff's Stealth Mode is invisible to YouTube and news site anti-adblock walls.",
    "unique-tech.html": "IMA SDK stub replacement, Stealth Mode browser spoofing, bait simulation — explained.",
    "vpn-policy.html": "Explicit no-log VPN: no browsing history, no IP addresses, no traffic logs, no data volume.",
    "vs/adblock.html": "AdOff is cheaper, has Stealth anti-detection, and doesn't sell Acceptable Ads.",
    "vs/adguard.html": "AdOff is cheaper with Stealth Mode for anti-adblock walls. No acceptable ads.",
    "vs/brave.html": "AdOff works on any browser while Brave Shields are locked to Brave. Deeper video blocking.",
    "vs/cyberghost.html": "AdOff blocks ads in-browser while CyberGhost VPN doesn't. Stack both for full coverage.",
    "vs/expressvpn.html": "AdOff blocks ads at browser level. ExpressVPN provides network privacy. Use both.",
    "vs/ghostery.html": "AdOff is cheaper, has Stealth anti-detection, and doesn't monetize with Acceptable Ads.",
    "vs/index.html": "See how AdOff compares to uBlock Origin, AdGuard, Brave, Ghostery, NordVPN and more.",
    "vs/nordvpn.html": "AdOff blocks browser ads while NordVPN provides network VPN. Complete protection stacked.",
    "vs/privacyspy.html": "PrivacySpy rates policies. AdOff practices what it preaches: no tracking, no logs.",
    "vs/protonvpn.html": "AdOff blocks browser ads while ProtonVPN provides network VPN. Best stacked together.",
    "vs/ublock-origin.html": "AdOff has IMA SDK video ad stub and Stealth Mode for anti-adblock walls.",
}


def get_canonical_url(rel_path: str) -> str:
    """Get the canonical URL for a page."""
    if rel_path in SPECIAL_URLS:
        return SPECIAL_URLS[rel_path]
    # Default: https://adoff.app/{filename without .html}
    name = rel_path.replace(".html", "")
    # blog/ and vs/ subdirectories
    return f"https://adoff.app/{name}"


def has_tag(html: str, pattern: str) -> bool:
    """Check if a tag matching the pattern already exists."""
    return bool(re.search(pattern, html, re.IGNORECASE))


def fix_file(filepath: Path) -> bool:
    rel = str(filepath.relative_to(BASE))
    content = filepath.read_text(encoding="utf-8")
    original = content

    # Skip 404.html for canonical
    is_404 = rel == "404.html"

    canonical_url = get_canonical_url(rel)

    # 1. Add <meta name="description"> if missing
    if not has_tag(content, r'<meta\s+name=["\']description["\']'):
        # Find the <title> tag and insert description after it
        title_match = re.search(r'(<title>[^<]*</title>)', content, re.IGNORECASE)
        if title_match:
            desc = DESCRIPTIONS.get(rel, f"AdOff — {rel}")
            insert = f'\n  <meta name="description" content="{desc}" />'
            content = content.replace(title_match.group(1), title_match.group(1) + insert)

    # 2. Add <link rel="canonical"> if missing (skip 404)
    if not is_404 and not has_tag(content, r'<link\s+rel=["\']canonical["\']'):
        # Find the last <link rel="alternate"> or insert after description
        alt_match = re.search(r'(<link\s+rel=["\']alternate["\'][^>]*>)', content)
        if alt_match:
            insert = f'\n  <link rel="canonical" href="{canonical_url}" />'
            content = content.replace(alt_match.group(1), alt_match.group(1) + insert)

    # 3. Add og:title if missing
    if not has_tag(content, r'<meta\s+property=["\']og:title["\']'):
        title_match = re.search(r'<meta\s+property=["\']og:type["\']', content)
        if title_match:
            og_t = OG_TITLES.get(rel, "")
            if og_t:
                insert = f'\n  <meta property="og:title" content="{og_t}" />'
                content = content.replace(title_match.group(0), insert + '\n  ' + title_match.group(0))

    # 4. Add og:description if missing
    if not has_tag(content, r'<meta\s+property=["\']og:description["\']'):
        title_match = re.search(r'<meta\s+property=["\']og:type["\']', content)
        if title_match:
            og_d = OG_DESCRIPTIONS.get(rel, "")
            if og_d:
                insert = f'\n  <meta property="og:description" content="{og_d}" />'
                content = content.replace(title_match.group(0), insert + '\n  ' + title_match.group(0))

    # 5. Add og:image if missing (only if og:url exists but og:image doesn't)
    if not has_tag(content, r'<meta\s+property=["\']og:image["\']'):
        title_match = re.search(r'<meta\s+property=["\']og:type["\']', content)
        if title_match:
            insert = f'\n  <meta property="og:image" content="{OG_IMAGE}" />'
            content = content.replace(title_match.group(0), insert + '\n  ' + title_match.group(0))

    if content != original:
        filepath.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    pages = [
        "404.html", "about.html", "accessibility.html", "account.html", "account/index.html",
        "adblock-detector.html", "admin-console.html", "affiliati.html",
        "android-ad-blocker.html", "android-dns.html", "android.html",
        "best-ad-blocker-2026.html", "block-video-ads.html",
        "blog/annuncio-lancio-adblock-vpn.html", "blog/index.html",
        "bypass-anti-adblock.html", "chi-sono.html", "community.html",
        "free-ad-blocker.html", "guide.html", "how-it-works.html",
        "install.html", "license-guide.html", "manifest-v3-ad-blocker.html",
        "mgmt-9f4a/index.html", "panel.html", "press.html",
        "premium.html", "privacy.html", "salesletter.html", "success.html",
        "support.html", "terms.html", "ublock-origin-alternative.html",
        "undetectable-ad-blocker.html", "uninstall.html", "unique-tech.html",
        "vpn-policy.html", "vs/adblock.html", "vs/adguard.html", "vs/brave.html",
        "vs/cyberghost.html", "vs/expressvpn.html", "vs/ghostery.html",
        "vs/index.html", "vs/nordvpn.html", "vs/privacyspy.html",
        "vs/protonvpn.html", "vs/ublock-origin.html", "withdrawal.html",
    ]

    changed = 0
    for page in pages:
        fp = BASE / page
        if not fp.exists():
            print(f"SKIP (not found): {page}")
            continue
        ok = fix_file(fp)
        if ok:
            print(f"OK: {page}")
            changed += 1
        else:
            print(f"NOCHANGE: {page}")

    print(f"\nTotal changed: {changed}/{len(pages)}")


if __name__ == "__main__":
    main()
