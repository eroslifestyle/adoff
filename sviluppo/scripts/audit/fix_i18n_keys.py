#!/usr/bin/env python3
"""
Fix i18n keys for AdOff site.

Tasks:
1. Add 4 footer keys (footer.tagline, footer.premium, footer.blog, footer.vs.all) to all 15 langs
2. Add 12 nav keys to all 15 langs
3. Fill empty about.* keys in it.json with EN source text from HTML
4. Fill empty pricing.free.f6/f8 in ru.json with RU translations

Style: preserve existing file formatting (indent 2, sorted, ensure_ascii=False).
"""

import json, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# audit/ → scripts/ → sviluppo/ → ChromePlugin/ (= project root, 3 ../)
BASE = os.path.join(SCRIPT_DIR, "..", "..", "..", "site", "i18n")
LANGS = ["it","en","de","fr","es","pt","ru","ar","zh","tr","pl","hi","ja","ko","id"]

# ── Footer keys (4) ────────────────────────────────────────────────────────────
# tagline: brand claim — stays English in most languages (international brand)
# premium/blog/vs.all: short, same in many languages
FOOTER = {
    "footer.tagline": {
        "it": "Ads? Off!",
        "en": "Ads? Off!",
        "de": "Ads? Off!",
        "fr": "Ads? Off!",
        "es": "Ads? Off!",
        "pt": "Ads? Off!",
        "ru": "Ads? Off!",
        "ar": "Ads? Off!",
        "zh": "Ads? Off!",
        "tr": "Ads? Off!",
        "pl": "Ads? Off!",
        "hi": "Ads? Off!",
        "ja": "Ads? Off!",
        "ko": "Ads? Off!",
        "id": "Ads? Off!",
    },
    "footer.premium": {
        "it": "VPN Premium",
        "en": "Premium VPN",
        "de": "Premium VPN",
        "fr": "VPN Premium",
        "es": "VPN Premium",
        "pt": "VPN Premium",
        "ru": "VPN Premium",
        "ar": "VPN Premium",
        "zh": "Premium VPN",
        "tr": "Premium VPN",
        "pl": "VPN Premium",
        "hi": "Premium VPN",
        "ja": "プレミアムVPN",
        "ko": "프리미엄 VPN",
        "id": "VPN Premium",
    },
    "footer.blog": {
        "it": "Blog",
        "en": "Blog",
        "de": "Blog",
        "fr": "Blog",
        "es": "Blog",
        "pt": "Blog",
        "ru": "Блог",
        "ar": "مدونة",
        "zh": "博客",
        "tr": "Blog",
        "pl": "Blog",
        "hi": "ब्लॉग",
        "ja": "ブログ",
        "ko": "블로그",
        "id": "Blog",
    },
    "footer.vs.all": {
        "it": "Tutti i confronti",
        "en": "All comparisons",
        "de": "Alle Vergleiche",
        "fr": "Toutes les comparaisons",
        "es": "Todas las comparaciones",
        "pt": "Todas as comparações",
        "ru": "Все сравнения",
        "ar": "جميع المقارنات",
        "zh": "所有对比",
        "tr": "Tüm Karşılaştırmalar",
        "pl": "Wszystkie porównania",
        "hi": "सभी तुलनाएँ",
        "ja": "すべての比較",
        "ko": "모든 비교",
        "id": "Semua perbandingan",
    },
}

