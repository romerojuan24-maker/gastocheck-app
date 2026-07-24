# ContaCheck · C0 — Estrategia de Adaptadores

> Cómo se conecta cada módulo a ContaCheck **sin modificarlo**. Un adaptador por módulo traduce su evento
> de confirmación al contrato normalizado (doc 6). Diseño no invasivo — **no se implementa en C0.**

## 1. Principio no invasivo
Los módulos **no cambian**. Cada adaptador:
- **Lee** las tablas/vistas existentes del módulo (nunca escribe en ellas).
- **Observa** el evento que ya confirma el hecho económico (transición de estado existente).
- **Emite** un `MovimientoContabilizable` (doc 6) hacia ContaCheck.

Esto respeta la restricción del C0 y evita acoplar la contabilidad a bugs/duplicaciones internas de cada
módulo: si mañana se limpia el modelo dual expenses/receipts, solo cambia el adaptador.

## 2. Mecanismo de captura del evento (3 opciones, a decidir en C1)

| Opción | Cómo | Pro | Contra |
|---|---|---|---|
| **A. Trigger → outbox** | trigger `AFTER UPDATE` en la tabla origen inserta en tabla `contacheck_outbox` | inmediato, transaccional | toca el módulo (añade trigger) → **roza lo invasivo** |
| **B. Vista + poll/materialización** | vista que expone eventos contabilizables; ContaCheck la lee | 100 % no invasivo | latencia; no captura estados intermedios |
| **C. Llamada explícita desde Edge Function** | las Edge Functions que ya confirman (authorize-expense, approve_suggestion) llaman a ContaCheck | preciso, en el punto exacto | requiere editar esas functions |

**Recomendación C0:** empezar con **B (vistas)** para no tocar nada, y evaluar **A (outbox)** solo donde la
latencia importe. BancoCheck ya tiene el patrón C parcialmente (`bancocheck_approve_suggestion`).

## 3. Adaptadores por módulo

### Adaptador GastoCheck
- **Fuente:** `expenses` (+ `receipts` para retenciones/IVA ampliado), `advances`, `reembolsos`, `accounts_payable`.
- **Eventos:** `authorized`, `invoice_applied`, `closed_in_policy`, `reembolsos.closed`, `accounts_payable.paid`, `advances` insert.
- **Resolución de tercero:** `suppliers` (por `supplier_id`) o texto libre `provider_rfc`.
- **Retos:** modelo dual → el adaptador debe leer montos fiscales del lado `receipts` cuando exista el enlace;
  retenciones solo en `receipts`.

### Adaptador BancoCheck (el más avanzado — plantilla de referencia)
- **Fuente:** `bank_transactions` ya clasificadas (`accounting_account_id`, `linked_client_id/supplier_id`).
- **Evento:** `bancocheck_approve_suggestion` (VoBo contador) — ya existe el gate de rol.
- **Ventaja:** trae la **contrapartida bancaria real** → base de la conciliación. Ya separa IVA 16 % (poliza.ts).
- **Rol de conciliación:** este adaptador cierra el ciclo — cruza el asiento de otros módulos con el banco real.

### Adaptador CobraCheck
- **Fuente:** `cobra_invoices` (devengo), `cobra_payments` (cobro), `cobra_movements` (campo).
- **Eventos:** insert factura (Dr CxC/Cr Ingresos+IVA por cobrar), insert pago (Dr Bancos/Cr CxC).
- **Bloqueos a resolver antes (brechas D5/D6/D8/D9):** sin retenciones, sin moneda, sin nota de crédito,
  sin tipo CFDI → el adaptador emitiría movimientos incompletos hasta cerrarlos.

### Adaptador NóminaCheck
- **Fuente:** `nomi_payroll` (+ `nomi_tax_withholdings`), vista `nomi_cashflow_commitments`.
- **Eventos:** `nomi_approve_payroll` (provisión), `paid_at` (pago).
- **Seguridad:** entrega `party_id`/id de empleado, **nunca RFC/NSS descifrados** (PII cifrada). El asiento
  de nómina se puede totalizar por póliza sin exponer PII individual.
- **Oportunidad:** al ser esquema nuevo y limpio, es el mejor candidato a "contable desde el diseño".

### FlujoCheck — **sin adaptador**
No es fuente contable (proyección). A futuro sería *consumidor* del libro de ContaCheck.

## 4. Antipatrón a evitar
- **No** re-mapear cuentas en cada adaptador (hoy `CATEGORY_ACCOUNT` está duplicado y hardcodeado en
  `poliza.ts` y `poliza-dia.tsx`, P8). El mapeo cuenta↔categoría debe vivir **una sola vez** en ContaCheck
  (reutilizando `accounting_category_map`), y los adaptadores solo pasan la categoría/tipo.

## 5. Idempotencia y reproceso
- Cada movimiento lleva `idempotency_key = module:entity:id:event`. ContaCheck ignora duplicados.
- Reproceso histórico: los adaptadores pueden re-emitir desde el estado actual (las vistas son idempotentes),
  útil para contabilizar el backlog al arrancar C1.

## 6. Orden de conexión sugerido (por madurez)
1. **BancoCheck** (ya clasifica a cuenta real + tiene VoBo) → plantilla y conciliación.
2. **GastoCheck** (motor contable existe, hay que cablearlo bien).
3. **NóminaCheck** (limpio; contable desde diseño).
4. **CobraCheck** (requiere cerrar brechas de datos primero).
