# 📌 PROMPT INICIO SESIÓN — Módulos en Desarrollo (Juan)

**Propósito**: Que CADA SESIÓN sea clara, sin confusiones entre lo que opera vs lo que desarrollamos  
**Responsabilidad**: Juan (proporciona contexto), Yo (trabajo sin afectar producción)  
**Vigencia**: Usar este prompt en CADA INICIO de sesión conmigo

---

## 🎯 CONTEXTO A PROPORCIONAR (Juan)

Cuando abras sesión conmigo, copia esto y rellena:

```
═══════════════════════════════════════════════════════════════
CONTEXTO SESIÓN [FECHA] — Módulos en Desarrollo
═══════════════════════════════════════════════════════════════

1. MÓDULOS OPERANDO EN PRODUCCIÓN (Manejo en OTRO CHAT)
   ├─ GastoCheck: OTA [N], operando públicamente ✅
   ├─ CobraCheck: OTA [N], operando públicamente ✅
   └─ Otros vigentes: [listar]
   
   ⚠️ NOTAS:
   ├─ No proponer cambios esquema GastoCheck/CobraCheck
   ├─ No tocar migraciones de módulos operativos
   └─ Cambios vía OTRO CHAT (donde se generan OTAs)

2. MÓDULOS EN DESARROLLO (Este Chat — MI RESPONSABILIDAD)
   ├─ BancoCheck: [% completado, estado actual, bloqueantes]
   ├─ FlujoCheck: [% completado, estado actual, bloqueantes]
   ├─ CajaCheck: [% completado, estado actual, bloqueantes]
   └─ InventarioCheck: [% completado, estado actual, bloqueantes]
   
   ⚠️ NOTAS:
   ├─ Puedo proponer cambios arquitectura
   ├─ Puedo crear nuevas tablas (sin tocar módulos operativos)
   └─ Coordinar si dependen de cambios producción

3. DEPENDENCIAS CRÍTICAS
   ├─ ¿BancoCheck depende de cambios GastoCheck?
   ├─ ¿FlujoCheck depende de cambios CobraCheck?
   ├─ ¿Algún módulo nuevo necesita tabla en módulo operativo?
   └─ ¿Bloqueantes que debo saber?

4. DECISIONES PENDIENTES (Solo AQUÍ, no en otro chat)
   ├─ PAC FacturaCheck: [Facturama? SenHub?]
   ├─ Bancos BancoCheck: [Belvo? Híbrido?]
   ├─ Prioridad CajaCheck/Inventario: [Semana 6? Mes 2?]
   └─ Otras decisiones: [listar]

5. INFORMACIÓN EXTERNA (Otro chat, no aquí)
   ├─ OTA próxima versión: [generada allá]
   ├─ Cambios GastoCheck operativo: [gestionados allá]
   ├─ Cambios CobraCheck operativo: [gestionados allá]
   └─ Versionado: [gestión allá, yo informado]

═══════════════════════════════════════════════════════════════
```

---

## 🚫 QUÉ NO DEBO HACER (Aquí)

```
❌ NO TOCO:
├─ Schema de módulos que están en producción
├─ Migraciones de GastoCheck / CobraCheck
├─ OTA versioning (eso es en otro chat)
├─ Cambios que afecten usuarios públicos
└─ Nada que requiera coordinación OTA

❌ NO ASUMO:
├─ Qué OTA están corriendo (me lo dices)
├─ Qué cambios hizo el otro chat (me lo dices)
├─ Cuál es el estado de producción (me lo dices)
└─ Qué usuarios impacta (me lo dices)
```

---

## ✅ QUÉ SÍ PUEDO HACER (Aquí)

