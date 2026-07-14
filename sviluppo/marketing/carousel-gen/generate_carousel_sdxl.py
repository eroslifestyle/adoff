#!/usr/bin/env python3
"""
Generate carousel images using Stable Diffusion XL (fallback when FLUX gated)
4 cards: Hero (pain), Solution (teaser), Proof (social proof), CTA (conversion)
"""

import os
import sys
import logging
from pathlib import Path
from PIL import Image
import torch
from diffusers import DPMSolverMultistepScheduler, StableDiffusionXLPipeline

logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s: %(message)s')
logger = logging.getLogger(__name__)

OUTPUT_DIR = Path('assets/carousel')
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Device selection
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Using device: {DEVICE}")

CARDS = [
    {
        'id': 1,
        'name': 'HERO (Pain Frame)',
        'prompt': 'Bold red-orange gradient background with bold white text "€3000+ a year lost to ads". Frustrated computer user silhouette. Modern, urgent, attention-grabbing design. High contrast. Professional web banner style.',
        'seed': 42,
    },
    {
        'id': 2,
        'name': 'SOLUTION (Teaser)',
        'prompt': 'Clean blue gradient background with minimalist calculator icon. Text display showing "€X" loss calculation. Modern UI design, professional, sleek. Minimalist aesthetic, no clutter.',
        'seed': 43,
    },
    {
        'id': 3,
        'name': 'PROOF (Social Proof)',
        'prompt': 'Green gradient background with upward trending graph line. Chart showing 25% improvement. Financial data visualization. Professional report style. Modern design.',
        'seed': 44,
    },
    {
        'id': 4,
        'name': 'CTA (Conversion)',
        'prompt': 'Gold/cream gradient background with prominent rounded button mockup. Text "Discover Now". Luxury minimalist design. Premium feel, modern sans-serif. High contrast.',
        'seed': 45,
    }
]

def generate_carousel():
    logger.info("Loading Stable Diffusion XL...")

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
        use_safetensors=True,
        variant="fp16" if DEVICE == "cuda" else None,
    )

    # Use faster scheduler
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to(DEVICE)

    logger.info(f"Generating 4 carousel cards (target: 1072x1344px, generating at 1024x1280)...")

    for card in CARDS:
        logger.info(f"\n[{card['id']}/4] {card['name']}")

        # Generate at 1024x1280, then resize to 1072x1344
        image = pipe(
            prompt=card['prompt'],
            num_inference_steps=25,
            guidance_scale=7.5,
            height=1280,
            width=1024,
            generator=torch.Generator(DEVICE).manual_seed(card['seed']),
        ).images[0]

        # Resize to exact carousel dimensions
        image = image.resize((1072, 1344), Image.Resampling.LANCZOS)

        # Save
        filename = f"carousel_0{card['id']}.png"
        filepath = OUTPUT_DIR / filename
        image.save(filepath, 'PNG', quality=95)
        logger.info(f"✓ Saved: {filepath}")

    logger.info(f"\n✓ All cards generated in {OUTPUT_DIR.absolute()}")

if __name__ == '__main__':
    try:
        generate_carousel()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
