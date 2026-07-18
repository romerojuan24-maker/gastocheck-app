# AUDITORÍA BASE 002 — DUPLICIDAD DE CAPTURA
**Análisis de información capturada más de una vez en el mismo flujo**

---

## DUPLICIDAD 1: RELACIÓN DE DOCUMENTO A GASTO (CNT-004)
**Severidad:** 🟡 MEDIA — Ineficiencia manual

### Evidencia
**Primera captura — Comprador registra gasto + sube documento:**
- Archivo: `apps/web/app/(dashboard)/gastocheck/nuevo-comprobante/page.tsx` (presume)
- Acción: Comprador crea expense → `status = 'captured'`
  - Campos: `monto`, `proveedor`, `descripción`, `fecha`
- Luego: Sube ticket/XML → `expense_attachments.id, expense_id` (presume)

**Segunda captura — Contador "relaciona" documento:**
- Archivo: NO EXISTE componente específico verificado
- Acción: Contador ve documento "suelto" → Abre dropdown de gastos → Selecciona gasto
- Resultado: `UPDATE expense_attachments SET expense_id = X`
- Problema: **El gasto YA TENÍA expense_id desde el upload anterior**

### Problema Operativo
- Comprador y contador capturan relación dos veces
- Duplicidad de acción → fricción
- Contador confundido: ¿por qué dice "relacionar" si ya está relacionado?
- Riesgo: Relacionar OTRO gasto = error de auditoría

### Categoría
**DUPLICIDAD ALTA** — Trabajo manual innecesario

---

## DUPLICIDAD 2: RE-UPLOAD DE COMPROBANTES (CPR-010, CPR-011)
**Severidad:** 🔴 ALTA — Pérdida de información / Re-captura completa

### Evidencia
**Primera captura — Comprador sube documento + OCR:**
- Flujo: Comprador fotografía ticket → `ocr-extract` extrae (monto, fecha, proveedor)
- Archivo: `supabase/functions/ocr-extract/index.ts:11-90`
  - Resultado: `confidence: high/medium/low`
  - Almacena en: `expense_attachments + ocr_raw` (presume)
- Datos extraídos: **Guardados y verificables**

**Rechazo (CNT-004 analiza, rechaza):**
- Contador dice: "Monto incorrecto, favor resubir"
- `UPDATE expenses SET status = 'observed'` (línea: authorize-expense/index.ts:67)

**Segunda captura — Comprador re-sube:**
- Archivo: `supabase/functions/submit-receipt/index.ts` (presume)
- Acción: Comprador vuelve a fotografiar / arrastrar archivo
- Problema 1: **NO REUTILIZA la extracción anterior** (confidence data perdida)
- Problema 2: **Vuelve a correr OCR**, consumiendo:
  - Créditos API Gemini (costo)
  - Tiempo de usuario
- Resultado: Archivo duplicado en storage → storage costs

### Detalles de Código
**Primera extracción (NO se reutiliza):**
```
supabase/functions/ocr-extract/index.ts:75
response.json({
  success: true,
  extracted: {
    monto: "1500.00",
    fecha: "2025-07-15",
    proveedor: "Empresa XYZ"
  },
  confidence: "high"
})
```

**Re-upload (ignora datos anteriores):**
```
supabase/functions/submit-receipt/index.ts (presume)
— Llama nuevamente a ocr-extract
— Gasta créditos Gemini
— Reprocesa el mismo documento
```

### Problema Operativo
- **Costo:** Cada re-upload = llamada adicional a OCR ($$ API)
- **Tiempo:** Usuario re-foto/re-arrastra documento
- **Información perdida:** Campo `confidence:high` del original se pierde
- **Auditoría débil:** No hay registro de "por qué se rechazó"

### Categoría
**DUPLICIDAD CRÍTICA** — Pérdida de inversión (API costo + tiempo usuario)

---

## DUPLICIDAD 3: IMPORTACIÓN DE XML (Comprador sube XML, contador lo revisa)
**Severidad:** 🟡 MEDIA — Ineficiencia de validación

### Evidencia
**Primera captura — Comprador sube XML:**
- Archivo: `supabase/functions/xml-parse/index.ts:27-100`
- Acción: Comprador arrastra XML → Sistema parsea automáticamente
- Resultado: `cfdi_data { uuid, rfc, emisor, cantidad, monto, signature }`
  - Válida: RFC, UUID, matemática fiscal
  - Detecta: Duplicados (UUID existente = error 409)

