/**
 * Cross-Module Integrations — Índice
 *
 * Este archivo NO contiene lógica ejecutable. Las integraciones reales
 * viven directamente en los hooks de cada módulo (no aquí) — versión
 * anterior de este archivo tenía funciones stub con datos mock que
 * nunca se conectaron a nada (cero imports en todo el proyecto),
 * riesgo de confundir a futuro sobre qué es real.
 *
 * ── Implementadas (reales, 2026-07-05) ──────────────────────────────
 *
 * FlujoCheck ← GastoCheck + CobraCheck
 *   apps/mobile/app/flujocheck/hooks/useFlujo.ts → useFlujoItems()
 *   Combina cash_flow_items + cobra_invoices (pending/overdue, con nota
 *   de confianza por days_overdue) + reembolsos (pending/pending_auth)
 *   en tiempo de consulta.
 *
 * FlujoCheck ← BancoCheck (saldo real)
 *   apps/mobile/app/flujocheck/hooks/useFlujo.ts → useFlujoBalance()
 *   Suma bank_accounts.current_balance (tabla real, is_active=true).
 *
 * FacturaCheck → GastoCheck (pólizas contables)
 *   apps/mobile/app/facturacheck/hooks/useFacturaCheck.ts
 *     → useGenerateAccountingVoucher()
 *   Inserta en accounting_vouchers real, evita duplicados vía source_ids,
 *   registra auditoría en audit_log_facturacheck.
 *
 * FacturaCheck ↔ BancoCheck (vincular pago)
 *   apps/mobile/app/facturacheck/hooks/useFacturaCheck.ts
 *     → useMatchCfdiToBankTransaction()
 *   Busca bank_transactions candidatas por monto±2%/fecha, actualiza
 *   cfdi_documents.related_bank_txn_id real, registra auditoría.
 *
 * ── Pendiente, bloqueado por credenciales externas ──────────────────
 *
 * - OCR real de estados de cuenta (BancoCheck ImportTab) — Tesseract/AWS
 * - OAuth bancario real (BBVA/Santander/Belvo) — cuenta developer por banco
 * - Timbrado PAC real (FacturaCheck) — cuenta PAC + certificados CSD
 *
 * ── Evaluado y descartado ────────────────────────────────────────────
 *
 * - CobraCheck ↔ BancoCheck (matching de pago, mismo patrón que
 *   FacturaCheck): NO aplica de forma natural — cobra_movements confirma
 *   que CobraCheck cobra por visita de campo (efectivo/foto de
 *   comprobante), no por transferencia bancaria a conciliar. Requeriría
 *   validar el modelo de negocio antes de construir algo forzado.
 *
 * - GastoCheck → CobraCheck (sync de categorías de gasto): intención
 *   original poco clara, sin caso de uso concreto identificado — no
 *   se implementó para evitar construir algo especulativo.
 *
 * ── Exportación CONTPAQi ─────────────────────────────────────────────
 *
 * No implementada. Requiere definir el layout exacto que espera
 * CONTPAQi (columnas, encoding, catálogo de cuentas) — pendiente de
 * especificación antes de codificar.
 */

export {}
