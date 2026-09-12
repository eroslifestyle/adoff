#!/bin/bash
# Ad Network Scanner - Simple version using curl
# Scansiona pagine web per trovare domini pubblicitari non bloccati

TARGET="${1:-https://example.com}"
TMP=$(mktemp)

echo "=== Ad Network Scanner ==="
echo "Target: $TARGET"
echo ""

# Fetch page and extract domains
curl -sL --max-time 10 "$TARGET" 2>/dev/null | \
  grep -oE 'https?://[^"'\''> ]+' | \
  grep -iE '(ad|ads|advert|track|sponsor|doubleclick|googlesyndication|adnxs|criteo|taboola|outbrain|moat|amazon-ads)' | \
  sed -E 's|https?://([^/]+).*|\1|' | \
  sort -u > "$TMP"

echo "Found ad-related domains:"
cat "$TMP"

echo ""
echo "New domains to block (not in existing rules):"
# These would be manually verified and added
cat "$TMP"

rm "$TMP"
