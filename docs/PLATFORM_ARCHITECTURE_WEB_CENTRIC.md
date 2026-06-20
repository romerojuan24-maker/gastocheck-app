# 🏢 CHECK SUITE — Arquitectura Web-Centric (Supervisores/Contadores)

**Versión:** 1.0  
**Fecha:** 2026-06-20  
**Concepto Clave:** Móvil = entrada de datos, WEB = consolidación + diferencial

---

## 🎯 Visión Correcta

### Antes (Incorrecto)
```
"Vamos a hacer una app de gastos"
└─ Usuarios: Compradores capturan en móvil
└─ Problema: ¿Luego qué? Supervisor no ve nada útil
```

### Ahora (Correcto)
```
"Vamos a consolidar la operación en WEB, móvil es entrada"
├─ Móvil (Compradores/Cobradores):
│  └─ GastoCheck: Captura gastos con OCR
│  └─ CobraCheck: Registra cobros
│  └─ Entrada rápida, simple, sin pensar
│
├─ WEB (Supervisor/Contador) ← EPICENTRO
│  ├─ Ve TODO consolidado
│  ├─ Genera pólizas automáticas ← DIFERENCIAL
│  ├─ Exporta a SAT/CONTPAQi ← DIFERENCIAL
│  ├─ Reconcilia banco ← DIFERENCIAL
│  ├─ Análisis IA ← DIFERENCIAL
│  └─ Gestiona inventarios ← DIFERENCIAL
│
└─ Resultado: Contador eficientiza 80% de su trabajo
```

---

## 📊 Dos Públicos, Una Plataforma

### 1. Público Móvil (Operarios - Entrada)

**GastoCheck Móvil:**
- ✅ Tomar foto ticket
- ✅ OCR automático
- ✅ Confirmar datos
- ✅ "Guardar" (1 tap)
- ✅ Listo (sin pensar)

**CobraCheck Móvil:**
- ✅ Registrar cliente (o buscar)
- ✅ Registrar pago recibido
- ✅ Tomar foto (comprobante)
- ✅ "Guardar" (1 tap)
- ✅ Listo

**Mentalidad:** Simplificar. El operario NO quiere pensar en contabilidad.

---

### 2. Público WEB (Supervisor/Contador) ← DONDE ESTÁ EL VALOR

**Dashboard Principal:**
```
┌─────────────────────────────────────────────┐
│  CONSOLIDACIÓN DE OPERACIONES (Hoy)        │
├─────────────────────────────────────────────┤
│                                             │
│  📊 KPIs Principales                       │
│  ├─ Gastos capturados: $15,500             │
│  ├─ Cobros recibidos: $22,000              │
│  ├─ Caja disponible: $125,500              │
│  ├─ Pólizas generadas: 47                  │
│  └─ Integraciones: GastoCheck, CobraCheck  │
│                                             │
│  💾 Datos por Módulo                       │
│  ├─ GastoCheck: 150 gastos (7 operarios)   │
│  ├─ CobraCheck: 23 pagos (3 clientes)     │
│  ├─ BancoCheck: $110k saldo (reconciliado)│
│  ├─ Inventarios: 245 items (sin stock)    │
│  └─ CheckIA: Análisis de patrones        │
│                                             │
│  📋 Acciones Rápidas                       │
│  ├─ [📥 Descargar pólizas (CONTPAQi)]     │
│  ├─ [📊 Reportes contables]                │
│  ├─ [🏦 Reconciliar banco]                 │
│  ├─ [📦 Stock bajo - Alertas]              │
│  └─ [🤖 Ver insights IA]                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Navegación WEB:**
```
Sidebar:
├─ 📊 Dashboard (inicio)
├─ 💰 GastoCheck
│  ├─ Todos los gastos (filtros avanzados)
│  ├─ Categorización automática
│  ├─ Análisis por proveedor/categoría
│  └─ [📥 Exportar Excel/CSV/CONTPAQi]
│
├─ 📞 CobraCheck
│  ├─ Clientes (RFC, deuda, risk score)
│  ├─ Facturas (pendientes, pagadas, vencidas)
│  ├─ Pagos (historial completo)
│  └─ [📥 Generar póliza de cobro]
│
├─ 🏦 BancoCheck (OTA 1.2)
│  ├─ Cuentas conectadas (Plaid)
│  ├─ Movimientos (reconciliados vs no)
│  ├─ Flujo de efectivo (gráficos)
│  └─ [🔗 Reconciliar con GastoCheck + CobraCheck]
│
├─ 💵 FlujoCheck (Futuro)
│  ├─ Proyección de caja (30/60/90 días)
│  ├─ Escenarios (optimista/pesimista)
│  ├─ Alerta saldo bajo
│  └─ Reporte ejecutivo
│
├─ 🤖 CheckIA (Futuro)
│  ├─ Análisis de gastos (anomalías)
│  ├─ Predicción demanda
│  ├─ Clustering clientes (riesgo)
│  └─ Recomendaciones
│
├─ 📦 Inventarios (Futuro)
│  ├─ Stock actual
│  ├─ Alertas (bajo, vencido)
│  ├─ Costo promedio
│  └─ Rotación
│
└─ ⚙️ Configuración
   ├─ Usuarios (permisos)
   ├─ Empresas (multi-tenant)
   ├─ Integraciones (SAT, Stripe, bancos)
   └─ Exportaciones automáticas