# ── Nav keys (12) ─────────────────────────────────────────────────────────────
NAV = {
    "nav.home": {
        "it": "Home",
        "en": "Home",
        "de": "Startseite",
        "fr": "Accueil",
        "es": "Inicio",
        "pt": "Início",
        "ru": "Главная",
        "ar": "الرئيسية",
        "zh": "首页",
        "tr": "Ana Sayfa",
        "pl": "Strona główna",
        "hi": "होम",
        "ja": "ホーム",
        "ko": "홈",
        "id": "Beranda",
    },
    "nav.features": {
        "it": "Funzionalità",
        "en": "Features",
        "de": "Funktionen",
        "fr": "Fonctionnalités",
        "es": "Funciones",
        "pt": "Recursos",
        "ru": "Функции",
        "ar": "المميزات",
        "zh": "功能",
        "tr": "Özellikler",
        "pl": "Funkcje",
        "hi": "सुविधाएँ",
        "ja": "機能",
        "ko": "기능",
        "id": "Fitur",
    },
    "nav.pricing": {
        "it": "Prezzi",
        "en": "Pricing",
        "de": "Preise",
        "fr": "Tarifs",
        "es": "Precios",
        "pt": "Preços",
        "ru": "Цены",
        "ar": "الأسعار",
        "zh": "价格",
        "tr": "Fiyatlandırma",
        "pl": "Ceny",
        "hi": "मूल्य",
        "ja": "価格",
        "ko": "가격",
        "id": "Harga",
    },
    "nav.premium": {
        "it": "Premium",
        "en": "Premium",
        "de": "Premium",
        "fr": "Premium",
        "es": "Premium",
        "pt": "Premium",
        "ru": "Premium",
        "ar": "بريميوم",
        "zh": "Premium",
        "tr": "Premium",
        "pl": "Premium",
        "hi": "प्रीमियम",
        "ja": "プレミアム",
        "ko": "프리미엄",
        "id": "Premium",
    },
    "nav.premiumVpn": {
        "it": "VPN Premium",
        "en": "Premium VPN",
        "de": "Premium VPN",
        "fr": "VPN Premium",
        "es": "VPN Premium",
        "pt": "VPN Premium",
        "ru": "VPN Premium",
        "ar": "VPN Premium",
        "zh": "Premium VPN",
        "tr": "Premium VPN",
        "pl": "VPN Premium",
        "hi": "Premium VPN",
        "ja": "プレミアムVPN",
        "ko": "프리미엄 VPN",
        "id": "VPN Premium",
    },
    "nav.vpnPolicy": {
        "it": "Politica VPN",
        "en": "VPN Policy",
        "de": "VPN-Richtlinie",
        "fr": "Politique VPN",
        "es": "Política de VPN",
        "pt": "Política de VPN",
        "ru": "Политика VPN",
        "ar": "سياسة VPN",
        "zh": "VPN政策",
        "tr": "VPN Politikası",
        "pl": "Polityka VPN",
        "hi": "VPN नीति",
        "ja": "VPNポリシー",
        "ko": "VPN 정책",
        "id": "Kebijakan VPN",
    },
    "nav.community": {
        "it": "Community",
        "en": "Community",
        "de": "Community",
        "fr": "Communauté",
        "es": "Comunidad",
        "pt": "Comunidade",
        "ru": "Сообщество",
        "ar": "المجتمع",
        "zh": "社区",
        "tr": "Topluluk",
        "pl": "Społeczność",
        "hi": "समुदाय",
        "ja": "コミュニティ",
        "ko": "커뮤니티",
        "id": "Komunitas",
    },
    "nav.support": {
        "it": "Supporto",
        "en": "Support",
        "de": "Support",
        "fr": "Support",
        "es": "Soporte",
        "pt": "Suporte",
        "ru": "Поддержка",
        "ar": "الدعم",
        "zh": "支持",
        "tr": "Destek",
        "pl": "Wsparcie",
        "hi": "सहायता",
        "ja": "サポート",
        "ko": "지원",
        "id": "Dukungan",
    },
    "nav.install": {
        "it": "Installa",
        "en": "Install",
        "de": "Installieren",
        "fr": "Installer",
        "es": "Instalar",
        "pt": "Instalar",
        "ru": "Установить",
        "ar": "تثبيت",
        "zh": "安装",
        "tr": "Kur",
        "pl": "Zainstaluj",
        "hi": "इंस्टॉल",
        "ja": "インストール",
        "ko": "설치",
        "id": "Instal",
    },
    "nav.guide": {
        "it": "Guida",
        "en": "Guide",
        "de": "Anleitung",
        "fr": "Guide",
        "es": "Guía",
        "pt": "Guia",
        "ru": "Руководство",
        "ar": "الدليل",
        "zh": "指南",
        "tr": "Kılavuz",
        "pl": "Przewodnik",
        "hi": "गाइड",
        "ja": "ガイド",
        "ko": "가이드",
        "id": "Panduan",
    },
    "nav.privacy": {
        "it": "Privacy",
        "en": "Privacy",
        "de": "Datenschutz",
        "fr": "Confidentialité",
        "es": "Privacidad",
        "pt": "Privacidade",
        "ru": "Конфиденциальность",
        "ar": "الخصوصية",
        "zh": "隐私",
        "tr": "Gizlilik",
        "pl": "Prywatność",
        "hi": "गोपनीयता",
        "ja": "プライバシー",
        "ko": "개인정보",
        "id": "Privasi",
    },
    "nav.cta": {
        "it": "Installa gratis",
        "en": "Install Free",
        "de": "Kostenlos installieren",
        "fr": "Installer gratuitement",
        "es": "Instalar gratis",
        "pt": "Instalar grátis",
        "ru": "Установить бесплатно",
        "ar": "تثبيت مجاني",
        "zh": "免费安装",
        "tr": "Ücretsiz kur",
        "pl": "Zainstaluj za darmo",
        "hi": "मुफ्त इंस्टॉल करें",
        "ja": "無料インストール",
        "ko": "무료 설치",
        "id": "Pasang Gratis",
    },
}

