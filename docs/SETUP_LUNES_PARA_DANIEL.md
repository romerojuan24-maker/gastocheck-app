# Setup GastoCheck — Instrucciones para Daniel (Sistemas)

**De:** Juan (Diseño)  
**Para:** Daniel (Sistemas)  
**Fecha:** Lunes, 2026-06-09  
**Prioridad:** Media (permite testeo OCR el lunes)

---

## Resumen

GastoCheck es un SaaS de control de gastos. El viernes completamos: Supabase Cloud (BD + migrations) + web + móvil + Edge Function OCR. Hoy necesitas configurar 2 cosas para que funcione OCR (lectura de tickets con Claude Vision).

**Tiempo estimado:** 10 minutos

---

## QUÉ HACER

### 1. Obtener clave API de Anthropic (Claude)

**Acciones:**
1. Ve a: https://console.anthropic.com
2. Login con cuenta de Juan (romerojuan24@gmail.com) o la que uses
3. Click en **"Obtener clave de API"** (botón azul arriba a la derecha)
4. Se generará una clave tipo: `sk-ant-v0-xxxxxxxxxxxxxxxxxxxx`
5. **Cópiala completa** (sin espacios)
6. Pega en un bloc de notas temporal — la usarás en el paso 2

**Nota:** El free tier de Anthropic tiene límite USD 500/mes, suficiente para testear.

---

### 2. Configurar ANTHROPIC_API_KEY en Supabase

**Acciones:**
1. Ve a: https://app.supabase.com
2. Click en el proyecto **gastocheck** (Juan te pasó el acceso)
3. Left sidebar → **Edge Functions** → **Secrets**
4. Click **New secret**
5. Rellena:
   - **Name:** `ANTHROPIC_API_KEY` (exacto, sin espacios)
   - **Value:** `sk-ant-...` (la clave que copiaste en paso 1)
6. Click **Create**

**Verificación:** Debería aparecer en la lista de Secrets con un candado verde ✓

---

## INFORMACIÓN TÉCNICA (para referencia)

| Item | Valor |
|------|-------|
| Proyecto Supabase | `gastocheck` (Pro plan) |
| Región | East US (Ohio) |
| BD | Postgres 15, 19 tablas (companies, expenses, policies, etc) |
| RLS | Habilitado (multi-tenant por company_id) |
| Edge Function | `ocr-extract` (lee tickets con Claude Vision) |
| URL proyecto | https://omhycwfjxynkfwywzwvz.supabase.co |

---

## QUÉ PASA DESPUÉS (contexto para Daniel)

Una vez configurada la clave:
- App móvil: usuario toma foto de ticket → envía a Edge Function → Claude lee → prellena datos (total, iva, proveedor)
- Dashboard web: mostrará gastos desde BD en tiempo real

---

## SI HAY PROBLEMAS

- **"You need additional permissions"** en Supabase → reload página (F5) o logout/login
- **No me pide login en Anthropic** → la cuenta de Juan ya debe estar activa
- **No aparece el botón "New secret"** → asegúrate de estar en Edge Functions, no en otra sección

**Contacto:** Avísale a Juan si hay problema, él escalará.

---

## CONFIRMACIÓN

Cuando termines, avísale a Juan:
- ✅ Clave de Anthropic obtenida
- ✅ Secret `ANTHROPIC_API_KEY` creado en Supabase
- ✅ Verificado (el secret aparece en la lista)

Listo. El lunes por la tarde Juan testea OCR tomando foto de un ticket real.
