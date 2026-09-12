#!/bin/bash
# AdOff — Build con obfuscation per produzione
# Uso: bash sviluppo/scripts/build-obfuscated.sh
#
# Prerequisiti:
#   npm install -g javascript-obfuscator
#
# Cosa fa:
#   1. Copia i file runtime in build/
#   2. Offusca i file JS sensibili (license-client, stealth, content, popup, options, background)
#   3. Crea il ZIP finale per Chrome Web Store

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION=$(grep '"version"' "$PROJECT_ROOT/manifest.json" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
BUILD_DIR="$PROJECT_ROOT/sviluppo/build"
OUTPUT="$PROJECT_ROOT/sviluppo/adoff-v${VERSION}-prod.zip"

echo "=== AdOff v${VERSION} — Build produzione con obfuscation ==="

# Controlla che javascript-obfuscator sia installato
if ! command -v javascript-obfuscator &> /dev/null; then
  echo "ERRORE: javascript-obfuscator non trovato."
  echo "Installa con: npm install -g javascript-obfuscator"
  exit 1
fi

# Pulisci build precedente
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/src" "$BUILD_DIR/rules" "$BUILD_DIR/assets"

# Copia file non-JS
cp "$PROJECT_ROOT/manifest.json" "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/rules/"* "$BUILD_DIR/rules/" 2>/dev/null || true
cp -r "$PROJECT_ROOT/assets/"* "$BUILD_DIR/assets/" 2>/dev/null || true

# Copia file CSS e HTML (non offuscati)
for f in "$PROJECT_ROOT/src/"*.css "$PROJECT_ROOT/src/"*.html; do
  [ -f "$f" ] && cp "$f" "$BUILD_DIR/src/"
done

# File JS da offuscare (contengono logica di licenza/protezione)
OBFUSCATE_FILES=(
  "license-client.js"
  "stealth.js"
  "background.js"
  "popup.js"
  "options.js"
  "content.js"
)

# File JS da copiare senza obfuscation (utility leggere)
COPY_FILES=(
  "i18n.js"
)

# Opzioni obfuscation — bilancio sicurezza/performance
# NON usiamo le opzioni piu' aggressive che rompono le estensioni Chrome
OBFUSCATOR_OPTS=(
  --compact true
  --control-flow-flattening true
  --control-flow-flattening-threshold 0.5
  --dead-code-injection true
  --dead-code-injection-threshold 0.2
  --identifier-names-generator hexadecimal
  --rename-globals false
  --rename-properties false
  --self-defending false
  --split-strings true
  --split-strings-chunk-length 5
  --string-array true
  --string-array-calls-transform true
  --string-array-encoding base64
  --string-array-index-shift true
  --string-array-rotate true
  --string-array-shuffle true
  --string-array-threshold 0.75
  --string-array-wrappers-count 2
  --string-array-wrappers-type variable
  --transform-object-keys false
  --unicode-escape-sequence false
)

echo ""
echo "--- Offuscamento file JS ---"
for file in "${OBFUSCATE_FILES[@]}"; do
  src="$PROJECT_ROOT/src/$file"
  dst="$BUILD_DIR/src/$file"
  if [ -f "$src" ]; then
    echo "  Obfuscating: $file"
    javascript-obfuscator "$src" --output "$dst" "${OBFUSCATOR_OPTS[@]}"
  else
    echo "  SKIP (non trovato): $file"
  fi
done

echo ""
echo "--- Copia file JS non offuscati ---"
for file in "${COPY_FILES[@]}"; do
  src="$PROJECT_ROOT/src/$file"
  if [ -f "$src" ]; then
    echo "  Copying: $file"
    cp "$src" "$BUILD_DIR/src/"
  fi
done

# Crea ZIP
echo ""
echo "--- Creazione ZIP ---"
rm -f "$OUTPUT"
cd "$BUILD_DIR"
zip -r "$OUTPUT" . -x "*.DS_Store" -x "*/Thumbs.db"

# Dimensioni
ORIG_SIZE=$(du -sh "$PROJECT_ROOT/src/" | cut -f1)
BUILD_SIZE=$(du -sh "$BUILD_DIR/src/" | cut -f1)
ZIP_SIZE=$(du -h "$OUTPUT" | cut -f1)

echo ""
echo "=== Build completata ==="
echo "  Originale src/:  $ORIG_SIZE"
echo "  Offuscato src/:  $BUILD_SIZE"
echo "  ZIP finale:      $ZIP_SIZE"
echo "  Output:          $OUTPUT"
echo ""
echo "Prossimi passi:"
echo "  1. Testa l'estensione da build/: chrome://extensions → Carica non pacchettizzata → build/"
echo "  2. Se tutto OK, carica il ZIP su Chrome Web Store"
echo "  3. NON pubblicare mai i file non offuscati"