```
✅ PUEDO:
├─ Diseñar BancoCheck completo (schema, lógica, UI)
├─ Diseñar FlujoCheck completo (arquitectura, integraciones)
├─ Diseñar CajaCheck si lo prioriza
├─ Diseñar InventarioCheck si lo prioriza
├─ Crear nuevas tablas (sin tocar módulos operativos)
├─ Proponer integraciones (con modules que operan)
├─ Documentar arquitectura (para Daniel codificar)
└─ Resolver decisiones de ESTOS módulos

✅ ASUMO:
├─ Módulos operativos están estables
├─ Cambios a operativos vienen informados de otro chat
├─ Puedo diseñar sin miedo a romper producción
├─ Dependencias se resuelven coordinadamente
└─ Yo no toco OTA, otro chat lo maneja
```

---

## 🎯 MI WORKFLOW (Cuando tú proporciones contexto)

```
PASO 1: Leo tu contexto (5 min)
├─ Confirmo módulos operativos (NO TOCO)
├─ Confirmo módulos desarrollo (SÍ DISEÑO)
├─ Mapeo dependencias
└─ Identifico decisiones pendientes

PASO 2: Analizo expediente (10 min)
├─ Git log (qué cambió últimamente)
├─ Documentos de estado (qué está dónde)
├─ Dependencias (qué afecta qué)
└─ Bloqueantes (qué espero de ti)

PASO 3: Propongo trabajo (5 min)
├─ Esto puedo hacer paralelo
├─ Esto espera decisión tuya
├─ Esto no toco (es operativo)
└─ Esto necesita coordinación otro chat

PASO 4: Trabajo sin riesgos
├─ Diseño módulos nuevos con seguridad
├─ No propongo cambios a producción
├─ Pido coordinación si necesario
└─ Documento para Daniel codificar
```

---

## 📋 PLANTILLA: QUÉ ME DICES AL INICIO

**COPIA Y RELLENA EN CADA SESIÓN**:

```
🎯 CONTEXTO SESIÓN [FECHA] — Módulos en Desarrollo

PRODUCCIÓN (Otro Chat):
- GastoCheck: OTA [X], operando ✅
- CobraCheck: OTA [X], operando ✅
- [Otros]: [estado]

DESARROLLO (Este Chat - MI TRABAJO):
- BancoCheck: [% completado, estado]
- FlujoCheck: [% completado, estado]
- CajaCheck: [% completado, estado]
- InventarioCheck: [% completado, estado]

DEPENDENCIAS:
- [Listar si hay]

DECISIONES PENDIENTES:
- [Listar qué necesito que decidas]

NOTAS IMPORTANTES:
- [Información que necesito saber]
```

---

## 🔒 GARANTÍA: NO ROMPO PRODUCCIÓN

Cuando tú proporciones este contexto, YO:

✅ **No propongo cambios a módulos operativos**  
✅ **No toco migraciones de producción**  
✅ **No interfiero con OTA workflow (otro chat)**  
✅ **Diseño módulos nuevos con total libertad**  
✅ **Coordino si hay dependencias**  
✅ **Documento todo para Daniel**  

---

## 📍 RESUMEN: Cómo trabaja esto

```
OTRO CHAT (Gestión OTAs + Módulos Operativos):
├─ GastoCheck OTA actualizaciones
├─ CobraCheck OTA actualizaciones
├─ Versionado y deploys
└─ Cambios a producción

ESTE CHAT (Desarrollo Módulos Nuevos):
├─ BancoCheck diseño + código
├─ FlujoCheck diseño + código
├─ CajaCheck diseño + código (si lo prioriza)
├─ InventarioCheck diseño + código (si lo prioriza)
└─ Sin riesgos de afectar usuarios públicos

COORDINACIÓN:
├─ Yo recibo contexto de ambos chats
├─ Diseño con seguridad
├─ No propongo cambios operativos
└─ Daniel codifica módulos nuevos
```

---

**VIGENCIA**: Usar este prompt en CADA INICIO de sesión  
**BENEFICIO**: Claridad 100%, sin confusiones, sin riesgos producción  
**RESPONSABILIDAD**: Juan proporciona contexto, Yo trabajo seguro

