#!/bin/bash
# AdOff — Build ZIP per Chrome Web Store
# Uso: bash sviluppo/scripts/build-zip.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION=$(grep '"version"' "$PROJECT_ROOT/manifest.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
OUTPUT="$PROJECT_ROOT/sviluppo/adoff-v${VERSION}.zip"

echo "Building AdOff v${VERSION} ZIP..."
echo "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Rimuovi ZIP precedente se esiste
rm -f "$OUTPUT"

# Crea ZIP con solo i file runtime
zip -r "$OUTPUT" \
  manifest.json \
  src/ \
  rules/ \
  assets/ \
  -x "*.DS_Store" \
  -x "*/Thumbs.db"

echo ""
echo "Done! ZIP creato: $OUTPUT"
echo "Size: $(du -h "$OUTPUT" | cut -f1)"
echo ""
echo "Prossimi passi:"
echo "  1. Vai su https://chrome.google.com/webstore/devconsole"
echo "  2. Clicca 'Nuovo elemento' (o 'New item')"
echo "  3. Carica il file: adoff-v${VERSION}.zip"
