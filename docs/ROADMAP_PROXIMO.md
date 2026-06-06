# GastoCheck — Roadmap próximas semanas

**Para:** Juan + Daniel  
**Estado:** Fase 0/1 en progreso  

---

## Hito 1 — OCR Funcional (LUNES 2026-06-09)
- ✅ BD live en Supabase
- ✅ Edge Function `ocr-extract` deployada
- ⏳ **LUNES:** ANTHROPIC_API_KEY en Supabase Secrets (Daniel)
- **Objetivo:** Testear que app móvil → foto ticket → Claude lee → prellena datos

---

## Hito 2 — Guardado de gastos (Semana 2)
- Implementar lógica: cuando usuario toca "✓ Guardar gasto" en móvil
  - Insert en tabla `expenses` con datos de ocr-extract
  - Insert en `expense_attachments` (guarda la imagen)
  - Recalcula saldo automáticamente (via trigger SQL)
- Conectar `useOcr` + `CaptureScreen` a BD

---

## Hito 3 — Autorización en web (Semana 2-3)
- Edge Function `authorize-expense` — cambia status de gasto (pending_auth → authorized / rejected)
- Dashboard web conectado a BD
  - Lee gastos de tabla `expenses`
  - Bandeja "Pendientes de autorizar"
  - Botones ✅ Autorizar / ❌ Rechazar
  - Recalcula saldo al autorizar

---

## Hito 4 — Funciones auxiliares (Semana 3)
- `xml-parse` Edge Function — lee CFDI directamente
- Excel export (`exceljs`)
- ZIP export (`jszip`)

---

## Hito 5 — Comercial (Semana 4+)
- Planes/Stripe
- WhatsApp Business API
- GitHub push + EAS (Expo)

---

## Pendientes técnicos (por resolver)

| Item | Responsable | Prioridad |
|------|------|----------|
| ANTHROPIC_API_KEY en Secrets | Daniel | ALTA — lunes |
| Guardar gastos en BD | Juan (code) | ALTA — semana 2 |
| authorize-expense function | Juan (code) | ALTA — semana 2 |
| xml-parse function | Juan (code) | MEDIA — semana 3 |
| Excel/ZIP export | Juan (code) | MEDIA — semana 3 |
| GitHub remote | Daniel | BAJA — cuando Juan pida |
| EAS build | Daniel | BAJA — cuando Juan pida |

---

## Repositorio y acceso

- **Ruta local:** `C:\Users\admin\Documents\gastocheck-app`
- **Git:** master branch, 3 commits (scaffold + ocr + supabase)
- **GitHub:** Pendiente crear repo
- **Supabase:** https://app.supabase.com → proyecto `gastocheck` (Pro)
- **Documentación:** `docs/DISENO.md` (arquitectura completa)

---

## Notas importantes

1. **BD multi-tenant:** cada empresa es un "tenant", aisladas por `company_id` + RLS
2. **Saldo automático:** triggers SQL recalculan `closing_balance` de pólizas al insertar/actualizar gastos
3. **OCR sensible:** Claude Vision entiende español/inglés, flexiona fechas y montos
4. **Sin ERP pesado:** GastoCheck es lean, solo resuelve control de gastos + saldos + autorización
