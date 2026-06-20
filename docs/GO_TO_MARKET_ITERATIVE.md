# 🚀 CHECK SUITE — Go-to-Market Strategy (Iterativo + Centrado en Calidad)

**Versión:** 1.0  
**Fecha:** 2026-06-20  
**Estrategia:** Liberación por módulos, depuración en vivo, adopción gradual

---

## 🎯 Visión Estratégica

**No es:** "Lanzar todo el mismo día con características a medias"  
**Es:** "Lanzar módulos diferenciadores 100% funcionales, usuarios piden suite completa"

```
FASES:

FASE 1 (Semana 1): GastoCheck MVP ← DIFERENCIAL, DEBE SER PERFECTO
  └─ Usuarios: Operarios en campo (1-5 personas reales)
  └─ Feedback: En vivo, diario
  └─ Objetivo: Cero errores críticos, máxima calidad

FASE 2 (Semana 2): CobraCheck ← IMPORTANTE, SÓLIDO
  └─ Usuarios: Administradores + operarios
  └─ Prerequisito: GastoCheck estable
  └─ Objetivo: Integración con GastoCheck funcionando

FASE 3 (Semana 3-4): Arquitectura integral refactor
  └─ Sin interrumpir GastoCheck + CobraCheck en vivo
  └─ Usuarios no ven cambio (refactor interno)
  └─ Prerequisito: GastoCheck + CobraCheck estables

FASE 4 (Mes 2): BancoCheck + FacturaCheck
  └─ Usuarios pidieron desde Semana 1
  └─ Arquitectura integral lista
  └─ Adopción automática (suite completa)
```

---

## 📱 FASE 1: GastoCheck OTA 1.0 — MVP Diferencial

### ¿Qué hace diferente a GastoCheck?

```
Problema: Contadores capturan gastos MANUALMENTE en Excel/Sheets
  └─ Lento: 5 min por gasto
  └─ Propenso a errores: Montos mal, fechas equivocadas, duplicados
  └─ Sin trazabilidad: "¿Quién capturó esto?"

GastoCheck resuelve:
  ✅ OCR automático (ticket → datos en 2 segundos)
  ✅ Zero-touch (usuario solo toma foto)
  ✅ Auditoría completa (quién, cuándo, qué foto)
  ✅ Exportación automática (Excel, CSV, SAT)

Ganancia: 10x más rápido, 10x más preciso
```

### Checklist de Calidad para OTA 1.0

```
FUNCIONALIDAD:
✅ OCR extrae correctamente:
   - Monto (±0.01)
   - Fecha (YYYY-MM-DD)
   - Concepto (descriptivo)
   - RFC proveedor (13 caracteres)
   - UUID CFDI (si es timbrado)

✅ Categorización automática:
   - "Papelería" → Categoría "Gastos Administrativos"
   - "Gasolina" → Categoría "Combustibles"
   - RFC farmacéutica → Categoría "Farmacéutica"

✅ Búsqueda + Filtros:
   - Por fecha: Rango personalizado
   - Por concepto: Búsqueda text
   - Por cantidad: Min/Max
   - Por categoría: Multi-select

✅ Exportación:
   - Excel: Formato contable
   - CSV: Compatible CONTPAQi
   - PDF: Reporte con imágenes

✅ Multi-empresa:
   - Usuario cambia empresa sin recargar
   - Datos completamente aislados

✅ Permisos:
   - Admin: Ve todo, puede editar
   - Supervisor: Ve todo, lee
   - Capturista: Solo captura

ERRORES A EVITAR:
❌ OCR falla en tickets borrosos
  → Solución: Mostrar preview al usuario, permitir edición
  
❌ Exportación omite campos
  → Solución: Testing con contadores reales (pedir feedback)
  
❌ Categorización incorrecta
  → Solución: Permitir cambio manual, aprender del usuario
  
❌ Performance lento (carga > 3 seg)
  → Solución: Optimizar queries, índices BD
  
❌ Imagen grande no sube
  → Solución: Compresión automática, mostrar progreso
```

### Plan de Liberación GastoCheck

