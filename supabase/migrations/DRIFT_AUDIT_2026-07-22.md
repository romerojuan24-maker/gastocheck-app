# Auditoría de drift — Producción vs repo de migraciones (2026-07-22)

Proyecto prod: **gastocheck** (`omhycwfjxynkfwywzwvz`). Verificado en el SQL Editor (rol postgres).

## Conclusión central
**El registro `supabase_migrations.schema_migrations` NO es fuente de verdad.** Se quedó en
`20260713010000`, pero contenido de migraciones posteriores SÍ está aplicado en prod (aplicado
**a mano** sin registrar la versión). Para saber si algo está en prod hay que **probar el objeto
real**, no el registro.

## Estado del registro
- Última versión registrada en prod: **`20260713010000`** (advisor_ai_usage_log).
- El repo llega hasta `20260722200500`. En el registro no está reverse-drift (todo lo registrado en prod existe en el repo).

## Migraciones del repo ausentes del registro y su estado real verificado
| Versión | Nombre | ¿En prod realmente? |
|---|---|---|
| 20260708000001 | cobracheck_complete_impl | Base cobra existe desde junio (cobra_check_schema). Aditivos: sin verificar |
| 20260708000002 | flujocheck_complete_impl | Base flujo existe desde junio. Aditivos: sin verificar |
| 20260708000003 | inventariocheck_complete_impl | Base inventario existe desde junio. Aditivos: sin verificar |
| **20260708000004** | **nomicheck_complete_impl** | **NO — tablas nomi_\* no existen (verificado)** |
| 20260715000000 | wave6_wave8_schema (advisor_tasks) | Sin verificar |
| 20260715100000 | signal_triggers | Sin verificar |
| 20260719000000 | fix_rls_contador_general_view_all | Probable aplicada a mano (hay query guardada con ese CREATE FUNCTION) |
| 20260720100000 | fix_cobracheck_field_flow | **SÍ (verificado true)** |
| 20260720120000 | fix_organization_modules | **SÍ (verificado true)** |
| 20260720130000 | fix_rls_advances_viaticos_contador | **SÍ (verificado true)** |
| 20260721100000 | bancocheck_clasificacion_contable | **SÍ (verificado true)** |
| 20260722100000 | cfdi_sellos_timbrado | Casi seguro PENDIENTE (creada esta sesión) |

## Implicaciones
1. **Nómina se construye desde cero segura** (no hay tablas ni datos que migrar; cero riesgo de dedup/backfill).
2. El resto del drift es mayormente "contenido aplicado a mano, versión no registrada". Riesgo real
   bajo salvo por lo genuinamente pendiente: `20260722100000` (sellos CFDI) y por verificar
   `20260715000000/100000`.
3. **Recomendación de higiene:** cuando apliques SQL a mano, registrar también la versión
   (`insert into supabase_migrations.schema_migrations(version,name) values (...)`) para que el
   registro vuelva a ser confiable. (No lo hago yo sin tu visto bueno.)

## Pendiente de verificar (si quieres cierre total)
`20260715000000` (¿existe tabla `advisor_tasks`?), `20260715100000` (triggers de señales),
`20260722100000` (¿columna `cfdi_documents.serie`?), y los aditivos de `20260708000001/2/3`.
