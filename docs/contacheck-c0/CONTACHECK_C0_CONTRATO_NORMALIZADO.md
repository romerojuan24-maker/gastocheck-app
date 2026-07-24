# ContaCheck · C0 — Contrato Normalizado

> El shape canónico de un **movimiento contabilizable**. Todos los adaptadores (doc 7) traducen su módulo
> a este contrato; ContaCheck solo conoce este contrato, nunca las tablas internas de cada módulo.
> **Esto es diseño en papel — no se implementa en C0.**

## 1. Objetivo del contrato
Desacoplar ContaCheck de la heterogeneidad de los módulos (modelo dual expenses/receipts, esquemas cobra
triplicados, monedas implícitas, retenciones dispersas). El contrato normaliza:
- **el tercero** (aunque hoy viva en 4 tablas distintas),
- **los montos fiscales** (subtotal, IVA trasladado/acreditable, IEPS, retenciones),
- **las dos fechas** (operación vs contable),
- **la moneda** (explícita siempre, aunque el origen asuma MXN),
- **el evento** que lo confirma.

## 2. Estructura (borrador conceptual)

```jsonc
MovimientoContabilizable {
  // Identidad e idempotencia
  "id": "uuid",                      // id propio de ContaCheck
  "company_id": "uuid",              // tenant (companies)
  "source_module": "gastocheck | bancocheck | cobracheck | nominacheck",
  "source_entity": "expense | receipt | bank_transaction | cobra_invoice | cobra_payment | nomi_payroll | ...",
  "source_id": "uuid",               // id en la tabla origen
  "idempotency_key": "module:entity:id:event",  // evita doble contabilización

  // Evento contable
  "event_type": "gasto_autorizado | cfdi_aplicado | cobro_recibido | factura_emitida | nomina_provisionada | nomina_pagada | comision_bancaria | transferencia_interna | cxp_pagada | reembolso_cerrado | anticipo_entregado",
  "estado_origen": "authorized",     // el estado que confirma el hecho (trazabilidad)

  // Fechas (D7)
  "fecha_operacion": "2026-07-23",   // cuándo ocurrió el hecho
  "fecha_contable": "2026-07-31",    // período contable de registro (default = fecha_operacion)

  // Moneda (D6) — SIEMPRE explícita
  "moneda": "MXN",
  "tipo_cambio": 1.0,                // a moneda funcional (MXN)

  // Tercero normalizado (D1) — resuelto por el adaptador desde suppliers/cobra_clients/cfdi_clients/nomi_employees
  "tercero": {
    "tipo": "proveedor | cliente | empleado | interno",
    "party_id": "uuid | null",       // apunta a parties cuando exista; hoy al id de la tabla origen
    "rfc": "XAXX010101000 | null",
    "regimen_fiscal": "601 | null",
    "nombre": "…"                    // razón social / nombre
  },

  // Montos fiscales (D5) — el adaptador rellena solo lo aplicable
  "montos": {
    "subtotal": 1000.00,
    "iva_trasladado": 160.00,        // ventas (CxC)
    "iva_acreditable": 160.00,       // compras/gastos
    "ieps": 0.00,
    "ish": 0.00,
    "retencion_iva": 0.00,
    "retencion_isr": 0.00,
    "otros_impuestos": [],           // extensible
    "total": 1160.00                 // subtotal + traslados − retenciones
  },

  // Referencia fiscal / documental
  "referencia": {
    "cfdi_uuid": "…| null",
    "tipo_cfdi": "I | E | P | N | null",   // Ingreso/Egreso/Pago/Nómina
    "folio": "…| null",
    "forma_pago_sat": "01 | 03 | … | null",
    "metodo_pago_sat": "PUE | PPD | null",
    "documento_url": "storage://… | null"
  },

  // Clasificación contable (sugerida; el contador confirma)
  "clasificacion": {
    "cuenta_sugerida": "5000-001 | null",  // código en accounting_accounts (el VIVO)
    "contrapartida_sugerida": "1010 | null",
    "centro_costo_id": "uuid | null",       // cost_centers
    "fuente_sugerencia": "regla | ai | manual"
  },

  // Contrapartida bancaria (para conciliación con BancoCheck)
  "banco": {
    "bank_account_id": "uuid | null",       // bank_accounts (cuenta autoritativa, D4)
    "bank_transaction_id": "uuid | null"     // si ya está conciliado
  },

  // Control
  "estado_contable": "propuesto | validado | contabilizado | cancelado",
  "requiere_vobo": true,                     // VoBo contador (patrón BancoCheck)
  "metadata": { }                            // jsonb libre para datos del origen
}
```

## 3. Reglas de partida doble (motor, fuera de C0)
El contrato es **entrada**; la póliza balanceada es **salida**. El motor (a diseñar en C1) aplica reglas
por `event_type` para producir líneas `debe`/`haber`, con IVA y retenciones como **líneas separadas**
(cierra la brecha P2) y contrapartida **configurable** (cierra P1), validando `Σdebe = Σhaber` (invariante
que `accounting_vouchers` ya exige por `CHECK`).

Ejemplo (gasto autorizado con CFDI, MXN):
```
Dr  5000-001 Gasto            1000.00
Dr  1180     IVA acreditable   160.00
    Cr 2010  Proveedores               1160.00
```

## 4. Invariantes del contrato
1. `Σ` de la póliza derivada debe balancear (debe=haber).
2. `idempotency_key` único por (módulo, entidad, id, evento) → **un evento no se contabiliza dos veces**.
3. `moneda` y `tipo_cambio` siempre presentes (aunque el origen asuma MXN).
4. PII del tercero (RFC de empleado) **nunca** en claro si viene de `nomi_*`: el adaptador de nómina
   entrega `party_id`/hash, no RFC descifrado (ver doc de seguridad).
5. Todo movimiento contabilizado deja rastro en `audit_logs` (`entity_type='contacheck_movimiento'`).

## 5. Qué NO es el contrato
- No es una tabla nueva de terceros ni de cuentas: **referencia** `accounting_accounts` y (a futuro) `parties`.
- No reemplaza los estados de los módulos: los **observa**.
- No incluye proyecciones (FlujoCheck queda fuera).

> Este contrato se valida con Juan y se refina en C1 antes de cualquier implementación.