```
PASO 1: Liberación Internal (Equipo)
  Cuando: Viernes 20 - Sábado 21
  Usuarios: 3-5 personas del equipo
  Objetivo: Encontrar bugs obvios
  Duración: 12-24 horas
  
  Checklist:
  - [ ] Capturar 20 tickets variados
  - [ ] Probar exportación (Excel + CSV)
  - [ ] Probar multi-empresa
  - [ ] Probar en móvil + web
  - [ ] Reportar bugs críticos
  
  Si hay bugs críticos: Hotfix + reintentar
  Si está ok: Pasar a Fase 2

PASO 2: Liberación Beta (Usuarios Reales - Operarios)
  Cuando: Lunes 23 - Viernes 27 (5 días)
  Usuarios: 1-3 operarios reales (en el terreno)
  Objetivo: Validar con caso real de uso
  Duración: 5 días, feedback diario
  
  Setup:
  - [ ] Crear cuenta usuario para cada operario
  - [ ] Entrenar en 15 minutos (muy simple)
  - [ ] Dar teléfono con app instalada
  - [ ] Recopilar feedback diario (WhatsApp/Slack)
  
  Feedback esperado:
  - "La foto se ve borrosa, pero el OCR la lee"
  - "¿Puedo capturar un ticket sin fecha? Olvidé escribirla"
  - "¿Dónde está el botón de exportar?"
  
  Bugs encontrados:
  - Severidad CRÍTICA: Hotfix inmediato
  - Severidad ALTA: Hotfix en 24h
  - Severidad MEDIA: Log para próxima versión
  - Severidad BAJA: Wishlist futura

PASO 3: Liberación General (Contador/PM)
  Cuando: Viernes 27+
  Usuarios: Contadores + administradores
  Objetivo: Adopción productiva
  
  Prerequisito: Cero bugs CRÍTICOS, máximo 2 ALTOS en logeo
  
  Documentación:
  - [ ] Manual en PDF (5 páginas máximo)
  - [ ] Video tutorial (2 minutos)
  - [ ] FAQ: "¿Qué pasa si...?"
  - [ ] WhatsApp support (respuesta < 2 horas)

PASO 4: Retroalimentación Continua
  Cuando: Semana 2+
  Métricas:
  - Gasto promedio capturado por usuario/día
  - % OCR accuracy
  - Errores reportados vs resueltos
  - NPS (Net Promoter Score)
  
  Ajustes:
  - Weekly: Fix bugs ALTOS
  - Monthly: Mejoras basadas en feedback
  - Quarterly: Nuevas features (según demanda)
```

---

## 📞 FASE 2: CobraCheck OTA 1.1 — Complemento Sólido

### ¿Qué hace diferente a CobraCheck en contexto de GastoCheck?

```
Problema: Usuario captura gastos en GastoCheck, pero ¿y si compra a crédito?
  └─ ¿Cuándo pago?
  └─ ¿A quién le debo?
  └─ ¿Cuánto le debo?

Problema adicional: Usuario vende a clientes, ¿cuándo cobran?
  └─ ¿Quién me debe?
  └─ ¿Cuánto caja esperada?
  └─ Automatizar pólizas cuando llega dinero

CobraCheck resuelve (en contexto):
  ✅ Registrar clientes (RFC, límite crédito)
  ✅ Registrar facturas (automática del sistema)
  ✅ Registrar pagos (cuando llega dinero)
  ✅ Pólizas automáticas (cuando se paga)
  ✅ Risk scoring (¿cuál cliente es riesgo?)

Integración con GastoCheck:
  ✅ Gasto → Pago en banco → Póliza
  ✅ Factura → Pago en banco → Póliza
  ✅ CAJA CUADRA (todos los gastos/ingresos capturados)
```

### Checklist de Calidad para OTA 1.1

```
Prerequisito: GastoCheck 100% estable (Fase 1 completada)

FUNCIONALIDAD (NUEVA):
✅ Crear cliente:
   - RFC (13 caracteres, validado)
   - Nombre, email, teléfono
   - Límite crédito disponible
   - Risk scoring automático (0-100)

✅ Crear factura:
   - Automática cuando registras pago (option 1)
   - Manual si prefieres (option 2)
   - Líneas de items
   - Conceptos auto-categorizados

✅ Registrar pago:
   - Cuando cobras (deposito llega)
   - Crear póliza automáticamente
   - Marcar factura como "PAGADA"

✅ Validaciones:
   - RFC no duplicado por empresa
   - Email válido (si aplica)
   - Crédito no excedido
   - Pago no supera factura

✅ Integración GastoCheck:
   - Si compras A CRÉDITO a proveedor:
     └─ Registra gasto en GastoCheck
     └─ Sistema crea "deuda a proveedor" (similar a CobraCheck)
     └─ Cuando pagas: Reconciliación automática

ERRORES A EVITAR:
❌ RFC duplicado (no validado bien)
  → Solución: Búsqueda en tiempo real, alert si existe
  
❌ Factura sin cliente
  → Solución: Obligar seleccionar cliente antes de crear factura
  
❌ Pago sin factura asociada
  → Solución: Permitir pago huérfano, pero alertar
  
❌ Póliza creada incorrectamente
  → Solución: Validación: Debit = Credit

INTEGRACIÓN CON GASTOCHECK:
✅ Usuario ve flujo completo:
   GastoCheck: "Compra papel $2,500"
   CobraCheck: "Proveedor A debe pagar $2,500"
   BancoCheck: "Pagué $2,500 el 17/6"
   Póliza: "Debita banco, creditea gasto"
```

