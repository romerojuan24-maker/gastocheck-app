#!/bin/bash
# Script: Sincronizar APP_VERSION de packages/shared a apps/mobile/lib/shared
# Uso: npm run sync-shared-version

SOURCE="packages/shared/src/index.ts"
TARGET="apps/mobile/lib/shared/index.ts"

if [ ! -f "$SOURCE" ]; then
  echo "❌ ERROR: $SOURCE no existe"
  exit 1
fi

if [ ! -f "$TARGET" ]; then
  echo "❌ ERROR: $TARGET no existe"
  exit 1
fi

# Copiar el archivo completo
cp "$SOURCE" "$TARGET"

if [ $? -eq 0 ]; then
  echo "✅ APP_VERSION sincronizada: $SOURCE → $TARGET"
else
  echo "❌ Error al sincronizar"
  exit 1
fi
