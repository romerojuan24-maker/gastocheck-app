# 📋 PENDIENTES CHECK SUITE — División Clara (2026-07-04)

**Contexto Crítico**: OTA 132 (no OTA 50)  
**Objetivo**: Separar decisiones (JUAN) vs trabajo (CÓDIGO)  
**Módulos Enfoque**: BancoCheck, FlujoCheck (+ revisión estado actual)

---

## ⚠️ INFORMACIÓN REQUERIDA (JUAN → AQUÍ)

Necesito que me confirmes ESTADO ACTUAL para no confundir:

### 1. GASTOCHEKC - OTA 132

```
¿Cuál es el estado ACTUAL?
├─ ✅ Funcionalidades completadas (v1.0.2)
├─ 🟡 Funcionalidades en desarrollo
├─ 🔴 Bloqueantes actuales
└─ ⏳ Próximas features planeadas

Preguntas específicas:
□ ¿Migración SQL ya ejecutada?
□ ¿Stripe integration lista?
□ ¿SAT compliance validado?
□ ¿Qué cambios hay entre OTA 50 y OTA 132?
□ ¿Cuántos cambios/commits?
□ ¿Usuarios activos en producción?
□ ¿Bugs reportados pendientes?
```

### 2. COBRACHECK - Estado Actual

```
¿Dónde está CobraCheck?
├─ ❌ No iniciado (design only)
├─ 🟡 En desarrollo (parcial)
├─ 🟢 Completado
└─ ❓ Tu estado actual

Preguntas:
□ ¿Daniel comenzó código?
□ ¿Cuánto % completado?
□ ¿Qué tablas ya están?
□ ¿Qué componentes mobile/web?
□ ¿Google Maps integration?
□ ¿Bloqueantes actuales?
```

### 3. OTROS MÓDULOS - Confirmación

```
¿Hay avances en otros módulos?
├─ FacturaCheck: ¿Iniciado?
├─ BancoCheck: ¿Iniciado?
├─ CajaCheck: ¿Iniciado?
├─ InventarioCheck: ¿Iniciado?
└─ FlujoCheck: ¿Iniciado?

Para CADA módulo:
□ % completado
□ Quién trabaja
□ Bloqueantes
□ Próximos pasos
```

---

## 🎯 LISTA A: PENDIENTES DE JUAN (Decisiones + Config Externa)

### CRÍTICOS (Bloqueantes de código)

```
□ FACTURAMA CONTRATO
  ├─ Contactar: hola@facturama.com
  ├─ Necesitar: API keys (sandbox + production)
  ├─ Plazo: 1-2 días
  └─ Impacto: Daniel no puede codificar FacturaCheck sin esto
  STATUS: ⏳ PENDIENTE

□ FACTUROO CLARIFICACIÓN
  ├─ Contactar: hola@facturoo.com
  ├─ Pregunta: ¿Tienen API REST?
  ├─ Plazo: 48h
  └─ Impacto: Define PAC final (Facturama vs FACTUROO)
  STATUS: ⏳ PENDIENTE

□ BANCOS - DECISIÓN FINAL
  ├─ Opción A: Belvo solamente (simple, costo variable)
  ├─ Opción B: Híbrido BBVA + Santander + Belvo (complejo, gratis+Belvo)
  ├─ Opción C: APIs directas solo (máxima cobertura, máximo trabajo)
  └─ RECOMENDACIÓN: Opción B (híbrido)
  STATUS: ⏳ PENDIENTE DECISIÓN
  
  → Daniel bloqueado: no puede iniciar BancoCheck sin esto

□ MIGRACIÓN GASTOCHEKC SQL
  ├─ Checklist: GASTOCHECK_V1_COMPLETADO_HOY.md
  ├─ Duración: 4-5 días (no-destructivo)
  ├─ Bloqueante para: CobraCheck (comparten BD)
  └─ ¿YA EJECUTADA?
  STATUS: ❓ VERIFICAR
```

### MODERADOS (Afectan timeline)

