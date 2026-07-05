# 🔄 COORDINACIÓN ENTRE CHATS — CHECK SUITE v2.0

**Propósito**: Evitar conflictos git y duplicación de trabajo entre Chat 1 (módulos activos) y Chat 2 (módulos nuevos REM)

**Fecha**: 2026-07-05  
**Estado**: 🟢 COORDINACIÓN ACTIVA

---

## 📋 DIVISIÓN DE TRABAJO

### **CHAT 1** — Módulos Activos (Daniel en operación)
- ✅ **GastoCheck** (OTA 132+)
- ✅ **CobraCheck** (OTA 50+)
- ✅ **STATIX** (OTA 22)
- 🟡 **Mantenimiento + OTAs en vivo**

**Cambios recientes (Chat 1)**:
- `0d8a74e` feat(ota137): design system CHECK SUITE en los 4 módulos auxiliares
- `09b653c` feat(ota136): CobraCheck home por roles + Más Herramientas solo admin

### **CHAT 2** — Módulos Nuevos (Yo — Diseño + Documentación)
- 📄 **FlujoCheck** (DISEÑO COMPLETADO, LISTO CODIFICAR)
- 📄 **BancoCheck** (DISEÑO COMPLETADO, LISTO CODIFICAR)
- 📄 **FacturaCheck** (DISEÑO COMPLETADO, LISTO CODIFICAR)
- 🟡 **Coordinación + Roadmap**

**Cambios recientes (Chat 2)**:
- `13f9af5` docs(cross-modules): 3 documentos integración CHECK SUITE
- `f47487c` docs(facturacheck): Guía completa...
- `07a8ea7` docs: design system estándar CHECK SUITE

---

## 🚨 PUNTOS DE POTENCIAL CONFLICTO

### **1. DESIGN_SYSTEM_CHECK_SUITE_NAVIGATION.md**
```
Status: ✅ CREADO POR CHAT 2 (commit 07a8ea7)
Cambios Chat 1: Si modifica TopBar/BottomTabBar, NOTIFICAR CHAT 2
Cambios Chat 2: Si modifica, NOTIFICAR CHAT 1

PROTOCOLO:
  • Cambios menores: commit + pull chat otra
  • Cambios mayores: PR con review
```

### **2. DESIGN_SYSTEM en Componentes Existentes**
```
Status: ⚠️ RIESGO BAJO
Archivos afectados:
  • apps/mobile/app/gastocheck/components/TopBar.tsx
  • apps/mobile/app/gastocheck/components/BottomTabBar.tsx
  • apps/mobile/app/cobracheck/components/TopBar.tsx

Chat 1: Si refactoriza componentes, NOTIFICAR ANTES
Chat 2: NO tocar código existente (solo diseño/docs)

REGLA: Componentes existentes = Chat 1 ownership
```

### **3. apps/mobile/app/ — Nuevo Módulos**
```
Status: ✅ CLARO
Rutas nuevas (Chat 2 responsable):
  • apps/mobile/app/flujocheck/*         (TODO — Chat 2 preparó docs)
  • apps/mobile/app/bancocheck/*         (TODO — Chat 2 preparó docs)
  • apps/mobile/app/facturacheck/*       (TODO — Chat 2 preparó docs)

Rutas existentes (Chat 1 responsable):
  • apps/mobile/app/gastocheck/*         ✅ Chat 1
  • apps/mobile/app/cobracheck/*         ✅ Chat 1
  • apps/mobile/app/index.tsx            ✅ Chat 1 (routing principal)

REGLA: Nuevas carpetas = Chat 2 desarrollo
        Existentes = Chat 1 mantiene
```

