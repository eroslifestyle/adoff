#!/usr/bin/env python3
"""
AdOff Carousel Card Generator — FLUX.1-schnell with diffusers
Generates 4 carousel cards for IndieHackers gg1 h10 launch.
Uses local HuggingFace inference on ROCm.
"""

import torch
import os
from pathlib import Path
from diffusers import FluxPipeline
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Device detection (ROCm on leobox)
if torch.cuda.is_available():
    device = "cuda"
    torch.cuda.empty_cache()
else:
    device = "cpu"
    logger.warning("CUDA not available, falling back to CPU (slow)")

# Load model (will cache on first run, ~16GB)
logger.info("Loading FLUX.1-schnell... (first run: ~5 min download + load)")
pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-schnell",
    torch_dtype=torch.bfloat16
)
pipe = pipe.to(device)
if device == "cuda":
    pipe.enable_attention_slicing()

# Output directory
out_dir = Path(__file__).parent.parent / "assets" / "carousel"
out_dir.mkdir(parents=True, exist_ok=True)

# Card specs (from SMM-HULK-LAUNCH-PACKAGE-GG1.md)
cards = [
    {
        "name": "Card 1 - HERO (Pain Frame)",
        "prompt": "Red-orange gradient background (hex #DC2626 to #EA580C). Large white headline centered: 'Perdi fino a 3000 euro al mese con la pubblicità inefficiente.' Bold white text 48pt. Small calculator icon bottom-right. Modern minimalist design, anti AI-slop, high contrast white on gradient. No logo.",
        "file": "carousel_01_hero.png",
    },
    {
        "name": "Card 2 - SOLUTION (Teaser)",
        "prompt": "Blue background (hex #2563EB). White headline centered: 'Il nostro calcolatore misura esattamente le perdite pubblicitarie.' White text 40pt. Large calculator/formula visual in center. Subtext smaller: 'Real data. No theory.' Clean modern indie-hacker aesthetic.",
        "file": "carousel_02_solution.png",
    },
    {
        "name": "Card 3 - PROOF (Social Proof)",
        "prompt": "Green background (hex #16A34A). White headline centered: 'Utenti hanno risparmiato il 25% sui costi pubblicitari grazie ai nostri strumenti.' White text 40pt. Upward trending graph visualization center. Subtext: 'Real users. Real numbers.' Modern clean design.",
        "file": "carousel_03_proof.png",
    },
    {
        "name": "Card 4 - CTA (Micro-Promo)",
        "prompt": "Gold/amber background (hex #F59E0B). Dark gray or black headline centered: 'Scopri subito quanto stai perdendo, il tempo è denaro.' Dark text 40pt. White rounded rectangle button mockup in center with text 'Calcola'. Urgency + clarity, clean modern design.",
        "file": "carousel_04_cta.png",
    },
]

# Generate cards
logger.info(f"Generating {len(cards)} carousel cards at 1072x1344px...")
for i, card in enumerate(cards, 1):
    logger.info(f"\n[{i}/{len(cards)}] {card['name']}")

    output_path = out_dir / card["file"]

    try:
        # FLUX.1-schnell inference
        image = pipe(
            prompt=card["prompt"],
            height=1344,
            width=1072,
            num_inference_steps=4,  # schnell is fast
            guidance_scale=3.5,
            generator=torch.Generator(device=device).manual_seed(42),
        ).images[0]

        image.save(output_path)
        logger.info(f"✓ Saved: {output_path}")

    except Exception as e:
        logger.error(f"✗ Failed: {card['name']}")
        logger.error(f"  Error: {e}")
        continue

logger.info(f"\n✓ All cards saved to: {out_dir}")
logger.info("Ready for IndieHackers gg1 h10 launch.")
