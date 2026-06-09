// GastoCheck — Lógica de comprobantes (receipts)
import type { Receipt, OcrResult, DuplicateStatus, ReceiptStatus, RiskScore, RiskFactor, RiskLevel } from './types';

// ── Metadatos de estado ──────────────────────────────────────────────────────

export const RECEIPT_STATUS_META: Record<ReceiptStatus, { label: string; color: string }> = {
  captured:          { label: 'Capturado',           color: '#90A4AE' },
  submitted:         { label: 'En revisión',          color: '#FF9800' },
  approved:          { label: 'Aprobado',             color: '#43A047' },
  rejected:          { label: 'Rechazado',            color: '#E53935' },
  included_in_batch: { label: 'En relación',          color: '#2E7D32' },
  exported:          { label: 'Exportado',            color: '#1565C0' },
  cancelled:         { label: 'Cancelado',            color: '#B0BEC5' },
};

export const DUPLICATE_STATUS_META: Record<DuplicateStatus, { label: string; color: string; icon: string }> = {
  no_duplicate:                { label: 'Sin duplicado',      color: '#43A047', icon: '✓' },
  possible_duplicate:          { label: 'Posible duplicado',  color: '#FB8C00', icon: '⚠' },
  strong_duplicate:            { label: 'Duplicado fuerte',   color: '#E53935', icon: '🔴' },
  blocked_duplicate:           { label: 'Bloqueado',          color: '#B71C1C', icon: '🚫' },
  manually_approved_duplicate: { label: 'Permitido (manual)', color: '#7B1FA2', icon: '⚡' },
};

// ── Normalización de proveedores ─────────────────────────────────────────────

/**
 * Normaliza nombre de proveedor para comparación fuzzy.
 * "OXXO Gas Suc. Delicias" → "OXXO GAS SUC DELICIAS"
 */
export function normalizeProviderName(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')     // quita acentos
    .replace(/[^A-Z0-9\s]/g, ' ')        // reemplaza especiales con espacio
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Mapeo OCR → campos de receipt ─────────────────────────────────────────────

/**
 * Convierte el resultado del OCR a los campos que se guardan en la tabla receipts.
 */
export function ocrToReceiptFields(ocr: OcrResult): Partial<Receipt> {
  return {
    provider_name:    ocr.providerName ?? null,
    normalized_provider_name: ocr.providerName
      ? normalizeProviderName(ocr.providerName)
      : null,
    provider_rfc:     ocr.providerRfc ?? null,
    receipt_date:     ocr.receiptDate ?? null,
    receipt_time:     ocr.receiptTime ?? null,
    total_amount:     ocr.total ?? null,
    subtotal_amount:  ocr.subtotal ?? null,
    tax_amount:       ocr.tax ?? null,
    fiscal_uuid:      ocr.fiscalUuid ?? null,
    internal_folio:   ocr.internalFolio ?? null,
    payment_method:   ocr.paymentMethod ?? null,
    ocr_text:         ocr.fullText,
    ocr_confidence:   ocr.confidence === 'high' ? 90
                    : ocr.confidence === 'medium' ? 65
                    : 40,
    extracted_json: {
      raw_ocr:   ocr,
      line_items: ocr.lineItems ?? [],
      warnings:   ocr.warnings ?? [],
    },
  };
}

// ── Score de riesgo ───────────────────────────────────────────────────────────

export interface RiskContext {
  duplicateStatus?: DuplicateStatus;
  ocrConfidence?: 'high' | 'medium' | 'low';
  /** Monto mayor al umbral de la empresa (ej. > $5,000) */
  isHighAmount?: boolean;
  /** Proveedor que no aparece en historial de la empresa */
  isNewSupplier?: boolean;
  /** No tiene UUID fiscal (ticket sin factura) */
  hasFiscalUuid?: boolean;
  /** Capturado más de 3 días después de la fecha del ticket */
  isLateCapture?: boolean;
  /** Número de rechazos previos del empleado */
  previousRejections?: number;
  /** Precio > 15% mayor que compra anterior del mismo producto */
  isPriceIncreased?: boolean;
  /** Fecha del ticket está fuera del periodo de la póliza */
  isOutOfPeriod?: boolean;
}

export function computeRiskScore(context: RiskContext): RiskScore {
  const factors: RiskFactor[] = [];
  let score = 0;

  if (context.duplicateStatus === 'possible_duplicate') {
    factors.push({ reason: 'Posible comprobante duplicado', weight: 25 });
    score += 25;
  }
  if (context.duplicateStatus === 'strong_duplicate') {
    factors.push({ reason: 'Duplicado fuerte detectado', weight: 40 });
    score += 40;
  }
  if (context.duplicateStatus === 'blocked_duplicate') {
    factors.push({ reason: 'Comprobante idéntico ya existe en el sistema', weight: 60 });
    score += 60;
  }
  if (context.ocrConfidence === 'low') {
    factors.push({ reason: 'Baja confianza en lectura OCR', weight: 15 });
    score += 15;
  } else if (context.ocrConfidence === 'medium') {
    factors.push({ reason: 'Confianza media en OCR', weight: 5 });
    score += 5;
  }
  if (context.isHighAmount) {
    factors.push({ reason: 'Monto elevado (requiere atención)', weight: 20 });
    score += 20;
  }
  if (context.isNewSupplier) {
    factors.push({ reason: 'Proveedor nuevo (sin historial en la empresa)', weight: 10 });
    score += 10;
  }
  if (!context.hasFiscalUuid) {
    factors.push({ reason: 'Sin UUID fiscal (ticket sin factura SAT)', weight: 10 });
    score += 10;
  }
  if (context.isLateCapture) {
    factors.push({ reason: 'Captura tardía (más de 3 días después del ticket)', weight: 15 });
    score += 15;
  }
  if ((context.previousRejections ?? 0) >= 3) {
    factors.push({ reason: 'Empleado con historial de rechazos frecuentes', weight: 10 });
    score += 10;
  }
  if (context.isPriceIncreased) {
    factors.push({ reason: 'Precio superior a compra anterior registrada', weight: 15 });
    score += 15;
  }
  if (context.isOutOfPeriod) {
    factors.push({ reason: 'Fecha del ticket fuera del periodo de la póliza', weight: 20 });
    score += 20;
  }

  const level: RiskLevel =
    score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low';

  return { level, score: Math.min(score, 100), factors };
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; icon: string }> = {
  low:    { label: 'Riesgo bajo',  color: '#43A047', icon: '✓' },
  medium: { label: 'Riesgo medio', color: '#FB8C00', icon: '⚠' },
  high:   { label: 'Riesgo alto',  color: '#E53935', icon: '🔴' },
};

// ── Validaciones de estado ─────────────────────────────────────────────────────

/** ¿Puede el empleado editar este comprobante? */
export function canEditReceipt(status: ReceiptStatus): boolean {
  return status === 'captured' || status === 'submitted';
}

/** ¿Puede el comprobante entrar a una relación/cierre? */
export function canAddToBatch(status: ReceiptStatus, duplicateStatus: DuplicateStatus): boolean {
  return (
    status === 'approved' &&
    duplicateStatus !== 'blocked_duplicate' &&
    duplicateStatus !== 'strong_duplicate'
  );
}

/** ¿Está este comprobante bloqueado para resubmisión? */
export function isBlockedByDuplicate(duplicateStatus: DuplicateStatus): boolean {
  return duplicateStatus === 'blocked_duplicate';
}