### **4. Supabase Migrations**
```
Status: ⚠️ RIESGO MEDIO
Tipo migrations:
  • OTA 131+ (activos)              → Chat 1 (GastoCheck/CobraCheck)
  • Nuevas FlujoCheck/Banco/Factura → Chat 2 (cuando codifique)

PROTOCOLO:
  1. Chat 2 prepara migration template (DONE ✅)
  2. Chat 2 notifica Chat 1 antes de ejecutar
  3. Chat 1 revisa conflictos RLS/permisos
  4. Ambos: merge en main antes de deploy

FORMATO nombres:
  • Chat 1: 20240705_ota137_*.sql        (OTA numbers)
  • Chat 2: 20240705_flujocheck_*.sql    (module names)
```

### **5. API Endpoints (apps/web/app/api/)**
```
Status: ✅ CLARO
Chat 1 endpoints:
  • /api/gastocheck/*
  • /api/cobracheck/*

Chat 2 endpoints (cuando codifique):
  • /api/flujo/*
  • /api/banco/*
  • /api/factura/*

REGLA: Namespacing por módulo = sin conflictos
       Si reutilizar lógica: extraer a /api/shared/*
```

### **6. packages/shared/**
```
Status: ✅ BAJO RIESGO
Cambios Chat 1: Tipos/constantes GastoCheck/CobraCheck
Cambios Chat 2: Tipos/constantes FlujoCheck/Banco/Factura

PROTOCOLO:
  • Siempre: export en index.ts
  • Siempre: documentar qué módulos usan
  • Nunca: remover sin verificar dependencias
```

---

## 📅 TIMELINE COORDINADA

### **HOY (2026-07-05)**
```
✅ Chat 2: Documentación arquitectura COMPLETA
✅ Chat 1: OTA 137 en main
→ PRÓXIMO: Chat 1 puede empezar OTA 138
→ PRÓXIMO: Chat 2 avisa cuándo empieza a codificar FlujoCheck
```

### **SEMANA 1-2 (2026-07-07 a 2026-07-18)**
```
Chat 1: OTA 138 + mejoras operativas
Chat 2: EMPIEZA FlujoCheck (foundation)
  • Commits: feat(flujocheck): structure + components + types
  • NO toca: GastoCheck, CobraCheck, rutas principales
  • Notifica Chat 1 si toca apps/mobile/app/index.tsx
```

### **SEMANA 3-4**
```
Chat 1: OTA 139 + bug fixes
Chat 2: FlujoCheck algoritmos + API endpoints
  • Migrations ejecutadas en Supabase sandbox
  • Chat 1 revisa antes de merge a main
```

### **SEMANA 5-8**
```
Chat 1: OTA 140 + optimizaciones
Chat 2: BancoCheck + FacturaCheck en paralelo
  • Integraciones comienzan (Ch1 ↔ Ch2 coordina)
  • Diario: actualizar CHECK_SUITE_12WEEK_ROADMAP.md
```

### **SEMANA 9-10**
```
Chat 1 + Chat 2: INTEGRACIÓN FULL
  • GastoCheck ↔ FlujoCheck
  • CobraCheck ↔ FlujoCheck
  • BancoCheck ↔ Flujo
  • FacturaCheck ↔ Banco
  • Alertas globales
```

---

## 🔗 PROTOCOLO DE COORDINACIÓN

### **ANTES DE CADA COMMIT**

```bash
# Chat 2 (nuevo módulo):
1. git pull origin main          # traer cambios Chat 1
2. Revisar: ¿conflictos potenciales?
3. Si toca código Chat 1: NOTIFICAR SLACK
4. Commit + push
5. Notificar: "Chat 2: FlujoCheck foundation, commit X"

# Chat 1 (módulo activo):
1. git pull origin main          # traer cambios Chat 2
2. Revisar: ¿conflictos potenciales?
3. Si toca DESIGN_SYSTEM o components: NOTIFICAR SLACK
4. Commit + push
5. Notificar: "Chat 1: OTA 137, commit X"
```

### **MERGE CONFLICTS**

Si ocurren:
```
PASO 1: No forzar merge (NO git push -f)
PASO 2: Chat 1 + Chat 2 hablan en SLACK
PASO 3: Resolver via:
  a) Rebase (mantener historia)
  b) Manual merge (si lógica afectada)
  c) Revert + retry (si crítico)
PASO 4: Ambos confirman: git log OK
```

