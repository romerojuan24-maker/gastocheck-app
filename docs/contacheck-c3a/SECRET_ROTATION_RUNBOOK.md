# ContaCheck · C3A.2 — Runbook operativo de rotación (Prioridad 1)

> Lo ejecuta **Juan**. El asistente **no** rota llaves, no ejecuta acciones administrativas, no ve ni imprime
> valores. **Nunca pegues la llave nueva en un archivo versionado, doc, script, chat o log.**

---

## 1. GUÍA DE ROTACIÓN

### 1.0 Antes de empezar
- Estas llaves son **JWT** (`anon` y `service_role`) firmadas por el **JWT secret** del proyecto
  `omhycwfjxynkfwywzwvz`. La `service_role` **bypassa RLS** → tratarla como compromiso total.
- **Primero verifica qué sistema de llaves ofrece tu proyecto** (Dashboard → Project Settings → **API Keys**):
  - **(A) Nuevo sistema "API Keys"** (`sb_publishable_…` / `sb_secret_…`) → permite **crear la nueva antes de
    revocar la vieja** = **cero downtime** y **no cierra sesiones**. **Preferir esta si está disponible.**
  - **(B) Legacy (JWT anon/service_role)** → la rotación se hace regenerando el **JWT secret**, lo que
    **invalida `anon` + `service_role` a la vez** y **cierra todas las sesiones de usuario** (los JWT emitidos
    dejan de ser válidos). Requiere **ventana de mantenimiento**.

### 1.1 Dónde rotar
- **Opción A (nuevo sistema):** Settings → **API Keys** → crear un nuevo **secret key**; más tarde **revocar** el
  comprometido. La `publishable`/`anon` nueva se genera igual.
- **Opción B (legacy):** Settings → **API** → **JWT Settings** → *Generate a new JWT secret* (regenera `anon` +
  `service_role`). ⚠️ cierra sesiones de todos los usuarios.
- (Verifica la ruta exacta en tu dashboard; la UI de Supabase cambia con el tiempo.)

### 1.2 Orden de ejecución
**Con Opción A (recomendada, sin downtime):**
1. Crear la **nueva** `service_role`/secret (la vieja sigue viva un momento).
2. **Actualizar todos los consumidores** (§2) con la nueva.
3. Redesplegar web + (opcional) Edge Functions.
4. **Revocar/eliminar** la llave comprometida.
5. Rotar también la `anon`/publishable si el sistema lo permite por separado.

**Con Opción B (legacy, con ventana de mantenimiento):**
1. Anunciar ventana (los usuarios serán deslogueados).
2. Regenerar el JWT secret → copiar **nueva** `anon` y `service_role`.
3. **Inmediatamente** actualizar todos los consumidores (§2) y redesplegar.
4. Verificar (§3). Los usuarios vuelven a iniciar sesión.

### 1.3 Cómo evitar imprimir/almacenar la nueva credencial
- Copiar del dashboard **directo** al gestor de secretos del hosting / `supabase secrets` / `.env.local` local.
- **Nunca** `echo`, `console.log`, ni pegarla en commits/docs/chat. `.env*` ya está en `.gitignore`.
- En CI, usarla solo como **secret** enmascarado (GitHub → Settings → Secrets), nunca en el YAML.

### 1.4 Acciones que requieren tu intervención manual
- Todo el §1 (rotar en el dashboard) y la actualización de secretos en **hosting**, **EAS**, **CI** y **local**
  — el asistente no tiene ni debe tener esos accesos.

---

## 2. INVENTARIO DE CONSUMIDORES (evidencia del repo)

### `service_role` (`SUPABASE_SERVICE_ROLE_KEY`)
| Consumidor | Cómo lo consume | ¿Update manual al rotar? |
|---|---|---|
| **Edge Functions** (~40: `nomi-*`, `timbrar-cfdi`, `cancelar-cfdi`, `create-company`, `register-company`, `advisor-*`, `pac-config-*`, `bancocheck-auto-match`, `cobra*`, `reembolsos-workflow`, `submit-receipt`, `generate-export`, `stripe-webhook`, `send-notification`, `invite-gastador`, `operator-companies`, etc.) | `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` | **Normalmente NO** — Supabase **inyecta** `SUPABASE_SERVICE_ROLE_KEY` automáticamente en cada función; tras rotar, el valor inyectado se actualiza. **Verificar** con `supabase secrets list` que **no** exista un secreto propio duplicado con ese valor; si existe, actualizarlo. Un `supabase functions deploy` fuerza refresco. |
| **Web API (Next.js server)**: `apps/web/lib/api-auth.ts`, `apps/web/app/api/{cobracheck/collections,gastocheck/pendientes,gastocheck/dashboard,facturacheck/dashboard,flujocheck/dashboard,members/[userId]}`, `apps/web/app/auth/callback/route.ts` | `process.env.SUPABASE_SERVICE_ROLE_KEY` | **SÍ** — actualizar en el **hosting** (Vercel/…) y redeploy. |
| **Utilidades** (`execute-migration.*`, `temp-migrate.js`, `run-migration-and-start-app.js`, `scripts/*.js` ya env-ificadas) | ahora `process.env.SUPABASE_SERVICE_ROLE_KEY` | **SÍ** para correrlas (env local); ya no hardcodean. |