```

---

## 🎁 Diferencial: Pólizas Automáticas

**Esto es lo que diferencia de cualquier otro SaaS:**

### Flujo Actual (SIN CHECK SUITE)
```
Operario captura gasto en Excel/Sheets
  ↓
Contador:
  1. Abre Excel
  2. Lee cada gasto
  3. Busca RFC del proveedor
  4. Determina cuenta contable
  5. Crea póliza en CONTPAQi manualmente
  6. Valida: Debit = Credit
  7. Envía a SAT

⏱️ Tiempo: 30-60 minutos por día (repetitivo, error-prone)
```

### Flujo CON CHECK SUITE (Diferencial)
```
Operario captura gasto en GastoCheck
  ↓
Sistema automáticamente:
  1. Extrae RFC del OCR
  2. Categoriza gasto (IA)
  3. Asigna cuenta contable (regla)
  4. GENERA PÓLIZA automáticamente
  5. Valida: Debit = Credit
  6. Listo para exportar a SAT
  
Contador abre WEB, ve:
  [📥 Descargar pólizas (47 generadas hoy)]
  
  ✅ Click → Descarga CSV/Excel/CONTPAQi
  ✅ Importa a SAT en 2 minutos
  
⏱️ Tiempo: 2-5 minutos por día (automático, validado, zero error)

EFICIENCIA: 10-15x más rápido
```

---

## 📱 Móvil vs WEB — Responsabilidades Claras

### MÓVIL (Operario/Comprador/Cobrador)

**GastoCheck Móvil:**
```
┌─────────────────┐
│ Tomar foto      │
│ ticket          │
└────────┬────────┘
         ↓
┌─────────────────┐
│ OCR automático  │
│ (Gemini Vision) │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Confirmar datos │
│ (edit si falla) │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Tap "Guardar"   │
│ (1 segundo)     │
└────────┬────────┘
         ↓
    ✅ Listo
```

**Responsabilidad del operario:** Tomar foto clara. PUNTO.
**No piensa en:** Contabilidad, categorías, pólizas, etc.

---

### WEB (Supervisor/Contador) ← DONDE OCURRE LA MAGIA

**Dashboard Consolidación:**
```
Contador abre WEB todas las mañanas:
  ├─ [💰 150 gastos capturados] ← De 7 operarios
  ├─ [📞 23 pagos recibidos] ← De clientes
  ├─ [🏦 $110k en banco] ← Reconciliado automáticamente
  └─ [📥 Descargar 47 pólizas] ← Ready para SAT
  
Actions:
  1. Click "Descargar pólizas" (30 segundos)
  2. Abre CONTPAQi
  3. Importa CSV (1 minuto)
  4. Envía a SAT (1 minuto)
  5. ✅ Done

**Total tiempo: 3 minutos vs 60 minutos (manual)**
```

---

## 🗺️ Roadmap: Módulos por Orden

### OTA 1.0: GastoCheck (Diferencial - Entrada de Datos)
```
Móvil:
├─ Capturar gasto (OCR)
├─ Foto + datos extraídos
└─ Guardar

WEB:
├─ Dashboard: Ver todos los gastos
├─ Categorización automática
├─ Validación de duplicados
├─ Búsqueda + filtros
├─ [📥 Exportar Excel/CSV/CONTPAQi]
└─ Pólizas básicas
```

### OTA 1.1: CobraCheck (Complemento)
```
Móvil:
├─ Registrar cliente
├─ Registrar pago recibido
└─ Foto comprobante

WEB:
├─ Dashboard: Clientes + facturas + pagos
├─ Risk scoring (0-100)
├─ Cartera vencida (alertas)
├─ [📥 Exportar pólizas de cobro]
└─ Integración con GastoCheck (caja cuadra)
```

### OTA 1.2: BancoCheck (Reconciliación)
```
WEB:
├─ Conectar banco (Plaid)
├─ Ver movimientos
├─ Reconciliación automática
│  └─ Movimiento = Gasto de GastoCheck?
│  └─ Movimiento = Pago de CobraCheck?
├─ Flujo de efectivo (gráficos)
├─ Alertas: "Caja falta $X"
└─ [📥 Exportar movimientos + reconciliación]
```

### OTA 1.3: FlujoCheck (Cash Flow)
```
WEB:
├─ Proyección de caja (30/60/90 días)
├─ Basado en:
│  ├─ Gastos recurrentes (histórico)
│  ├─ Cobros esperados (de clientes)
│  └─ Tendencia
├─ Escenarios (optimista/pesimista/realista)
├─ "Caja dura X días a este ritmo"
└─ Alertas: "En 30 días caja < $50k"
```

### OTA 1.4: CheckIA (Análisis Inteligente)
```
WEB:
├─ Análisis de gastos:
│  ├─ Anomalías ("Gasto inusual: $50k compra")
│  ├─ Clustering ("Cliente X es riesgo alto")
│  └─ Predicción ("Próximos 30 días: $20k gastos")
│
├─ Análisis de demanda:
│  ├─ Clientes que crecen
│  ├─ Clientes que decrecen
│  └─ Churn risk
│
└─ Recomendaciones:
   ├─ "Negociar con proveedor A (gastaste $80k)"
   ├─ "Cobrar a cliente B (deuda: 60 días)"
   └─ "Caja baja: reducir compras"
