#!/usr/bin/env python3
"""
Mock n8n webhook server for testing the test harness.
Simulates workflow responses without hitting actual Gemini API.
"""

from flask import Flask, request, jsonify
import json
import re
import os
from datetime import datetime

app = Flask(__name__)

# Mock responses database
MOCK_RESPONSES = {}

# Brand blacklist (same as test harness)
FORBIDDEN_BRANDS = {
    "youtube", "google", "facebook", "instagram", "tiktok",
    "twitter", "x", "amazon", "reddit", "twitch", "github", "linkedin"
}
FORBIDDEN_PATTERNS = [
    r"149\s*(KB|K B|kilobyte|kilobytes|kb)",
]

def check_brand_leak(text: str):
    """Check for brand leaks in text."""
    if not text:
        return False
    text_lower = str(text).lower()
    for brand in FORBIDDEN_BRANDS:
        pattern = r"\b" + re.escape(brand) + r"\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
            return True
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            return True
    return False

def generate_mock_caption(payload: dict) -> dict:
    """Generate mock caption response."""
    concept = payload.get("concept", "")
    langs = payload.get("langs", ["it"])
    platforms = payload.get("platforms", ["instagram"])

    # Check for prompt injection attempts
    if check_brand_leak(concept):
        return {
            "ok": False,
            "reason": "brand_leak",
            "preview": concept[:200],
            "tokens_in": 50,
            "tokens_out": 0,
            "parsed": {},
        }

    parsed = {
        "caption": f"Blocca la pubblicità invasiva con AdOff. Video puliti, navigazione veloce, privacy garantita. Ads? Off! Trial gratis 15 giorni.",
        "hashtags": ["#adoff", "#noadvertisements", "#privacyfirst", "#browserplugin"],
        "cta": "Prova AdOff gratis",
    }

    return {
        "ok": True,
        "parsed": parsed,
        "tokens_in": 150,
        "tokens_out": 85,
    }

def generate_mock_email_ad_landing(payload: dict) -> dict:
    """Generate mock email/ad/landing response."""
    concept = payload.get("concept", "")
    asset_types = payload.get("asset_types", [])

    # Check for prompt injection
    if check_brand_leak(concept):
        return {
            "ok": False,
            "reason": "brand_leak",
            "preview": concept[:200],
            "tokens_in": 100,
            "tokens_out": 0,
        }

    parsed = {}

    if "email_drip" in asset_types:
        parsed.update({
            "subject": "Benvenuto in AdOff — Trial Pro gratis",
            "preheader": "15 giorni senza pubblicità invasive",
            "body_markdown": "Caro utente,\n\nBenvenuto in AdOff. La tua trial è attiva: 15 giorni di accesso Pro su 3 dispositivi.\n\n[CTA: Inizia ora]",
            "cta_text": "Inizia trial",
            "cta_url": "https://adoff.app",
        })

    if "ad_copy" in asset_types:
        parsed.update({
            "headlines": [
                "Blocca gli annunci invasivi",
                "Naviga senza distrazioni",
                "Privacy garantita",
            ],
            "descriptions": [
                "AdOff blocca la pubblicità su tutti i siti. Trial 15 giorni gratis.",
                "Estensione browser leggera e veloce. Funziona su Chrome, Firefox, Safari.",
            ],
            "primary_text": "Stanco della pubblicità? AdOff ti libera dai banner invasivi, pop-up e video ads. Video puliti, velocità +50%.",
            "cta_label": "Prova gratis",
        })

    if "landing_section" in asset_types:
        parsed.update({
            "section": payload.get("landing_section", "hero"),
            "eyebrow": "Soluzione ad-free",
            "headline": "Naviga senza pubblicità invasiva",
            "subheadline": "AdOff blocca annunci, tracker e pop-up. Veloce, privato, gratis.",
            "bullets": [
                "Blocca 130+ reti pubblicitarie",
                "Zero tracciamento personale",
                "Disponibile su tutti i browser",
            ],
            "body_paragraphs": [
                "La pubblicità online è diventata invasiva e rallenta il tuo browsing. AdOff interviene bloccando le richieste pubblicitarie prima che vengano caricate, per un'esperienza pulita e veloce.",
            ],
            "cta_primary": "Prova 15 giorni gratis",
            "cta_secondary": "Scopri di più",
        })

    return {
        "ok": True,
        "parsed": parsed,
        "tokens_in": 200,
        "tokens_out": 120,
    }

