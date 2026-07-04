# 🔍 PROTOCOLO — Inicio de Sesión (Análisis Expediente Obligatorio)

**Objetivo**: NUNCA meter problemas en lo que está operando  
**Cuándo**: ANTES de cualquier trabajo en esta sesión  
**Responsable**: YO (análisis automático)  
**Crítico**: Sesiones paralelas (Juan en múltiples chats), OTA 132 en producción

---

## 🚨 POR QUÉ ES CRÍTICO

**PROBLEMA**: Asumir estado antiguo (OTA 50) cuando está OTA 132 en producción
**RIESGO**: Proponer cambios incompatibles, conflictos merge, downtime
**SOLUCIÓN**: Revisar COMPLETO antes de cualquier cosa

**EJEMPLO DE ERROR**:
```
Sesión anterior: "GastoCheck OTA 50 con 7 tablas"
Sesión actual: "OTA 132 con 50 tablas + cambios schema"
MI ERROR: "Agrega tabla X" → CONFLICTO, OTA 132 ya la tiene
RESULTADO: Merge failure, debugging innecesario
```

---

## ✅ CHECKLIST OBLIGATORIO (Inicio de Sesión)

### 1. GIT STATUS (Estado repositorio)

```bash
# Verificar
git status
git log --oneline -20

# BUSCO:
├─ ¿Hay cambios sin commitear? (¿quién?)
├─ ¿En qué rama estamos? (¿main? ¿develop?)
├─ ¿Últimos commits? (qué cambios recientes)
├─ ¿Quién commitió? (Juan? Daniel? Otro?)
└─ ¿Hay merge conflicts pendientes? (¿estado?)
```

### 2. OTA ACTUAL (Estado de cada módulo)

```bash
# Buscar en memoria / documentos:
OTA_VERSION.md o CURRENT_STATE.md o similar

# BUSCO:
├─ GastoCheck: ¿Qué OTA? (132?) ¿Qué features?
├─ CobraCheck: ¿Iniciado? ¿% completado?
├─ FacturaCheck: ¿Estado?
├─ BancoCheck: ¿Estado?
├─ Otros: ¿Estado?
└─ Bloqueantes: ¿Qué está parado y por qué?
```

### 3. MIGRACIONES SQL (¿Ejecutadas?)

```bash
# Buscar:
├─ ¿GastoCheck SQL migración ejecutada?
├─ ¿Qué versión schema actualmente?
├─ ¿Hay rollbacks pendientes?
├─ ¿Qué cambios esperan ejecución?
└─ ¿Conflictos de versión?
```

### 4. CAMBIOS ARQUITECTURA DESDE SESIÓN ANTERIOR

```bash
# Comparar documentación:
├─ FACTURACHECK_ARQUITECTURA_COMPLETA.md: ¿cambió?
├─ COBRACHECK architecture: ¿cambió?
├─ Schema DB: ¿nuevas tablas?
├─ Integraciones: ¿cambios?
└─ Decisiones: ¿se liberó algo? ¿se pausó?
```

### 5. PRODUCCIÓN vs DESARROLLO

```bash
# Identificar:
├─ ¿GastoCheck está en PRODUCCIÓN? (usuarios reales)
├─ ¿CobraCheck en QA/Beta?
├─ ¿Otros módulos en desarrollo?
├─ ¿Cuál es la rama ESTABLE? (main? master? production?)
└─ ¿Debo proponer cambios solo en branch develop?
```

### 6. DEPENDENCIAS ENTRE MÓDULOS

```bash
# Mapear:
├─ ¿CobraCheck depende de GastoCheck SQL migrada?
├─ ¿FacturaCheck depende de tabla nueva?
├─ ¿BancoCheck depende de cambios GastoCheck?
├─ ¿Cambio mío afecta a usuario en producción?
└─ ¿Hay cambios que deben sincronizarse?
```

### 7. TRABAJO PARALELO (Múltiples chats)