**Segunda captura — Contador "valida" CFDI:**
- Ruta: `/validar-cfdi` (presume en apps/web)
- Acción: Contador abre lista de XMLs → Selecciona → Botón "Validar"
- Archivo: `supabase/functions/validate-cfdi/index.ts` o `validate-cfdi-real/index.ts`
- Problema: **YA FUE VALIDADO en xml-parse** (línea 31-42: XXE + matemática)

### ¿Qué se valida dos veces?
| Campo | xml-parse | validate-cfdi | Duplicidad? |
|-------|-----------|---------------|----|
| RFC | ✅ Validado | ✅ Re-validado | 🟡 Duplicidad |
| Matemática | ✅ Validado | ✅ Re-validado | 🟡 Duplicidad |
| UUID | ✅ Verificado | ❓ Presume sí | 🟡 Duplicidad |
| Firma | ❓ No verificada | ✅ Validada? | ✅ Única |

### Problema Operativo
- Contador confundido: ¿cuál es la validación "real"?
- Doble trabajo de auditoría
- Si xml-parse rechaza, contador nunca ve documento
- Si validate-cfdi dice "válido" pero xml-parse lo rechazó = inconsistencia

### Categoría
**DUPLICIDAD MEDIA** — Validación redundante pero no crítica

---

## DUPLICIDAD 4: CATEGORIZACIÓN DE GASTO (Comprador vs Contador)
**Severidad:** 🟡 MEDIA — Asignación fragmentada

### Evidencia
**Posible 1ª captura — Comprador categoriza al crear:**
- Presume: Gasto se captura con categoria_id inicial
- Archivo: NO VERIFICABLE (presume en formulario)

**Posible 2ª captura — Contador re-categoriza:**
- Ruta: `/gastocheck/polizas` (presume)
- Acción: Contador ve gasto → Abre dropdown "Categoría" → Elige otra → Guarda
- Resultado: `UPDATE expenses SET category_id = NEW_ID`

### Problema
- ¿Puede comprador categorizar? ¿O es solo lectura?
- ¿Puede contador sobrescribir categoría de comprador?
- ¿Hay auditoría de "cambio de categoría"?

### Categoría
**DUPLICIDAD NO VERIFICADA** — Necesita clarificación

---

## MATRIZ CONSOLIDADA DE DUPLICIDADES

| ID | Tipo | Desde | Hasta | Datos repetidos | Costo | Auditoría | Severidad |
|----|------|-------|-------|-----------------|-------|-----------|-----------|
| DUP-001 | Relación doc-gasto | Comprador | Contador | expense_id | Tiempo manual | ❌ Débil | 🟡 Media |
| DUP-002 | Re-upload OCR | Comprador (1ª) | Comprador (2ª) | Archivo + OCR | 💰 API Gemini | ⚠️ Parcial | 🔴 Alta |
| DUP-003 | Validación CFDI | Comprador | Contador | RFC, matemática, UUID | Tiempo manual | ✅ Fuerte | 🟡 Media |
| DUP-004 | Categorización | Comprador(?) | Contador | category_id | Tiempo | ❓ Unclear | 🟡 Media |

---

## IMPACTO COMBINADO

### 💰 Costo económico
- **OCR re-procesamiento (DUP-002):** ~$0.10/documento × (% de rechazo) = X por mes
- Asumiendo 100 gastos/mes con 20% rechazo = ~$2/mes (bajo, pero acumula)

### ⏱️ Costo de tiempo usuario
- **Relación doc (DUP-001):** 1 min/documento × 100/mes = 100 min/mes para contador
- **Re-upload (DUP-002):** 2 min/documento × 20 rechazos/mes = 40 min/mes para comprador
- **Validación (DUP-003):** 0.5 min/documento × 100/mes = 50 min/mes para contador
- **Total:** ~200 min/mes = 3+ horas/mes de trabajo que no agrega valor

### 🎯 Riesgo de error
- DUP-002 (OCR re-run): Diferente resultado si extracción es inconsistente
- DUP-001 (Relación): Relacionar al gasto INCORRECTO = auditoría rota

---

## CORRECCIONES PROPUESTAS

1. **DUP-002 (CRÍTICA):** Re-usar extracción anterior si `confidence:high`, permitir manual override si `medium/low`
2. **DUP-001:** Eliminar paso manual, relación automática al upload
3. **DUP-003:** Validar XML UNA SOLA VEZ en xml-parse, eliminar paso de contador
4. **DUP-004:** Clarificar: ¿quién categoriza? ¿Puede ambos?

Estos entran en **10_PLAN_DE_CORRECCION_OPERATIVA.md**

