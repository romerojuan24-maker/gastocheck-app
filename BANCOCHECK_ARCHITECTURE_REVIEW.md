# BANCOCHECK — ARCHITECTURE REVIEW & SUSPENSION
**Status**: ⏸️ **DISABLED — Lógica deficiente, revisión pendiente**

**Fecha de deshabilitación**: 2026-07-09  
**Razón**: Comprensión incompleta de conciliación bancaria; riesgo ACID/auditoría  
**Impacto**: Botón BancoCheck comentado en `apps/mobile/app/index.tsx:201`

---

## EL PROBLEMA

Yo (Claude) diseñé BancoCheck aplicando lógica de **GastoCheck** (clasificación contable) en lugar de entender realmente **conciliación bancaria** (trazabilidad de dinero).

**GastoCheck**: "¿Para QUÉ se gastó?" → cuenta contable  
**BancoCheck**: "¿A DÓNDE fue el dinero?" → seguimiento de flujo entre cuentas, clientes, proveedores

Estas son perspectivas **completamente distintas**.

---

## RIESGOS DETECTADOS

| Riesgo | Severidad | Observación |
|--------|-----------|-------------|
| **Lógica de conciliación** | 🔴 CRÍTICO | No entiendo cómo vincular movimientos a documentos de gasto/depósitos |
| **ACID compliance** | 🔴 CRÍTICO | Transacciones entre cuentas no garantizan atomicidad |
| **Idempotencia** | 🔴 CRÍTICO | Sin token único = riesgo de cargos dobles |
| **Auditoría** | 🟡 ALTO | No hay trace de quién reconcilió qué y cuándo |
| **Validaciones** | 🟡 ALTO | Validación de saldo/estatus incompleta |
| **UI/UX** | 🟡 ALTO | Categorías propuestas no reflejan realidad bancaria |

---

## QUÉ NECESITA REVISARSE

### 1. Modelo de Datos
- [ ] Entidad `cuentas` (accounts): fields correctos (número, cliente, tipo, divisa, saldo, estatus)
- [ ] Entidad `movimientos/transacciones`: estructura ACID-safe
- [ ] Relación movimiento ↔ documento gasto (factura)
- [ ] Relación movimiento ↔ depósito bancario (entrada)
- [ ] Tabla de auditoría: quién reconcilió, cuándo, qué cambió

### 2. Reglas de Negocio
- [ ] Validación de saldo antes de débito
- [ ] ACID guarantee para transferencias entre cuentas
- [ ] Idempotencia (token único por transacción)
- [ ] Estados válidos: pending, completed, failed, reconciled
- [ ] Qué significa "conciliado" realmente

### 3. APIs/Servicios
- [ ] `registrarMovimiento()` — depósitos, retiros, transferencias
- [ ] `obtenerHistorial()` — paginado, filtrable
- [ ] `conciliarMovimiento()` — marcar como verified
- [ ] `validarConciliacion()` — verificar integridad

### 4. UI/UX
- [ ] Resumen de cuenta (saldo disponible + retenido)
- [ ] Tabla de movimientos (verde = crédito, rojo = débito)
- [ ] Búsqueda avanzada (filtros por fecha, monto, tipo)
- [ ] Detalle del movimiento (folio, hora, concepto, comisiones)

---

## ARCHIVOS INVOLUCRADOS

| Archivo | Estado | Observación |
|---------|--------|-------------|
| `apps/mobile/app/bancocheck/` | 🟡 PARTIAL | Existe pero lógica deficiente |
| `apps/web/app/(dashboard)/bancocheck/` | 🟡 PARTIAL | Frontend sin lógica completa |
| `apps/mobile/lib/bancocheck-logic.ts` | ❌ DEFICIENT | Lógica simplista |
| `packages/shared/src/bancocheck.ts` | ⚠️ INCOMPLETE | Types existen pero no reflejan realidad |
| `supabase/migrations/*bancocheck*.sql` | ❌ REVIEW NEEDED | Revisar schema y RLS |
| `supabase/functions/*bancocheck*/` | ⚠️ INCOMPLETE | Edge functions sin lógica ACID |

---

## PRÓXIMOS PASOS

**Fase 1: Investigación & Educación** (Yo)
- [ ] Estudiar conciliación bancaria real (SAP, Xero, contadores)
- [ ] Entender cómo funciona control de cuentas bancarias
- [ ] Comprender diferencia entre entrada/salida y su trazabilidad

**Fase 2: Rediseño Arquitectónico** (Yo + Usuario)
- [ ] Rediseñar schema SQL con ACID guarantees
- [ ] Definir estados y transiciones válidas
- [ ] Especificar RLS policies por rol
- [ ] Documentar flujos: entrada, salida, transferencia

**Fase 3: Implementación** (Yo)
- [ ] Implementar migrations nuevas
- [ ] Reescribir logic en bancocheck-logic.ts
- [ ] Implementar Edge Functions ACID-safe
- [ ] Crear UI correcta

**Fase 4: Testing & Activation** (Yo + Usuario)
- [ ] Tests de ACID compliance
- [ ] Tests de conciliación
- [ ] Validación con datos reales
- [ ] Re-activar botón BancoCheck

---

## REFERENCIA PARA REDISEÑO

Estructura que necesita implementarse (proporcionada por usuario):

```
1. MODELO DE DATOS
   - Cuentas (ID, número, cliente, balance, tipo, divisa, estatus)
   - Movimientos (ID, cuenta_origen, cuenta_destino, tipo, categoría, monto, 
                   balance_resultante, estado, fecha, referencia_única)

2. REGLAS DE NEGOCIO
   - Validación de estatus de cuenta (activa/bloqueada/inactiva)
   - Validación de saldo (no negativo a menos que sobregiro permitido)
   - Idempotencia (token único para evitar cargos dobles)
   - Transaccionalidad ACID (dos cuentas = una transacción BD)

3. OPERACIONES
   - registrarMovimiento()
   - obtenerHistorial(filters)
   - conciliarMovimiento()

4. UI
   - Resumen de cuenta
   - Tabla de movimientos (colores: verde crédito, rojo débito)
   - Búsqueda avanzada
   - Detalle de movimiento
```

---

## NOTA IMPORTANTE

**No eliminar archivos** — solo deshabilitado.  
Cuando esté rediseñado y funcional, se re-activa el botón en `apps/mobile/app/index.tsx:201`.

---

**Creado**: 2026-07-09  
**Próxima revisión**: Cuando investigación de conciliación esté completa
