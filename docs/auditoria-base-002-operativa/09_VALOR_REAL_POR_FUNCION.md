# AUDITORÍA BASE 002 — VALOR REAL POR FUNCIÓN
**Análisis de funciones que no aportan valor operativo real o tienen ROI negativo**

---

| Función | Aplicación | Propósito | Valor | ROI | Recomendación |
|---------|-----------|----------|-------|-----|---------------|
| Advisor IA | /advisor | Consultas inteligentes | ❌ Bloqueado (TODO) | NEGATIVO | Completar o eliminar |
| Página /demo | /demo | Demostración de data | ❌ Engaña usuario | NEGATIVO | Ocultar |
| BancoCheck auto-match | /bancocheck | Matching automático | ⚠️ Sin revisión visual | BAJO | Agregar UI de revisión |
| FlujoCheck proyección | /flujocheck | Proyección de flujo | ⚠️ Sin validación | BAJO | Validar precisión |
| Contador General | /contador-general | Reportes contables | ⚠️ Unclear | BAJO | Esclarecer o remover |
| WhatsApp webhook | cobra-whatsapp-webhook | Recibir messages | ⚠️ Inbound only | BAJO | Agregar envío |
| Scoring de cobranza | scoring/risk | Priorización | ⚠️ Presume | BAJO | Testear |
| Rutas de cobranza | daily_routes | GPS de rutas | ❌ SEED contaminada | NEGATIVO | Limpiar datos |

**Resumen:** 3 funciones con ROI negativo (Advisor, /demo, Rutas), 3 con ROI bajo (BancoCheck, FlujoCheck, Contador General)