```
□ CAJACHECK vs INVENTARIO - PRIORIDAD
  ├─ Opción A: Semana 6 (paralelo FacturaCheck últimas 2 semanas)
  ├─ Opción B: Mes 2 (después FacturaCheck, focus total)
  └─ RECOMENDACIÓN: Opción B (mejor calidad)
  STATUS: ⏳ PENDIENTE DECISIÓN

□ VISIBILIDAD MÓDULOS - APROBACIÓN
  ├─ Módulos nuevos = SOLO ADMIN VISIBLE (no usuarios)
  ├─ Cuando liberado = aparece para todos
  ├─ Auditoría completa de cambios
  └─ RECOMENDACIÓN: ✅ IMPLEMENTAR
  STATUS: ✅ APROBADO (solo codificación)

□ STRIPE INTEGRATION (GastoCheck)
  ├─ ¿YA CONFIGURADO?
  ├─ ¿Qué funciona / qué falta?
  └─ Impacto: Pagos + suscripciones
  STATUS: ❓ VERIFICAR ESTADO
```

### COORDINACIÓN (Comunicar a Daniel)

```
□ ENVIAR A DANIEL:
  ├─ Requisitos actualizados (OTA 132 vs diseño anterior)
  ├─ Decisiones finales (PAC, Bancos, Visibilidad)
  ├─ Arquitectura ACTUALIZADA (si OTA 132 cambió algo)
  ├─ Stack técnico confirmado
  └─ Timeline realista (basado en estado actual)
  STATUS: ⏳ DESPUÉS DE TUS RESPUESTAS
```

---

## 🎯 LISTA B: PENDIENTES QUE YO PUEDO RESOLVER (Código + Diseño)

### BANCOCHECK (Puedo hacer sin esperar tu decisión - estructura)

```
✅ PUEDO HACER:

1. Diseño detallado de tablas bank_movements
   ├─ Schema completo (fecha, monto, descripción, saldo)
   ├─ Índices optimizados
   ├─ RLS policies (usuario ve solo su banco)
   └─ Soft delete + audit trail
   ESFUERZO: 2-3 horas

2. Parser OFX/MT940 (fallback si APIs no funcionan)
   ├─ Implementación Node.js
   ├─ Tests unitarios
   ├─ Validaciones
   └─ Error handling
   ESFUERZO: 4-5 horas

3. Matching algoritmo (banco_tx vs gasto_tx vs cobro_tx)
   ├─ Lógica fuzzy matching
   ├─ Scoring por fecha, monto, referencia
   ├─ UI para revisar ambigüos
   └─ Tests de calidad
   ESFUERZO: 6-8 horas

4. Reconciliación automatizada
   ├─ Detectar diferencias saldos
   ├─ Alertas por discrepancias
   ├─ Reportes reconciliación
   └─ Auditoría
   ESFUERZO: 4-5 horas

5. Arquitectura Belvo vs APIs directas (ambos)
   ├─ Adapter pattern (agnóstico banco)
   ├─ OAuth flows (BBVA, Santander, Belvo)
   ├─ Error handling + retry logic
   └─ Tests
   ESFUERZO: 8-10 horas

6. Documentación técnica BancoCheck
   ├─ API endpoints
   ├─ Database schema
   ├─ Flujos usuarios
   ├─ Decisiones arquitectura
   └─ Setup para Daniel
   ESFUERZO: 4-5 horas

❌ NO PUEDO HACER (necesito TU decisión):
├─ Elegir Belvo vs Híbrido (TÚ DECIDES)
├─ Contratar APIs bancos (TÚ NEGOCIAS)
├─ Definir UX específica (TÚ con usuarios)
└─ Configurar credenciales (TÚ guardas secretos)
```

**TOTAL BancoCheck (sin tu decisión)**: 28-36 horas (3-4 días)

---

### FLUJOCHECK (Puedo hacer sin esperar tu decisión)