```

### OTA 1.5: Inventarios (Gestión)
```
WEB:
├─ Stock actual (por item)
├─ Alertas:
│  ├─ Stock bajo ("Papel: 2 paquetes, reorder a 5")
│  ├─ Vencimiento próximo
│  └─ Rotación lenta
├─ Costo promedio (FIFO/LIFO)
├─ Análisis: "Top 10 items por costo"
└─ Integración: Costo en gastos, análisis en CheckIA
```

### OTA 2.0+: Más módulos
```
├─ FacturaCheck (CFDI automático)
├─ VendorCheck (Gestión proveedores)
├─ ClientCheck (CRM)
├─ PayrollCheck (Nómina)
└─ ...y así cada uno por uno
```

---

## 🏗️ Arquitectura Integral = Base para TODO

```
Una tabla central: movimientos_financieros
  ├─ Captura TODOS los eventos de dinero
  ├─ Cada módulo es una VISTA de esta tabla
  └─ Integración automática entre módulos

Ejemplo:
  Operario captura gasto en GastoCheck → Insert movimiento
  Contador ve en WEB dashboard → Select movimiento
  Sistema genera póliza → Insert póliza (referencia mismo movimiento)
  Operario cobra pago en CobraCheck → Update movimiento (tipo=INGRESO)
  Contador ve en WEB: "Gasto pagado + Pago recibido = Caja cuadra"
```

**Por eso la arquitectura integral es CRÍTICA, no optional.**

---

## 📊 Métricas de Éxito (Por Módulo)

### GastoCheck (OTA 1.0)
```
Operarios:
✅ Capturan > 10 gastos/día
✅ OCR accuracy > 95%
✅ No piensan en contabilidad (simple)

Contador:
✅ Descarga pólizas en < 2 minutos
✅ Importa a SAT en < 1 minuto
✅ Ahorra 50 minutos/día vs manual
```

### CobraCheck (OTA 1.1)
```
Operarios:
✅ Registran pagos (1 tap)

Contador:
✅ Ve cartera completa
✅ Alertas de clientes vencidos
✅ Caja cuadra 100% (gasto + cobro + banco)
```

### BancoCheck (OTA 1.2)
```
Contador:
✅ Caja esperada vs real cuadra
✅ 85%+ de movimientos auto-reconciliados
✅ Sabe qué falta pagar/cobrar
```

### FlujoCheck (OTA 1.3)
```
Contador:
✅ Proyección de caja precisa
✅ Alertas de saldo bajo (proactivo)
✅ Toma decisiones basado en proyección
```

---

## 💡 Por Qué Esto Gana

**Contra apps de gastos genéricas:**
```
Competidor 1: "Captura gastos en móvil"
  → ¿Luego qué?
  → Contador sigue haciendo pólizas manualmente
  
Competidor 2: "Facturación online"
  → Sirve si tienes muchas facturas
  → No consolida gastos + cobros + banco
  
CHECK SUITE:
  → Captura gastos en móvil (GastoCheck)
  → Registra cobros en móvil (CobraCheck)
  → Consolidador automático en WEB
  → Pólizas generadas automáticamente
  → Banco reconciliado automáticamente
  → IA analiza patrones
  → Inventarios integrados
  
Diferencial: Contador eficientiza 80% del trabajo (no captura)
```

---

## 🎯 Plan Ejecutable

### Semana 1 (OTA 1.0 + 1.1)
```
GastoCheck móvil + WEB dashboard ✅
CobraCheck móvil + WEB dashboard ✅
Pólizas automáticas (diferencial) ✅
```

### Semana 2-4 (Arquitectura integral)
```
Refactor a movimientos_financieros (sin downtime)
CFDI import (integral)
Usuarios piden más módulos
```

### Mes 2+ (Módulos sucesivos)
```
BancoCheck (reconciliación)
FlujoCheck (proyección)
CheckIA (análisis)
Inventarios (gestión)
```

---

## ✅ Checklist Antes de Semana 1

- [ ] GastoCheck móvil: Captura + guardar
- [ ] GastoCheck WEB: Dashboard + exportación
- [ ] CobraCheck móvil: Registrar pago
- [ ] CobraCheck WEB: Clientes + facturas + payos
- [ ] Pólizas automáticas (diferencial)
- [ ] Exportación SAT (CONTPAQi)
- [ ] Documentación para contador
- [ ] Testing con contador real

---

**El epicentro es el WEB consolidado. Móvil es solo entrada. Pólizas automáticas es el diferencial.**
