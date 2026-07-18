# AUDITORÍA BASE 002 — INCONSISTENCIAS WEB/MÓVIL
**Funciones disponibles en web pero no en mobile, o viceversa**

---

| ID | Función | Web | Mobile | Severidad | Evidencia |
|----|---------|-----|--------|-----------|-----------|
| INCON-001 | Crear empresa | ✅ POST /api | ✅ API | — | Ambos usan mismo endpoint |
| INCON-002 | Fotografiar comprobante | ✅ apps/web/gastocheck/escanear | ✅ apps/mobile | ✅ CONSISTENTE | Componentes separados pero misma Edge Function `ocr-extract` |
| INCON-003 | Subir XML manual | ✅ Drag-drop | ✅ Upload | ✅ CONSISTENTE | Ambos → `xml-parse` |
| INCON-004 | Autorizar gasto | ✅ `/gastocheck` listado | ❓ NO VERIFICABLE | 🟡 MEDIUM | ¿Está en mobile app? No verificado |
| INCON-005 | Cambiar roles | ✅ `/configuracion` | ❓ NO VERIFICABLE | 🟡 MEDIUM | Settings presume en mobile pero no verificado |
| INCON-006 | Desactivar usuarios | ✅ `/configuracion` | ❓ NO VERIFICABLE | 🟡 MEDIUM | No verificado en mobile |
| INCON-007 | Consultar cartera (cobranza) | ✅ `/cobracheck/facturas` | ❓ NO EXISTE | 🔴 HIGH | CobraCheck mobile no verificada existencia |
| INCON-008 | Registrar llamada | ❓ NO EXISTE web | ✅ Presume mobile | 🔴 HIGH | Función cobranza parece mobile-only |
| INCON-009 | Exportar datos | ✅ `export-excel/zip` | ❓ NO VERIFICABLE | 🟡 MEDIUM | Web tiene funciones pero mobile unclear |
| INCON-010 | Dashboard KPIs | ✅ `/hoy` | ❓ NO VERIFICABLE | 🟡 MEDIUM | Dashboard layout presume en mobile pero no verificado |

**Resumen:**
- ✅ Funciones core consistentes (Auth, OCR, XML)
- 🟡 Funciones administrativas no verificadas en mobile
- 🔴 CobraCheck completamente no verificada en mobile

