"""
Genera voiceover italiano per TikTok AdOff — versione DINAMICA.
Ritmo veloce, frasi corte, impatto immediato.
"""
import asyncio
import json
import os
import edge_tts

# Script corto e impattante — max 25 secondi
SCRIPT = """
Pubblicita ovunque. Ne hai abbastanza?
Un click. Tutto sparisce.
AdOff blocca ogni pubblicita, su qualsiasi sito, in automatico.
Niente banner. Niente video. Niente pop-up.
Invisibile. Veloce. Gratis per quindici giorni.
adoff punto app. Scaricalo ora.
""".strip()

VOICE = "it-IT-DiegoNeural"
RATE = "+0%"     # Velocita normale (non piu lento)
PITCH = "-5Hz"   # Leggermente piu grave
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "public", "audio")


async def generate():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_mp3 = os.path.join(OUTPUT_DIR, "voiceover.mp3")

    communicate = edge_tts.Communicate(
        text=SCRIPT,
        voice=VOICE,
        rate=RATE,
        pitch=PITCH,
        boundary="WordBoundary",
    )

    words = []

    with open(output_mp3, "wb") as audio_file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                offset_ms = chunk["offset"] / 10_000
                duration_ms = chunk["duration"] / 10_000
                words.append({
                    "text": chunk["text"],
                    "startMs": round(offset_ms),
                    "endMs": round(offset_ms + duration_ms),
                })

    # Salva captions JSON
    captions_path = os.path.join(OUTPUT_DIR, "voiceover_captions.json")
    with open(captions_path, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)

    duration = words[-1]["endMs"] / 1000 if words else 0
    print(f"[OK] Audio: {output_mp3}")
    print(f"[OK] Captions: {captions_path} ({len(words)} parole)")
    print(f"[OK] Voce: {VOICE} rate={RATE}")
    print(f"[OK] Durata: ~{duration:.1f}s")
    return words


if __name__ == "__main__":
    asyncio.run(generate())