```
✅ PUEDO HACER:

1. Definir concepto FlujoCheck
   ├─ Qué es exactamente (dashboard? forecast? reporting?)
   ├─ Qué datos muestra (cash flow, proyecciones, análisis)
   ├─ Qué módulos integra (GastoCheck, CobraCheck, BancoCheck)
   └─ Mockups/wireframes
   ESFUERZO: 3-4 horas

2. Arquitectura de datos
   ├─ Qué cálculos son necesarios
   ├─ Dónde se alojan (vistas? computed fields?)
   ├─ Cómo se actualizan (real-time? batch?)
   └─ Schema si requiere tablas nuevas
   ESFUERZO: 3-4 horas

3. Diseño de dashboard
   ├─ KPIs (cash flow, runway, saldos)
   ├─ Gráficos (timeline, por módulo, por concepto)
   ├─ Filtros (período, empresa, tipo)
   ├─ Exportación (PDF, Excel)
   └─ Mockups finales
   ESFUERZO: 4-5 horas

4. Flujos de usuario
   ├─ Cómo llega usuario a FlujoCheck
   ├─ Qué acciones puede hacer
   ├─ Interactividad (drill-down, comparativas)
   └─ Mobile vs web
   ESFUERZO: 3-4 horas

5. Integraciones con otros módulos
   ├─ Cómo lee de GastoCheck (gastos)
   ├─ Cómo lee de CobraCheck (ingresos)
   ├─ Cómo lee de BancoCheck (saldos reales)
   ├─ Reconciliación entre módulos
   └─ Auditoría de cambios
   ESFUERZO: 5-6 horas

6. Documentación FlujoCheck
   ├─ Visión del producto
   ├─ Arquitectura técnica
   ├─ API endpoints
   ├─ Casos de uso
   └─ Mockups
   ESFUERZO: 3-4 horas

❌ NO PUEDO HACER (necesito TU decisión):
├─ Definir exactamente QUÉ ES (cash flow? forecast? analysis?)
├─ Quién lo necesita (admin? contador? todos?)
├─ Qué features priorizar (muchas opciones)
├─ Timeline (¿mes 2? ¿mes 3?)
└─ Usuarios de prueba para feedback
```

**TOTAL FlujoCheck (sin tu decisión)**: 21-27 horas (2.5-3 días)

---

## 🎨 OTROS MÓDULOS - Trabajo Disponible

### FACTURACHECK (Completar si falta)

```
✅ YA COMPLETADO (9 documentos, 6,500+ líneas):
├─ Punto de Partida
├─ Arquitectura Completa
├─ Voice of Customer
├─ Competitiva
├─ Features Admin
├─ Estrategia Producto
├─ Distribución Configurable
├─ PAC Analysis
└─ vs FACTUROO Features

❌ FALTA (si cambios en OTA 132):
├─ Actualizar requisitos Daniel (si nueva info)
├─ Actualizar roadmap (si timeline cambió)
└─ Actualizar arquitectura (si decisiones nuevas)

ESFUERZO: 0-4 horas (solo si hay cambios)
```

### COBRACHECK (Completar si falta)

```
✅ YA COMPLETADO:
├─ Arquitectura 30 páginas
├─ QA plan
├─ Diseño database
├─ Flujos usuario
├─ Permisos RLS
└─ Requisitos Daniel

❌ FALTA (si cambios OTA 132):
├─ Actualizar con nuevo estado
├─ Revisar si Google Maps aún necesario
├─ Actualizar features (si cambió)
└─ Actualizar timeline

ESFUERZO: 0-3 horas (solo si hay cambios)
```

### CAJACHECK (Completar)

```
✅ YA COMPLETADO:
├─ Arquitectura Estructural
├─ Resumen Ejecutivo

❌ FALTA:
├─ Diseño detallado (si TÚ decides Semana 6)
├─ Database schema completo
├─ POS UI/UX
├─ CFDI linking
├─ Integraciones (Factura, Gasto, Banco)
└─ Requisitos Daniel

ESFUERZO: 12-15 horas (si prioriza Semana 6)
```

### INVENTARIOCHECK (Completar)

```
✅ YA COMPLETADO:
├─ Arquitectura Retail
└─ Conceptos

❌ FALTA:
├─ Diseño detallado (si TÚ decide)
├─ Database schema
├─ Barcode/SKU management
├─ Alertas perecederos
├─ Integraciones POS/Gasto
└─ Requisitos Daniel

ESFUERZO: 12-15 horas (si prioriza Mes 2)
```

---

## 📊 MATRIZ COMPLETA: QUÉ HAGO YO

| Módulo | % Completado | Puedo Hacer | Necesito TU Decisión | Esfuerzo |
|--------|-------------|-------------|-------------------|----------|
| **GastoCheck** | ❓ Ver OTA 132 | Revisar cambios vs diseño | ¿Qué nuevas features? | 2-4h |
| **CobraCheck** | ❓ Ver estado | Revisar vs real | ¿Qué cambió? | 0-3h |
| **FacturaCheck** | 95% | Pulir + aguardar | Contrato Facturama | 0-4h |
| **BancoCheck** | 10% (base) | Diseño completo + parsers | ¿Belvo vs Híbrido? | 28-36h |
| **FlujoCheck** | 0% | Diseño + arquitectura | ¿Qué es exactamente? | 21-27h |
| **CajaCheck** | 20% | Completar si Semana 6 | ¿Prioritario? | 12-15h |
| **InventarioCheck** | 20% | Completar si Mes 2 | ¿Prioritario? | 12-15h |

