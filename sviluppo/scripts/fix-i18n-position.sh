#!/bin/bash
# Fix i18n script position - move to HEAD before CSS

echo "Moving adoff-i18n.js to HEAD in all HTML files..."

find . -name "*.html" -type f -exec grep -l "adoff-i18n.js" {} \; | while read file; do
  echo "Processing: $file"

  # Remove i18n script from footer (if exists)
  sed -i '/<script src="\/adoff-i18n\.js/d' "$file"

  # Add i18n script to HEAD (after affiliate-tracking, before CSS)
  # Only if not already present in HEAD
  if ! grep -q 'adoff-i18n.js' "$file"; then
    sed -i '/<script src="affiliate-tracking\.js"><\/script>/a\  <script src="/adoff-i18n.js?v=260718-fix"><\/script>' "$file"
  fi
done

echo "Done! Fixed $(find . -name "*.html" -type f -exec grep -l "adoff-i18n.js" {} \; | wc -l) files."