```bash
# Verificar:
├─ ¿Hay otro chat activo en GastoCheck? (¿dónde?)
├─ ¿Hay otro chat en CobraCheck?
├─ ¿Hay otro chat en FacturaCheck?
├─ ¿Cambios conflictivos entre chats?
└─ ¿Necesito avisar a otro chat? (coordinación)
```

### 8. ÚLTIMAS DECISIONES (¿Qué pendiente?)

```bash
# Revisar:
├─ PENDIENTES_JUAN_VS_PENDIENTES_CODIGO_2026_07_04.md
├─ ¿Qué decidió Juan?
├─ ¿Qué falta decidir?
├─ ¿Qué estoy esperando?
└─ ¿Puedo avanzar algo paralelo?
```

---

## 📋 DOCUMENTO REFERENCIA (Que debo revisar)

```
SIEMPRE REVISAR ESTOS DOCUMENTOS:
├─ OTA_VERSION_TRACKER.md (cuál es OTA actual)
├─ CHECK_SUITE_ESTADO_TODOS_MODULOS_2026_07_04.md (status general)
├─ PENDIENTES_JUAN_VS_PENDIENTES_CODIGO_2026_07_04.md (decisiones)
├─ FACTURACHECK_REQUISITOS_DANIEL.md (si FacturaCheck es tema)
├─ COBRACHECK_ARCHITECTURE.md (si CobraCheck es tema)
├─ BANCOCHECK_INTEGRACION_BANCARIA.md (si BancoCheck es tema)
└─ Git log últimos 20 commits (qué cambió)
```

---

## 🔴 RIESGOS A EVITAR

```
RIESGO 1: Asumir arquitectura vieja
├─ PROBLEMA: "GastoCheck tiene 7 tablas"
├─ REALIDAD: OTA 132 tiene 50 tablas
└─ PREVENCIÓN: Revisar schema ACTUAL, no memorias viejas

RIESGO 2: Proponer cambios incompatibles con producción
├─ PROBLEMA: "Cambiar tabla X de GastoCheck"
├─ REALIDAD: 1000 usuarios con datos en esa tabla
└─ PREVENCIÓN: Verificar si módulo está en producción ANTES

RIESGO 3: Conflictos merge por trabajo paralelo
├─ PROBLEMA: "Yo propongo cambio A, otro chat propone cambio B"
├─ REALIDAD: Merge conflict, rollback, debugging
└─ PREVENCIÓN: Revisar qué hace otro chat, coordinar

RIESGO 4: Cambios que rompen dependencias
├─ PROBLEMA: "Cambio schema GastoCheck"
├─ REALIDAD: CobraCheck depende de esa tabla
└─ PREVENCIÓN: Mapear dependencias antes de proponer

RIESGO 5: Migración SQL incompleta
├─ PROBLEMA: "Asumo que migración se ejecutó"
├─ REALIDAD: Aún no ejecutada, schema desincronizado
└─ PREVENCIÓN: Verificar status ANTES de diseñar sobre ello
```

---

## 🎯 MI FLUJO (Antes de cualquier trabajo)

```
1. LEO GIT (últimos 20 commits)
   → ¿Qué cambió?
   → ¿Quién lo hizo?
   → ¿Hay cambios relacionados?

2. REVISO OTA_VERSION_TRACKER.md
   → ¿Cuál es OTA actual?
   → ¿Qué módulos qué OTA?
   → ¿Hay bloqueantes?

3. REVISO CHECK_SUITE_ESTADO
   → ¿Qué % completado cada módulo?
   → ¿Qué está en producción?
   → ¿Qué está en desarrollo?

4. REVISO PENDIENTES
   → ¿Qué decidió Juan?
   → ¿Qué puedo hacer paralelo?
   → ¿Hay dependencias que debo evitar?

5. MAPEO DEPENDENCIAS
   → Si voy a cambiar tabla X, ¿quién más la usa?
   → ¿Hay módulos que dependen?
   → ¿Hay migraciones que esperar?

6. VERIFICO MIGRACIONES
   → ¿SQL de GastoCheck ejecutada?
   → ¿Hay rollbacks pendientes?
   → ¿Schema está sincronizado?

7. CONFIRMO CON JUAN
   → "Basado en OTA 132, aquí está el estado"
   → "Mis propuestas son compatibles con esto"
   → "¿Hay algo que no vi?"
```

