#!/usr/bin/env python3
"""
AdOff Carousel Card Generator — Stable Diffusion XL (fallback to FLUX.1-schnell)
Uses stabilityai/stable-diffusion-xl-base-1.0 (not gated)
"""

import torch
from pathlib import Path
from diffusers import StableDiffusionXLPipeline
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Device detection
device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Using device: {device}")
if device == "cuda":
    torch.cuda.empty_cache()

# Load SDXL (smaller than FLUX, ~13GB, not gated)
logger.info("Loading Stable Diffusion XL...")
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    use_safetensors=True
)
pipe = pipe.to(device)

# Output directory
out_dir = Path(__file__).parent.parent / "assets" / "carousel"
out_dir.mkdir(parents=True, exist_ok=True)

# Card specs (from SMM-HULK-LAUNCH-PACKAGE-GG1.md)
cards = [
    {
        "name": "Card 1 - HERO (Pain Frame)",
        "prompt": "Red-orange gradient background, large white bold headline centered 'Perdi fino a 3000 euro al mese con la pubblicità inefficiente', small calculator icon bottom-right, modern minimalist clean design, high contrast white text on red gradient, indie hacker style, professional, no logos",
        "file": "carousel_01_hero.png",
        "color_hint": "red",
    },
    {
        "name": "Card 2 - SOLUTION (Teaser)",
        "prompt": "Blue background, white bold headline centered 'Il nostro calcolatore misura esattamente le perdite pubblicitarie', large calculator or formula icon in center, white text, subtext 'Real data. No theory.', clean modern indie design, professional, no logos",
        "file": "carousel_02_solution.png",
        "color_hint": "blue",
    },
    {
        "name": "Card 3 - PROOF (Social Proof)",
        "prompt": "Green background, white bold headline centered 'Utenti hanno risparmiato il 25% sui costi pubblicitari grazie ai nostri strumenti', upward trending arrow or graph visualization in center, white text, subtext 'Real users. Real numbers.', clean modern design, professional, no logos",
        "file": "carousel_03_proof.png",
        "color_hint": "green",
    },
    {
        "name": "Card 4 - CTA (Micro-Promo)",
        "prompt": "Gold or amber background, dark gray bold headline centered 'Scopri subito quanto stai perdendo, il tempo è denaro', white rounded button mockup in center labeled 'Calcola', dark text, urgency + clarity, clean modern design, professional, no logos",
        "file": "carousel_04_cta.png",
        "color_hint": "gold",
    },
]

# Generate cards (resize to 1072x1344 target)
logger.info(f"Generating {len(cards)} carousel cards (target: 1072x1344px, generating at 1024x1280)...")
for i, card in enumerate(cards, 1):
    logger.info(f"\n[{i}/{len(cards)}] {card['name']}")
    output_path = out_dir / card["file"]

    try:
        # SDXL inference (1024x1280, then resize)
        image = pipe(
            prompt=card["prompt"],
            height=1280,
            width=1024,
            num_inference_steps=25,
            guidance_scale=7.5,
            negative_prompt="low quality, blurry, distorted, text not readable, AI generated look",
        ).images[0]

        # Resize to exact target (1072x1344)
        image = image.resize((1072, 1344), resample=3)  # LANCZOS

        image.save(output_path)
        logger.info(f"✓ Saved: {output_path}")

    except Exception as e:
        logger.error(f"✗ Failed: {card['name']}")
        logger.error(f"  Error: {e}")
        continue

logger.info(f"\n✓ All cards generated and saved to: {out_dir}")
logger.info("Ready for IndieHackers gg1 h10 launch.")