def generate_mock_strategy(payload: dict) -> dict:
    """Generate mock strategy/calendar response."""
    goal = payload.get("goal", "")
    lang = payload.get("lang", "it")

    # Check for prompt injection
    if check_brand_leak(goal):
        return {
            "ok": False,
            "reason": "brand_leak",
            "preview": goal[:200],
            "tokens_in": 250,
            "tokens_out": 0,
        }

    calendar = []
    for day in range(1, 31):
        calendar.append({
            "day": day,
            "channel": ["organic_social", "community", "content_seo"][day % 3],
            "asset_type": ["post", "email", "article"][day % 3],
            "theme": f"Day {day}: Privacy leadership",
            "hook": "Utenti stanchi della pubblicità invasiva",
            "copy_brief": "Leva la frustrazione, proponi la soluzione AdOff",
        })

    parsed = {
        "executive_summary": "Piano di crescita 30gg: 50% aumento download attraverso community organica e SEO.",
        "positioning_one_liner": "AdOff: 'Ads? Off!' — estensione browser che blocca pubblicità invasiva.",
        "target_personas": [
            {"name": "Tech-savvy Marco", "demographic": "35-45, IT, senior", "pain": "Pubblicità invasiva", "hook": "Controllo totale"},
            {"name": "Privacy-conscious Sara", "demographic": "25-35, EU, awareness", "pain": "Tracciamento", "hook": "Anonimato"},
        ],
        "channels": [
            {"name": "Organic Social", "why": "Reach gratuito", "weekly_actions": ["3x post", "1x community reply"], "kpis": ["reach", "engagement"]},
            {"name": "Content SEO", "why": "Traffico organico", "weekly_actions": ["1x blog post"], "kpis": ["ranking", "traffic"]},
        ],
        "calendar": calendar,
        "success_metrics": ["50% download increase", "1000 trial conversions", "500 paid upgrades"],
        "risks": ["Competitor activity", "API rate limits", "Low budget for paid ads"],
    }

    return {
        "ok": True,
        "parsed": parsed,
        "tokens_in": 300,
        "tokens_out": 800,
    }

def generate_mock_seo(payload: dict) -> dict:
    """Generate mock SEO response."""
    seeds = payload.get("seeds", [])

    # Check for brand leaks in seeds
    for seed in seeds:
        if check_brand_leak(seed):
            return {
                "ok": False,
                "reason": "brand_leak",
                "preview": seed[:200],
                "tokens_in": 100,
                "tokens_out": 0,
            }

    seed = seeds[0] if seeds else "ad blocker"

    parsed = {
        "main_keyword": "blocca pubblicità browser",
        "search_intent": "informational",
        "monthly_volume_estimate": "high",
        "difficulty_estimate": "medium",
        "long_tail_variants": [
            "blocca pubblicità chrome extension",
            "migliore ad blocker firefox",
            "estensione blocca annunci",
            "bloccare pubblicità fastidiose",
            "ad blocker gratis multilingua",
            "estensione privacy blocca tracker",
            "come togliere annunci online",
            "ad blocker legale sicuro",
        ],
        "related_questions": [
            "Come bloccare la pubblicità su Chrome?",
            "Quale è il miglior ad blocker?",
            "È legale usare un ad blocker?",
            "AdBlock è malware?",
        ],
        "topic_cluster": {
            "pillar": "Guida completa ad blocker",
            "supporting_topics": [
                "Come funzionano gli ad blocker",
                "Differenza tra bloccare e nascondere ads",
                "Privacy implications",
                "Performance impact",
            ],
        },
        "content_brief": {
            "h1": "Guida definitiva agli ad blocker: come bloccare la pubblicità online",
            "proposed_h2s": [
                "Cosa è un ad blocker?",
                "Come scegliere l'ad blocker giusto",
                "AdOff vs altri ad blocker",
                "Installazione e configurazione",
                "FAQ legittimità",
            ],
            "key_points": [
                "La pubblicità online è invasiva",
                "Gli ad blocker migliorano performance",
                "Privacy è un diritto",
                "Scelta consapevole dell'utente",
            ],
            "word_count_target": 1500,
            "internal_links_to": ["/pricing", "/features", "/blog/privacy"],
        },
        "meta": {
            "title": "Blocca Pubblicità Online | Guida AdOff",
            "description": "Scopri come bloccare la pubblicità invasiva con AdOff. Estensione browser gratuita, sicura, multilingua. Trial 15 giorni.",
            "slug": "guida-bloccare-pubblicita-online",
        },
    }

    return {
        "ok": True,
        "parsed": parsed,
        "tokens_in": 200,
        "tokens_out": 600,
    }

# ============================================================================
# WEBHOOK ROUTES
# ============================================================================

@app.route("/webhook/gemini-copywriter-caption", methods=["POST"])
def webhook_caption():
    payload = request.json or request.form.to_dict()
    response = generate_mock_caption(payload)
    return jsonify(response), 200

@app.route("/webhook/gemini-long-copy", methods=["POST"])
def webhook_email_ad_landing():
    payload = request.json or request.form.to_dict()
    response = generate_mock_email_ad_landing(payload)
    return jsonify(response), 200

@app.route("/webhook/gemini-strategy", methods=["POST"])
def webhook_strategy():
    payload = request.json or request.form.to_dict()
    response = generate_mock_strategy(payload)
    return jsonify(response), 200

@app.route("/webhook/gemini-seo", methods=["POST"])
def webhook_seo():
    payload = request.json or request.form.to_dict()
    response = generate_mock_seo(payload)
    return jsonify(response), 200

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()}), 200

if __name__ == "__main__":
    port = int(os.environ.get("MOCK_PORT", "5679"))
    print(f"Mock n8n webhook server starting on http://localhost:{port}")
    print("Endpoints:")
    print("  POST /webhook/gemini-copywriter-caption")
    print("  POST /webhook/gemini-long-copy")
    print("  POST /webhook/gemini-strategy")
    print("  POST /webhook/gemini-seo")
    print("  GET  /health")
    print("\nTo test with test harness:")
    print(f"  N8N_BASE_URL=http://localhost:{port} python3 run_tests.py")
    print("\nTo stop: Ctrl+C")

    app.run(host="0.0.0.0", port=port, debug=False)