### Plan de Liberación CobraCheck

```
Prerequisito: GastoCheck en FASE 2+ (usuarios reales usando)

PASO 1: Liberación Interna (Equipo)
  Cuando: Martes 24 - Miércoles 25
  Usuarios: 3-5 personas del equipo
  Objetivo: Validar flujo básico
  Duración: 24-48 horas
  
  Testing:
  - [ ] Crear 5 clientes variados
  - [ ] Crear 10 facturas
  - [ ] Registrar 5 pagos
  - [ ] Verificar pólizas creadas
  - [ ] Testing integración GastoCheck

PASO 2: Liberación Beta (Usuarios Reales - Administradores)
  Cuando: Jueves 26 - Viernes 27
  Usuarios: 1-2 administradores/contadores
  Objetivo: Validar con datos reales
  Duración: 2-3 días
  
  Feedback:
  - ¿Es fácil registrar cliente?
  - ¿Las pólizas se crean correctamente?
  - ¿La integración con GastoCheck funciona?

PASO 3: Liberación General
  Cuando: Lunes 30+
  Prerequisito: Cero bugs CRÍTICOS
```

---

## 🔄 FASE 3: Arquitectura Integral Refactor (Paralelo)

### Timing

```
Mientras GastoCheck + CobraCheck están en FASE 2 (usuarios reales):
  └─ Equipo desarrollo en PARALELO:
     ├─ Crear tabla movimientos_financieros
     ├─ Backfill datos existentes
     ├─ Crear CFDI import Edge Functions
     ├─ Refactorizar OCR en packages/shared
     └─ Testing exhaustivo
  
  Objetivo: Tener refactor listo para OTA 1.2, SIN interrumpir usuarios

Sin usuarios viendo cambios internos.
Cuando está listo: Se "activa" en OTA 1.2.
```

### Parallelización

```
EQUIPO A (2-3 devs): GastoCheck + CobraCheck QA en vivo
  └─ Bugfixes diarios basados en feedback de usuarios
  └─ Optimizaciones de performance
  └─ Ajustes UX

EQUIPO B (1-2 devs): Arquitectura integral refactor
  └─ Crear movimientos_financieros
  └─ Backfill datos
  └─ CFDI import functions
  └─ Testing

Sin bloqueos, trabajo paralelo.
```

---

## 🏦 FASE 4: BancoCheck OTA 1.2 — Cuando Arquitectura Está Lista

### Prerequisitos

```
✅ GastoCheck estable (usuarios en producción > 1 mes)
✅ CobraCheck integrado (usuarios adoptaron)
✅ Arquitectura integral lista (movimientos_financieros)
✅ CFDI import funcional
✅ OCR refactorizado en packages/shared
```

### Liberación

```
PASO 1: Integración arquitectura
  └─ Migrar datos a movimientos_financieros
  └─ Usuarios NO ven cambio (mismo comportamiento)

PASO 2: CFDI import
  └─ Liberar para GastoCheck + CobraCheck
  └─ Usuarios pueden importar XML del SAT
  └─ Automáticamente vinculado a gastos/facturas

PASO 3: BancoCheck
  └─ Conectar banco (Plaid o PDF)
  └─ Reconciliación automática
  └─ Usuarios ven TODO integrado
```

---

## 📊 Métricas de Éxito por Fase

### FASE 1: GastoCheck

```
KPI:
✅ Adopción: 100% de operarios usando diariamente
✅ OCR accuracy: > 95% (monto + fecha + concepto)
✅ Performance: Captura < 5 segundos
✅ Errores críticos: 0 (max 2 altos)
✅ NPS: > 50 (al menos "neutral")
✅ Uso: > 10 gastos/operario/día

Indicador de LISTO para Fase 2:
✅ NPS > 50
✅ Bugs CRÍTICOS = 0
✅ Adopción diaria > 80%
```

### FASE 2: CobraCheck

```
KPI:
✅ Integración: Gasto + Pago vinculados automáticamente
✅ Adopción: Administrador usando diariamente
✅ Pólizas: 100% creadas correctamente
✅ Errores críticos: 0
✅ NPS: > 50

Indicador de LISTO para Fase 3:
✅ NPS > 50
✅ Bugs CRÍTICOS = 0
✅ GastoCheck + CobraCheck funcionando juntos
```

### FASE 3: Refactor Interno

```
KPI:
✅ Cero downtime
✅ Datos migrados 100%
✅ Validación: datos pre-refactor = post-refactor
✅ Performance mejorada (queries más rápidas)

Indicador de LISTO para Fase 4:
✅ Testing exhaustivo pasando
✅ Usuarios no notan cambio
```

### FASE 4: BancoCheck

