# Pendientes Daniel — 09 Junio 2026
> GastoCheck · Todo el código está listo en `main`. Solo se necesita ejecutar estos pasos para que el sistema quede completamente funcional.

---

## 1. Migraciones Supabase (SQL Editor)

Ve a **Supabase Dashboard → SQL Editor** y ejecuta los archivos en este orden exacto:

### Paso 1 — Schema principal (tablas nuevas)
Archivo: `supabase/migrations/20260608000003_receipts_schema.sql`

Contiene:
- Tablas: `suppliers`, `receipts`, `receipt_batches`, `receipt_batch_items`, `receipt_duplicate_matches`, `purchase_items`, `expense_tags`, `receipt_tags`, `expense_category_templates`, `expense_category_rules`, `accounting_export_profiles`, `accounting_category_map`, `audit_logs`
- RLS en todas las tablas
- Función SQL `normalize_provider_name()`
- Roles `operator`, `admin`, `superadmin` en el enum
- Columna `sector` en `companies`
- Columna `receipt_id` en `expenses`

### Paso 2 — Plantillas de categorías (seed)
Archivo: `supabase/migrations/20260608000004_category_templates.sql`

Contiene plantillas precargadas para 9 sectores:
`universal`, `agro`, `construccion`, `alimentos`, `transportistas`, `distribucion`, `servicios_tecnicos`, `manufactura`, `comercio`

> ⚠️ Ejecutar SIEMPRE el 000003 antes del 000004.

---

## 2. Deploy de Edge Functions

En la terminal, dentro de la carpeta `C:\Users\admin\Documents\gastocheck-app\`:

```bash
# Actualizar OCR (versión 2 — lineItems, UUID CFDI, RFC validados)
npx supabase functions deploy ocr-extract

# Anti-duplicados (nueva — 5 niveles de detección)
npx supabase functions deploy check-duplicate

# Orquestador de captura (nueva — reemplaza inserts directos desde la app)
npx supabase functions deploy submit-receipt

# Exportación contable (nueva — Excel 6 hojas, CONTPAQi, Aspel, Microsip, CSV)
npx supabase functions deploy generate-export
```

---

## 3. Secrets en Supabase

Ve a **Supabase Dashboard → Edge Functions → Secrets** y verifica que existan:

| Secret | Valor | Estado |
|---|---|---|
| `GEMINI_API_KEY` | Tu API Key de Google AI Studio | ⚠️ Requerido para OCR |
| `SUPABASE_URL` | Ya existe por defecto | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya existe por defecto | ✅ |

Si `GEMINI_API_KEY` no está, agrégala. Sin ella el OCR falla silenciosamente.

---

## 4. Usuarios de prueba

En **Supabase Dashboard → Authentication → Users**, crear 3 usuarios:

| Email | Rol sugerido | Para probar |
|---|---|---|
| `operador@test.com` | operator | Capturar tickets desde la app |
| `supervisor@test.com` | supervisor | Autorizar gastos/comprobantes en web |
| `admin@test.com` | admin | Acceso total |

Contraseña sugerida a todos: `Test1234!`

Luego asignarlos a una empresa en `company_members`:
```sql
-- Reemplazar los UUIDs con los reales de tus usuarios y empresa
INSERT INTO company_members (company_id, user_id, role)
VALUES
  ('<company_id>', '<uid_operador>',   'operator'),
  ('<company_id>', '<uid_supervisor>', 'supervisor'),
  ('<company_id>', '<uid_admin>',      'admin');
```

---

## 5. Seed de datos de prueba

Archivo: `supabase/seed.sql` (ya existe en el repo)

Ejecutar en SQL Editor para tener:
- 1 empresa de prueba
- 1 póliza abierta
- Anticipos de ejemplo
- Categorías cargadas desde las plantillas del sector `universal`

```sql
-- Cargar categorías universales a la empresa de prueba
INSERT INTO expense_categories (company_id, name, is_template, sector, display_order)
SELECT '<company_id>', name, false, sector, display_order
FROM expense_category_templates
WHERE sector = 'universal';
```

---

## 6. Verificación rápida post-deploy

Checklist para confirmar que todo funciona:

- [ ] Abrir la app móvil → tomar foto de un ticket → verificar que OCR extrae datos
- [ ] Confirmar ticket → verificar que aparece en "Mis comprobantes"
- [ ] Abrir el panel web → tab Comprobantes → ver el comprobante capturado
- [ ] Aprobar el comprobante desde el panel web
- [ ] Crear una relación en la app móvil → agregar el comprobante
- [ ] Cerrar la relación → ir al tab Exportar en web → descargar Excel
- [ ] Abrir el Excel y verificar las 6 hojas

---

## Resumen de lo que está 100% listo en el código

| Módulo | Estado |
|---|---|
| Motor de saldos (ledger) | ✅ Funcional desde versión anterior |
| OCR Gemini con lineItems y UUID CFDI | ✅ Listo |
| Anti-duplicados 5 niveles | ✅ Listo |
| Pantalla Mis Comprobantes (móvil) | ✅ Lista |
| Pantalla Relaciones contables (móvil) | ✅ Lista |
| Detalle de relación con agregar/quitar | ✅ Listo |
| Historial de proveedor + análisis precios | ✅ Listo |
| CategoryPicker y TagPicker | ✅ Listos |
| Panel web — 4 tabs completos | ✅ Listo |
| Exportación Excel/CONTPAQi/Aspel/Microsip | ✅ Lista |
| Plantillas de categorías 9 sectores | ✅ Listas |
| Audit logs | ✅ Tabla lista |

---

## 7. Compilar primer APK (Expo Cloud)

Archivo: `docs/BUILD_APK_INSTRUCCIONES.md` — lee completo antes de empezar.

Resumen 3 comandos:
```bash
cd apps/mobile
eas login                              # Primera vez solamente
eas init                               # Primera vez solamente
eas build --platform android --profile preview   # Cada build
```

Tiempo: ~8–15 min en la nube de Expo. Link de descarga automático.

---

**Commit actual:** `48f2a9d` en branch `main`
**Repo:** https://github.com/romerojuan24-maker/gastocheck-app