---

## 🚀 RESUMEN: QUIÉN HACE QUÉ

### JUAN (TÚ)

```
🔴 CRÍTICOS (Hoy):
  1. Confirmar estado OTA 132 (qué cambió vs diseño)
  2. Contactar Facturama (contrato API)
  3. Verificar FACTUROO (¿API planeado?)
  4. Decidir PAC (Facturama vs esperar)
  5. Decidir Bancos (Belvo vs Híbrido)
  6. Verificar Migración GastoCheck (¿ejecutada?)

🟡 IMPORTANTES (Esta semana):
  7. Definir FlujoCheck (¿qué es exactamente?)
  8. Decidir CajaCheck/Inventario (Semana 6 vs Mes 2?)
  9. Comunicar a Daniel (decisiones + estado actual)
  10. Validar visibilidad módulos (aprobación)

🟢 COORDINACIÓN:
  11. Monitorear progreso Daniel
  12. Resolver bloqueantes que surjan
  13. Revisar incrementales (OTA por OTA)
```

### YO (Código + Análisis)

```
🟢 PUEDO HACER (en paralelo, sin esperar):

A. BancoCheck (28-36 horas)
   ├─ Diseño DB schema completo
   ├─ Parser OFX/MT940
   ├─ Matching algoritmo
   ├─ Reconciliación
   ├─ Adapter pattern (agnóstico banco)
   └─ Documentación técnica

B. FlujoCheck (21-27 horas)
   ├─ Definir concepto (si TÚ le dices qué es)
   ├─ Arquitectura datos
   ├─ Dashboard design
   ├─ Mockups finales
   └─ Documentación

C. Validación (2-8 horas)
   ├─ Revisar cambios GastoCheck vs OTA 50
   ├─ Revisar cambios CobraCheck vs diseño
   ├─ Actualizar requisitos si necesario

D. Testing + Docs (4-8 horas)
   ├─ Code quality checks
   ├─ Testing structure
   └─ Documentación técnica
```

---

## 📝 CHECKLIST: PARA AVANZAR

### HOY (Necesito de TI)

```
ANTES DE QUE CONTINUE:
□ Confirmar estado OTA 132 en GastoCheck
□ Confirmar % CobraCheck completado
□ Confirmar si Migración SQL ejecutada
□ Decidir PAC (Facturama vs esperar FACTUROO)
□ Decidir Bancos (Belvo vs Híbrido)
□ Definir FlujoCheck (¿cash flow? ¿forecast? ¿ambos?)
□ Priorizar CajaCheck/InventarioCheck (¿Semana 6 o Mes 2?)

SIN ESTO: Continúo con lo que puedo (BancoCheck base)
CON ESTO: Optimizo completamente
```

### PARALELO (Puedo empezar YA)

```
□ BancoCheck - Diseño DB + Parser OFX
□ FlujoCheck - Definir concepto (si TÚ me dices qué es)
□ Actualizar requisitos Daniel (si OTA 132 cambió algo)
□ Documentación técnica ambos módulos
```

---

## 🎯 SIGUIENTE PASO

**Responde en este documento** (o por mensaje):

```
OTA 132 STATUS:
├─ GastoCheck: [% completado, cambios clave, bloqueantes]
├─ CobraCheck: [% completado, qué está, qué falta]
├─ Otros: [si hay avances]
└─ Migración SQL: [¿ejecutada?]

DECISIONES:
├─ PAC: [Facturama ahora? o esperar?]
├─ Bancos: [Belvo solo? o Híbrido?]
├─ CajaCheck: [Semana 6? o Mes 2?]
├─ FlujoCheck: [¿Qué exactamente querés?]
└─ Visibilidad: [¿Aprobado admin-only?]
```

**Cuando respondas, puedo**:
- Actualizar arquitectura con estado real OTA 132
- Priorizar trabajo (BancoCheck + FlujoCheck + validaciones)
- Dar roadmap realista (basado en tu avance)
- Preparar Daniel con info correcta

---

**Documento**: 2026-07-04  
**Propósito**: Claridad 100% — sin confusiones OTA 50 vs OTA 132  
**Próximo**: Tus respuestas → Trabajo paralelo optimizado

