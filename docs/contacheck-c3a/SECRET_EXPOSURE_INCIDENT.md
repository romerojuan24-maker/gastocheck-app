# ContaCheck · C3A.2 — Incidente de exposición de credenciales (§1)

> **Bloqueador de producción.** No es una tarea opcional. Este documento describe el incidente; el inventario
> redactado, la rotación y la purga de historial están en los documentos hermanos.

## Resumen del incidente
La **`service_role` VIVA de producción** (proyecto `checksuite`, ref `omhycwfjxynkfwywzwvz`) está **hardcodeada**
en archivos versionados y **pusheada a GitHub** (`github.com/romerojuan24-maker/gastocheck-app`, rama `main`).

- **Confirmación de vigencia (sin usar la llave para escribir):** el fingerprint SHA-256 del token hardcodeado
  (`6c01bd481ddf…`) es **idéntico** al del `SUPABASE_SERVICE_ROLE_KEY` que la app usa hoy en `apps/web/.env.local`.
  → **Es la llave de producción en uso, VIGENTE.**
- **Exposición desde:** primer commit `a5d4bb7` (**2026-06-23**) en `scripts/`; re-expuesta en `f103082`
  (2026-06-28, utilidades raíz) y `e6465b0` (2026-07-18). ~1 mes en el remoto.
- **Alcance de la llave:** `service_role` **bypassa RLS** → lectura/escritura total de la base de producción
  (todas las empresas, PII de nómina, banca, CFDI). Riesgo **CRÍTICO**.
- También expuestas: la clave **`anon`** de prod (menor severidad) en 5 archivos.

## Impacto potencial
Cualquiera con acceso al repositorio (o a su historial, si el repo fue público o compartido) pudo obtener la
`service_role` y operar la base de producción **sin RLS**. La `anon` permite acceso a lo que las políticas RLS
concedan a usuarios anónimos.

## Estado de la remediación (esta sesión)
| Acción | Estado |
|---|---|
| Inventario redactado (sin valores) | ✅ hecho (`SECRET_INVENTORY_REDACTED.md`) |
| Confirmar vigencia (fingerprint == live) | ✅ **es la llave viva de prod** |
| **Limpieza del árbol actual** (env-ify + redacción de docs) | ✅ hecho — **0 tokens** en el árbol rastreado (código y md) |
| `.env.example` documenta las vars | ✅ ya existía (URL/ANON/SERVICE_ROLE) |
| `.gitignore` cubre `.env*` | ✅ confirmado |
| Escaneo de secretos en CI (gitleaks) | ✅ añadido `.github/workflows/secret-scan.yml` |
| **Rotación de la `service_role`/`anon`** | ⛔ **PENDIENTE — solo Juan** (`SECRET_ROTATION_PLAN.md`) |
| **Purga del historial de Git** | ⛔ **PENDIENTE — requiere autorización** (`GIT_HISTORY_REMEDIATION.md`) |
| Investigación de uso indebido (logs) | ⚠️ requiere acceso a logs de Supabase (Juan); ver abajo |

## Investigación de posible uso indebido (§1.6)
No tengo acceso a los logs de auditoría/administrativos de Supabase (Dashboard → Logs / Reports, o la API de
plataforma con token del owner). **No puedo confirmar ni descartar uso indebido.** Juan debe revisar en el
dashboard: accesos recientes, autenticaciones, cambios de esquema/administrativos, y actividad con
`service_role`. Si la retención de logs no cubre desde 2026-06-23, **documentar la limitación** (no asumir que
"sin evidencia" = "sin incidente").

## Conclusión
Mientras la `service_role` de producción **no se rote**, el sistema debe considerarse **comprometido a nivel de
credencial**. Esto es un **NO-GO** para C3B por sí solo (ver `FINAL_GO_NO_GO.md`): no se despliega contabilidad
nueva sobre una base cuya llave maestra está expuesta y sin rotar.