# ── About keys — fill empty values in it.json with EN source from HTML ────────
ABOUT_IT = {
    "about.about_sub.the_real_person_behind_adoff": "The real person behind AdOff",
    "about.main.about_me": "About me",
    "about.main.adoff_comes_from_something_i_cant": "AdOff comes from something I can't stand: <strong>being the ATM of the multinationals</strong>. Online you're watched, profiled, sold. Banners everywhere, videos that won't play, the feeling of being a product, not a person.",
    "about.main.bought_under_the_table": "<strong>No \"acceptable ads\"</strong> bought under the table.",
    "about.main.but_its_just_one_person": "\"But it's just one person?\"",
    "about.main.from_invasive_unethical_advertis": "<strong>Protecting people — and their kids</strong> — from invasive, unethical advertising.",
    "about.main.from_physical_locks_to_digital_priv": "<strong>Security is my trade:</strong> from physical locks to digital privacy.",
    "about.main.hi_im_im_50_from_ive_been": "Hi, I'm <strong>Eros</strong>, I'm 50, from <strong>Siracusa, Sicily</strong>. I've been a shopkeeper for over 30 years: I ran a computer store for 15 years, and today I run <strong>key and security shops</strong>. Really, I've spent my whole life doing one thing — protecting people and what they care about. But computers have always been my true passion.",
    "about.main.i_sell_locks_for_a_living_i_protec": "I sell locks for a living: I protect homes and shops from people who want to get in. <strong>AdOff is the same thing, but for your data.</strong> And one thing makes me angrier than all the rest: <strong>our kids</strong>, bombarded with obscene, unethical ads, profiled before they even understand what that means. I won't accept that.",
    "about.main.if_youre_tired_of_being_the_multin": "If you're tired of being the multinationals' ATM, try AdOff (it's free) and follow the journey.",
    "about.main.lets_do_this_together": "Let's do this together",
    "about.main.not_the_multinationals_youre_not": "<strong>On your side,</strong> not the multinationals'. You're not their ATM.",
    "about.main.one_day_i_thought_solo_with_ai_a": "One day I thought <em>let's see if I can</em>. Solo, with AI as my helper, I started building a blocker. Then the moment I won't forget: I opened a video and it played <strong>instantly</strong>. No ad. It worked — and that's when I knew it was more than an experiment.",
    "about.main.real_numbers_and_inspectable_code": "<strong>Honesty:</strong> real numbers and inspectable code.",
    "about.main.what_i_believe": "What I believe",
    "about.main.why_i_built_adoff": "Why I built AdOff",
    "about.main.yes_im_solo_no_budget_no_big_te": "Yes. I'm solo, no budget, no big team. But AdOff is a <strong>living</strong> project: I build it in public, update it constantly, and you can follow every step. No inflated promises — just real work. I want to prove one simple thing: that today, alone, <strong>you can</strong>.",
    "about.main.your_data_never_leaves_your_device": "<strong>Total privacy, zero logs:</strong> your data never leaves your device. No compromise here.",
}

# ── RU translations for empty pricing.free.f6 and f8 ─────────────────────────
RU_PRICING = {
    "pricing.free.f6": "Блокировка всплывающей рекламы и подменных окон",
    "pricing.free.f8": "Работает на всех сайтах",
}

# ── All keys to add (footer + nav) ───────────────────────────────────────────
NEW_KEYS = {}
for k, translations in {**FOOTER, **NAV}.items():
    for lang, value in translations.items():
        if lang not in NEW_KEYS:
            NEW_KEYS[lang] = {}
        NEW_KEYS[lang][k] = value


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def main():
    for lang in LANGS:
        path = os.path.join(BASE, f"{lang}.json")
        d = load_json(path)
        original_count = len(d)

        # 1. Add footer + nav keys
        if lang in NEW_KEYS:
            for k, v in NEW_KEYS[lang].items():
                if k not in d:
                    d[k] = v
                    print(f"  + {lang}: added {k}")

        # 2. Fill empty about.* keys in it.json
        if lang == "it":
            for k, v in ABOUT_IT.items():
                if k in d and (not d[k] or not d[k].strip()):
                    d[k] = v
                    print(f"  + it: filled empty {k}")

        # 3. Fill empty pricing.free keys in ru.json
        if lang == "ru":
            for k, v in RU_PRICING.items():
                if k in d and (not d[k] or not d[k].strip()):
                    d[k] = v
                    print(f"  + ru: filled empty {k}")

        save_json(path, d)
        new_count = len(d)
        print(f"  => {lang}: {original_count} -> {new_count} keys\n")

    print("Done.")


if __name__ == "__main__":
    main()
