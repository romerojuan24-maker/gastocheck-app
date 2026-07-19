#!/bin/bash
# Script: Monitorear estado de OTA publicadas
# Verifica que dispositivos estén recibiendo updates
# Uso: bash scripts/monitor-ota.sh

echo "📊 OTA Monitoring — CHECK SUITE"
echo ""

# 1. Obtener últimas 10 OTAs publicadas
echo "🔍 Últimas OTAs publicadas en preview channel:"
echo ""

cd apps/mobile

# Ejecutar eas update:list y parsear
eas update:list --platform android --branch preview --limit 10 2>/dev/null | grep -E "published|Update ID|Platform" | head -30

echo ""
echo "---"
echo ""
echo "📌 INTERPRETAR:"
echo "  - Published: fecha/hora de publicación"
echo "  - Si UPDATE_ID aparece = OTA fue publicada exitosamente"
echo "  - Si no hay Update ID = OTA falló"
echo ""
echo "⚠️  Para verificar si dispositivos la recibieron:"
echo "  1. Abre app en device"
echo "  2. Settings → About → APP_VERSION (debe ser la última publicada)"
echo "  3. Si no coincide después de 10 minutos, rollback"
echo ""