### **CAMBIOS MAYORES A COMPONENTES COMPARTIDOS**

Si algo **debe tocar GastoCheck/CobraCheck code**:
```
1. Crear BRANCH: feature/chat2-integrar-flujo
2. Notificar Chat 1: "Necesito tocar apps/mobile/app/index.tsx"
3. Chat 1: revisa cambio + da OK
4. Chat 2: hace cambio
5. Chat 1: revisa + merge
6. Ambos: verifican build OK
```

---

## 📊 CHECKLIST DE COORDINACIÓN

```
☐ INICIO (Hoy):
  ☐ Chat 2: Copia COORDINATION_CHAT1_CHAT2.md a memoria
  ☐ Chat 1: Revisa este documento
  ☐ Ambos: Entienden división de trabajo

☐ SEMANA 1:
  ☐ Chat 2: git pull antes de cada commit
  ☐ Chat 1: revisa cambios Chat 2 en main
  ☐ Si conflictos: SLACK inmediato

☐ SEMANAL:
  ☐ Lunes 10 AM: Sync Juan + Daniel
    • Chat 1: qué va en OTA siguiente
    • Chat 2: qué progreso tiene módulos nuevos
    • Identificar puntos de integración próximos

☐ ANTES DE MERGE MAJOR:
  ☐ Chat 1: notifica cambios a Chat 2
  ☐ Chat 2: revisa, da OK o pide ajustes
  ☐ Vice versa
```

---

## 🎯 REGLAS CLARAS

### **CHAT 1 (Módulos Activos)**
✅ Owner: GastoCheck, CobraCheck, rutas en index.tsx  
✅ Mantiene: components compartidos (TopBar, BottomTabBar)  
✅ Puede: mejorar DESIGN_SYSTEM si comunica  
❌ NO TOCAR: carpetas flujocheck/, bancocheck/, facturacheck/  
❌ NO REMOVER: rutas nuevas de index.tsx sin Chat 2 OK  

### **CHAT 2 (Módulos Nuevos)**
✅ Owner: carpetas flujocheck/, bancocheck/, facturacheck/  
✅ Responsable: migrations para módulos nuevos  
✅ Puede: agregar endpoints en /api/flujo/, /api/banco/, etc.  
❌ NO TOCAR: código GastoCheck/CobraCheck sin coordinar  
❌ NO REMOVER: nada de código existente  

### **AMBOS**
✅ Pullear main ANTES de trabajar cada día  
✅ NOTIFICAR cambios mayores vía SLACK  
✅ Code review si toca código compartido  
✅ Respetar DESIGN_SYSTEM (versioning)  

---

## 📞 ESCALACIÓN RÁPIDA

Si hay conflicto o bloqueo:

```
SLACK PRIORITY:
  🔴 CRITICO (proddown):    LLAMADA IMMEDIATO
  🟠 ALTO (bloquea otro):   MENSAJE URGENT + 15min response
  🟡 NORMAL (merge issue):  Responder hoy, resolver mañana
  🟢 BAJO (style, docs):    Responder antes de fin de semana
```

---

## 📁 ARCHIVOS DE REFERENCIA

- `CHECK_SUITE_12WEEK_ROADMAP.md` — qué semana hace qué chat
- `CHECK_SUITE_INTEGRACION_CROSS_MODULOS.md` — dónde interactúan
- `DESIGN_SYSTEM_CHECK_SUITE_NAVIGATION.md` — componentes compartidos
- `COORDINATION_CHAT1_CHAT2.md` — **Este documento**

---

**ÚLTIMA ACTUALIZACIÓN**: 2026-07-05  
**STATUS**: 🟢 COORDINACIÓN ACTIVA  
**PRÓXIMO SYNC**: Lunes 2026-07-07 10 AM