```
KPI:
✅ Reconciliación: > 85% automática
✅ Caja cuadra: 100% (teoría vs banco)
✅ Duplicados: 0 (CFDI validation)
✅ Adopción: > 50% empresas conectan banco

Indicador de ÉXITO:
✅ Usuarios piden suite completa
✅ Adopción suite > 70% (antes estaban en 1-2 módulos)
```

---

## 📅 Timeline Realista

```
SEMANA 1 (Jun 21-27):
├─ Sábado 21: OTA 1.0 GastoCheck deploy
├─ Lunes 23: Usuarios reales (operarios) usando
├─ Martes 24: OTA 1.1 CobraCheck deploy
├─ Miércoles 25: Usuarios reales (administradores) usando
├─ Jueves-Viernes: Depuración basada en feedback
└─ Fin de semana: Compilar feedback

SEMANA 2 (Jun 28-Jul 4):
├─ Lunes-Viernes: Bugfixes diarios, mejoras UX
├─ Paralelo: Equipo B iniciando refactor arquitectura
├─ Viernes: Evaluación: ¿Listo para Fase 2?
└─ Análisis: ¿Qué pidieron usuarios?

SEMANA 3-4 (Jul 7-18):
├─ Depuración continua GastoCheck + CobraCheck
├─ Paralelo: Arquitectura integral 60% lista
├─ Evaluación: ¿Listos para refactor?
└─ Testing previo a refactor

SEMANA 5+ (Jul 21+):
├─ Refactor arquitectura (SIN downtime)
├─ CFDI import integración
├─ Preparación BancoCheck
└─ Adopción suite completa por usuarios
```

---

## 🎯 Adopción Estratégica

### Por qué esta secuencia funciona:

```
GastoCheck (DIFERENCIAL):
  └─ Usuarios ven valor INMEDIATO
  └─ "¡Reduce 10x el tiempo de captura!"
  └─ Adopción orgánica

CobraCheck (COMPLEMENTARIO):
  └─ Usuarios que usan GastoCheck piden CobraCheck
  └─ "¿Y si compro a crédito?" → Necesitan tracking
  └─ Integración obvia

BancoCheck (INTEGRADOR):
  └─ Usuarios piden visibilidad de pagos en banco
  └─ "¿Ya me pagó el cliente?" → Necesitan reconciliación
  └─ Suite completa

CRECIMIENTO:
Semana 1: GastoCheck (1 módulo)
Semana 2: GastoCheck + CobraCheck (2 módulos)
Semana 4: GastoCheck + CobraCheck + arquitectura (2 módulos, cimientos mejorados)
Semana 6: GastoCheck + CobraCheck + BancoCheck + CFDI (4 módulos, suite completa)

Usuarios nunca ven "rotura", solo evolución natural.
Adopción es natural, no forzada.
```

---

## 🚨 Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|-----------|
| OCR falla en producción | MEDIA | Preview usuario + edición manual + logeo |
| Usuario reporta bug crítico | ALTA | Hotfix SLA < 4 horas, comunicación proactiva |
| Refactor causa downtime | BAJA | Testing exhaustivo + rollback plan |
| Usuarios no adoptan CobraCheck | BAJA | GastoCheck será tan bueno que lo piden |
| RFC validation deja fuera usuarios legítimos | MEDIA | Permitir override manual + feedback loop |

---

## ✅ Checklist de Inicio (Mañana)

### GASTOCHECK (Prioridad 1)

- [ ] Testing interno (viernes 20)
- [ ] Validar OCR con 20+ tickets reales
- [ ] Deploy OTA 1.0 (sábado 21)
- [ ] Entregar a 3 operarios (lunes 23)
- [ ] Recopilar feedback diario
- [ ] Hotfix cualquier bug CRÍTICO

### COBRACHECK (Prioridad 2)

- [ ] Testing interno (miércoles 25)
- [ ] Deploy OTA 1.1 (lunes 24)
- [ ] Validar con 1-2 administradores (jueves 26)
- [ ] Recopilar feedback
- [ ] Integración con GastoCheck funcionando

### ARQUITECTURA REFACTOR (Prioridad 3, Paralelo)

- [ ] Equipo B inicia después del OTA 1.0 (lunes 23)
- [ ] Sin bloquear usuarios en Fase 1 + 2
- [ ] Testing exhaustivo antes de activar
- [ ] Rollback plan documentado

---

## 💡 Mentalidad Clave

**"Better is the enemy of done."**

No perfeccionar GastoCheck por 2 meses esperando que sea perfecto.  
Liberar cuando está **bueno**, luego iterar con **usuarios reales**.

Feedback real > Predicciones internas

Usuarios dirán qué falta y qué sobra.  
Entonces ajustamos.  
Entonces evoluciona a suite completa.

---

**Esto es producto ágil real, no waterfall esperando el día perfecto.**