---

## 📝 FORMATO RESPUESTA (Después de análisis)

```
ANÁLISIS EXPEDIENTE — [FECHA]

📊 ESTADO ACTUAL:
├─ GastoCheck: OTA [N], [% completado], [estado producción?]
├─ CobraCheck: [estado], [% completado]
├─ FacturaCheck: [estado]
├─ BancoCheck: [estado]
└─ Otros: [estado]

🔄 CAMBIOS RECIENTES:
├─ Últimos commits: [qué cambió]
├─ Migraciones: [ejecutadas? pendientes?]
├─ Decisiones liberadas: [cuáles]
└─ Bloqueantes actuales: [cuáles]

⚠️ RIESGOS IDENTIFICADOS:
├─ [Riesgo 1] porque [razón]
├─ [Riesgo 2] porque [razón]
└─ [Mitigation plan]

✅ SEGURO PROPONER:
├─ [Cambio A] (independiente de producción)
├─ [Cambio B] (sin conflictos)
└─ [Cambio C] (verificado compatibilidad)

❌ NO PROPONER (HASTA):
├─ [Cambio X] (esperar migración SQL)
├─ [Cambio Y] (decidir PAC primero)
└─ [Cambio Z] (coordinar con otro chat)

🎯 PROPUESTA SESIÓN:
├─ Puedo hacer: [lista]
├─ Necesito de Juan: [decisiones]
└─ Debo evitar: [riesgos]
```

---

## ✅ EJEMPLO: Cómo debería haber empezado HOY

```
❌ LO QUE HICE (MAL):
"GastoCheck OTA 50... CobraCheck está listo..."
→ ASUMÍ estado antiguo, no verifiqué OTA 132

✅ LO QUE DEBERÍA HABER HECHO:

git log --oneline -20
→ Ver últimos commits, qué cambió

Revisar OTA_VERSION_TRACKER.md
→ "GastoCheck en OTA 132, CobraCheck 0% iniciado"

Revisar ESTADO_MODULOS
→ "GastoCheck 100% producción, SQL migración ejecutada"

Revisar PENDIENTES
→ "Esperamos Facturama API key, Bancos decisión"

RESPUESTA:
"Analicé expediente OTA 132:
- GastoCheck: 100% producción, 132 OTA, SQL ok
- CobraCheck: 0% iniciado (depende migración ✓)
- FacturaCheck: 95% diseño, bloqueado Facturama
- BancoCheck: 10% base, necesita decisión Belvo

Puedo hacer paralelo:
- BancoCheck: schema completo, parsers
- FlujoCheck: diseño

Necesito de TI:
- OTA 132 cambios (qué features nuevas?)
- Decisión PAC
- Decisión Bancos

¿Confirmas estado? ¿Qué cambió en OTA 132?"
```

---

## 🔒 IMPLEMENTAR ESTE PROTOCOLO

**Ahora** (cada sesión):
```
1. LEO git log -20
2. REVISO 8 documentos clave
3. MAPEO dependencias
4. CONFIRMO con Juan ESTADO REAL
5. PROPONGO trabajo compatible
```

**Nunca más**:
```
❌ Asumir arquitectura vieja
❌ Proponer cambios sin verificar dependencias
❌ Hacer trabajo que rompe producción
❌ Olvidar que hay trabajo paralelo en otros chats
```

---

**PROTOCOLO VIGENTE DESDE**: 2026-07-04  
**APLICAR A**: TODA sesión futura  
**RESPONSABLE**: YO (análisis automático)  
**VERIFICADOR**: Juan (confirma estado antes de propuestas)

