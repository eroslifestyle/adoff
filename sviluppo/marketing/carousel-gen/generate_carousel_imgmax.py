#!/usr/bin/env python3
"""
Generate carousel images using LiteLLM img-max (local, fast)
Cards 2-4: Solution, Proof, CTA (Card 1 already generated via SDXL)
"""

import os
import requests
import base64
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

LLM_API_KEY = os.getenv('LLM_API_KEY', 'sk-adoff-mvp-key')
LLM_BASE_URL = os.getenv('LLM_BASE_URL', 'http://127.0.0.1:4000/v1')
OUTPUT_DIR = Path('assets/carousel')
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

CARDS = [
    {
        'id': 2,
        'name': 'SOLUTION',
        'theme': 'blue',
        'prompt': 'Professional web UI mockup of an ad revenue loss calculator with blue theme. Minimalist design showing input fields for monthly traffic and CPM, with a large number display showing "€2,847" annual loss. Clean, modern, professional. No text labels, visual design focused.',
        'file': 'carousel_02_solution.png'
    },
    {
        'id': 3,
        'name': 'PROOF',
        'theme': 'green',
        'prompt': 'Green upward trending graph with financial chart showing 25% growth. Real data visualization style, professional report aesthetic. Shows month-over-month improvement. Clean modern design, no labels, focus on visual impact.',
        'file': 'carousel_03_proof.png'
    },
    {
        'id': 4,
        'name': 'CTA',
        'theme': 'gold',
        'prompt': 'Golden button mockup design with "Discover your loss" call-to-action. Luxury minimalist style, premium feel. Gold/cream color scheme, modern sans-serif, clean composition. No actual text, visual mockup of conversion button.',
        'file': 'carousel_04_cta.png'
    }
]

def generate_image(prompt, filename):
    """Generate image via img-max API (1072x1344px)"""
    try:
        logger.info(f"Generating {filename}...")

        response = requests.post(
            f'{LLM_BASE_URL}/images/generations',
            headers={'Authorization': f'Bearer {LLM_API_KEY}'},
            json={
                'model': 'img-max',
                'prompt': prompt,
                'size': '1072x1344',
                'quality': 'hd',
                'n': 1,
                'response_format': 'b64_json'
            },
            timeout=120
        )

        if response.status_code != 200:
            logger.error(f"API error: {response.status_code} - {response.text}")
            return False

        data = response.json()
        if 'data' not in data or not data['data']:
            logger.error(f"No image data in response: {data}")
            return False

        img_b64 = data['data'][0].get('b64_json')
        if not img_b64:
            logger.error(f"No b64_json in response: {data}")
            return False

        # Decode and save
        img_data = base64.b64decode(img_b64)
        filepath = OUTPUT_DIR / filename
        filepath.write_bytes(img_data)
        logger.info(f"✓ Saved: {filepath} ({len(img_data)/1024/1024:.1f}MB)")
        return True

    except requests.exceptions.Timeout:
        logger.error(f"Timeout generating {filename}")
        return False
    except Exception as e:
        logger.error(f"Error: {e}")
        return False

def main():
    logger.info(f"Generating cards 2-4 via img-max ({LLM_BASE_URL})")

    success_count = 0
    for card in CARDS:
        if generate_image(card['prompt'], card['file']):
            success_count += 1
        else:
            logger.warning(f"Failed to generate {card['file']}, continuing...")

    logger.info(f"\n✓ Generated {success_count}/{len(CARDS)} cards")
    logger.info(f"Carousel directory: {OUTPUT_DIR.absolute()}")

if __name__ == '__main__':
    main()
