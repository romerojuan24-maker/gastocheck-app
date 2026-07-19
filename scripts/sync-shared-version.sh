#!/bin/bash
# Sync APP_VERSION from packages/shared/src/ to apps/mobile/lib/shared/
# Run after editing packages/shared/src/index.ts

SOURCE="packages/shared/src/index.ts"
DEST="apps/mobile/lib/shared/index.ts"

if [ ! -f "$SOURCE" ]; then
  echo "❌ Source file not found: $SOURCE"
  exit 1
fi

if [ ! -f "$DEST" ]; then
  echo "❌ Destination file not found: $DEST"
  exit 1
fi

cp "$SOURCE" "$DEST"
echo "✅ Synced $SOURCE → $DEST"
