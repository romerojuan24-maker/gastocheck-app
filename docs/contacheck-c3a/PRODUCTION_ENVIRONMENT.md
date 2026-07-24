# ContaCheck · C3A — Production Environment (§1)

> Gate de verificación de producción, **estrictamente solo lectura**. No se desplegó, no se modificaron datos,
> objetos, RLS, permisos ni flags. Sin exposición de secretos.

## Identificación del entorno (evidencia)
| Dato | Valor | Fuente |
|---|---|---|
| Proyecto | **checksuite** | `supabase projects list` |
| Project ref | `omhycwfjxynkfwywzwvz` | ídem (linked:true) |
| Organización | `mfkifcraxmzmwzfgmfft` (romerojuan24-maker) | ídem |
| Host DB | `db.omhycwfjxynkfwywzwvz.supabase.co` | ídem |
| Postgres | 17.6.1.127 (engine 17, GA) | ídem |
| Región | us-east-2 | ídem |
| Estado | ACTIVE_HEALTHY | ídem |
| CLI vinculada a prod | **Sí** (`linked:true`) | `supabase/.temp/project-ref` = `omhycwfjxynkfwywzwvz` |
| **Fecha/hora de inspección (UTC)** | **2026-07-24** | esta sesión |

## Método de acceso (read-only, sin secretos)
- **Estado de migraciones:** `supabase migration list --linked` (usa el link ya autenticado; no manejé contraseñas).
- **Inventario de esquema/volumen:** API PostgREST de prod con `service_role` tomada **transitoriamente** de
  `apps/web/.env.local`, **nunca impresa ni guardada**. Solo consultas `GET`/`HEAD` (existencia de tablas/columnas
  y conteos agregados). Cero DDL/DML.
- **No se ejecutó** `supabase db dump` porque requiere Docker para la imagen de `pg_dump` y el engine no estaba
  disponible; se sustituyó por probes PostgREST + scripts SQL entregables (`scripts/contacheck-c3a/`).

## Confirmación de que es producción (no local)
El host `db.omhycwfjxynkfwywzwvz.supabase.co` y ref `omhycwfjxynkfwywzwvz` corresponden al proyecto **checksuite**
de la org de Juan, distinto del stack local (`supabase_db_gastocheck-app`, contenedor Docker). Los volúmenes
observados (6 empresas reales, catálogo de 301 cuentas) confirman datos productivos, no fixtures.

## Lo que este gate NO pudo verificar vía solo-lectura remota
Constraints exactos, FK (v1 vs v2), triggers, definiciones/`search_path` de funciones, políticas RLS internas,
índices y configuración de backup/PITR **no** son visibles por PostgREST. Se entregan **scripts SQL read-only**
(`scripts/contacheck-c3a/01..09`) para completarlos en una sesión con rol de solo lectura sobre prod. **No se
fabricó** ninguno de esos resultados; quedan marcados como pendientes de ejecución en los docs respectivos.

## Secretos
No se mostró ni guardó ninguna credencial. La `service_role` se usó en memoria para las consultas GET/HEAD y no
aparece en ningún archivo de este paquete.