### `anon` (`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
| Consumidor | Cómo | ¿Update manual? |
|---|---|---|
| **Web cliente**: `apps/web/lib/supabase.ts` + páginas dashboard | `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` | **SÍ** — hosting + redeploy |
| **Móvil (Expo/EAS)**: `apps/mobile/eas.json`, `apps/mobile/hooks/useOcr.ts`, `lib/ocr-batch.ts`, `apps/cobra-mobile/*` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` (embebida en el build) | **SÍ** — actualizar **EAS secrets** / `eas.json` y **rebuild** del APK/app |
| **Local dev** | `apps/web/.env.local`, `apps/mobile/.env` | **SÍ** — actualizar en cada equipo |

### CI/CD
- Revisar **GitHub → Settings → Secrets and variables → Actions**: si hay `SUPABASE_SERVICE_ROLE_KEY`/`ANON`
  como secret del repo, actualizarlos. `.github/workflows/publish-ota.yml` usa `EAS_TOKEN` (Expo), no las llaves
  Supabase; `secret-scan.yml` no usa llaves.

---

## 3. CHECKLIST DE VALIDACIÓN POSTERIOR
- [ ] **La llave vieja YA no funciona:** desde una terminal, una petición con la llave anterior debe dar **401**.
      (Juan, sin pegar la vieja en ningún archivo: probar un `GET /rest/v1/companies?select=id&limit=1` con la
      anterior → esperar 401/invalid.)
- [ ] **La nueva `anon` funciona:** login web + carga de una pantalla que liste datos.
- [ ] **La nueva `service_role` funciona:** un endpoint backend que la use (p.ej. `/api/gastocheck/dashboard`)
      responde 200 para un miembro.
- [ ] **Edge Functions OK:** invocar una que use service_role (p.ej. `nomi-employee-identity` con JWT válido) →
      respuesta esperada; revisar logs sin 401/500 nuevos.
- [ ] **Móvil OK:** build con la nueva `anon` inicia sesión y carga datos.
- [ ] **Sin 401/403 anómalos** en logs 24 h (consumidor olvidado).
- [ ] **gitleaks en CI en verde** (rama actual) — evidencia final.
- [ ] `git grep` de patrón JWT en el árbol → **0** (ya confirmado hoy; re-confirmar tras merge de la tarea de limpieza).

---

## 4. REVISIÓN DE ACTIVIDAD SOSPECHOSA (§ investigación de uso indebido)
Dashboard de Supabase (retención de logs en Pro suele ser **~7 días** para logs de plataforma → **documentar la
limitación**: no cubre desde 2026-06-23):
- **Logs → Auth**: signups/logins inesperados, IPs desconocidas.
- **Logs → API / PostgREST**: volumen o patrones inusuales; peticiones con `service_role` fuera de tus servidores.
- **Logs → Edge Functions**: invocaciones anómalas.
- **Logs → Postgres**: errores/consultas raras; **cambios de esquema** no planeados (DDL).
- **Database → Roles / actividad administrativa**: cambios con roles privilegiados.
- **A nivel aplicación (SQL, solo lectura):** revisar `audit_logs` por entradas inesperadas:
  ```sql
  select action, entity_type, count(*), min(created_at), max(created_at)
  from public.audit_logs
  where created_at >= '2026-06-23'
  group by 1,2 order by 3 desc;
  ```
  y buscar acciones sin `user_id` o de entidades que no cuadren.
- **Si la retención no alcanza 2026-06-23:** dejarlo **documentado** como limitación; "sin evidencia" **no** es
  "sin incidente".
- (Opcional) Revisar en GitHub si el repo fue **público** en algún momento o tuvo forks; y si GitHub **Secret
  Scanning** marcó el token (Settings → Security).

---

## 5. ORDEN DE PURGA DEL HISTORIAL GIT (después de rotar)
> Solo **después** de rotar (así, aunque el token siga en commits viejos/forks, ya está **invalidado**).
1. **Rotación completada y validada** (§1–§3).
2. Coordinar: avisar colaboradores, **congelar merges**, respaldo espejo `git clone --mirror`.
3. Purgar con `git filter-repo --replace-text` (o BFG) usando **regex del patrón** del token (no el valor).
4. Verificar: `git grep -IE 'eyJ…\.…\.…' $(git rev-list --all)` → **0**.
5. `git push --force --mirror` **con tu autorización explícita**.
6. Todos re-sincronizan (`reset --hard origin/main` o re-clonar); re-crear tags.
7. Confirmar que GitHub Secret Scanning ya no marca el token.
Detalle en `GIT_HISTORY_REMEDIATION.md`.

---

## Después de esto (secuencia acordada, no ahora)
1. Ejecutar `scripts/contacheck-c3a/05,06,07` (solo lectura). 2. Confirmar backup/PITR + snapshot. 3. Revisar
actividad sospechosa (§4). 4. Purgar historial (§5). 5. Evidencia final de Gitleaks. 6. **GO/NO-GO definitivo de C3B.**
