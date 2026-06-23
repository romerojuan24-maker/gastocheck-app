// GastoCheck — Lógica de detección y manejo de duplicados
import type { DuplicateStatus, MatchType } from './types';

// ── Resultados de verificación ────────────────────────────────────────────────

export interface DuplicateMatch {
  receiptId: string;
  matchType: MatchType;
  score: number;
  reason: string;
  providerName?: string | null;
  receiptDate?: string | null;
  totalAmount?: number | null;
  uploadedByName?: string | null;
  status?: string | null;
}

export interface DuplicateCheckResult {
  status: DuplicateStatus;
  score: number;
  matches: DuplicateMatch[];
  shouldBlock: boolean;
  message: string;
}

// ── Reglas de bloqueo ─────────────────────────────────────────────────────────

/** Match types que siempre bloquean (el comprobante NO puede guardarse sin autorización admin) */
const BLOCKING_MATCH_TYPES: MatchType[] = ['fiscal_uuid', 'file_hash'];

/** ¿Este tipo de match siempre bloquea? */
export function isBlockingMatchType(matchType: MatchType): boolean {
  return BLOCKING_MATCH_TYPES.includes(matchType);
}

/** Convierte score + tipo a un DuplicateStatus */
export function scoreToDuplicateStatus(score: number, matchType: MatchType): DuplicateStatus {
  if (isBlockingMatchType(matchType)) return 'blocked_duplicate';
  if (score >= 90) return 'strong_duplicate';
  if (score >= 60) return 'possible_duplicate';
  return 'no_duplicate';
}

/** ¿Debe bloquearse el guardado? */
export function shouldBlockSave(status: DuplicateStatus): boolean {
  return status === 'blocked_duplicate';
}

// ── Mensajes al usuario ────────────────────────────────────────────────────────

export function getDuplicateMessage(match: DuplicateMatch): string {
  const when = match.receiptDate ?? 'fecha desconocida';
  const who  = match.providerName ?? 'proveedor desconocido';
  const amt  = match.totalAmount != null
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(match.totalAmount)
    : '';

  switch (match.matchType) {
    case 'fiscal_uuid':
      return `Este CFDI ya está registrado en GastoCheck. ` +
             `Fue capturado el ${when} de ${who}${amt ? ` por ${amt}` : ''}.`;
    case 'file_hash':
      return `Este archivo ya fue subido anteriormente (${who}, ${when}).`;
    case 'image_phash':
      return `La imagen es muy similar a un ticket ya registrado de ${who} (${when}).`;
    case 'provider_date_amount':
      return `Existe un comprobante similar: ${who}, ${when}${amt ? `, ${amt}` : ''}.`;
    case 'rfc_date_amount':
      return `El RFC emisor, fecha y monto coinciden con ${who} del ${when}.`;
    case 'ocr_similarity':
      return `El texto del ticket es muy similar a un comprobante de ${who} (${when}).`;
    default:
      return `Posible comprobante duplicado detectado.`;
  }
}

export function getDuplicateBlockMessage(match: DuplicateMatch): string {
  switch (match.matchType) {
    case 'fiscal_uuid':
      return `⛔ BLOQUEADO: Este UUID de CFDI ya está registrado en el sistema. ` +
             `No es posible subir la misma factura dos veces. ` +
             `Fue capturado de ${match.providerName ?? 'proveedor'} el ${match.receiptDate ?? ''}.`;
    case 'file_hash':
      return `⛔ BLOQUEADO: Este archivo ya fue subido anteriormente. ` +
             `Archivo idéntico detectado de ${match.providerName ?? 'proveedor'} (${match.receiptDate ?? ''}).`;
    default:
      return getDuplicateMessage(match);
  }
}

// ── Construcción del resultado final ─────────────────────────────────────────

/**
 * A partir de una lista de matches (ordenados por score desc), determina
 * el estado global de duplicado y si debe bloquearse.
 */
export function buildDuplicateCheckResult(matches: DuplicateMatch[]): DuplicateCheckResult {
  if (matches.length === 0) {
    return {
      status: 'no_duplicate',
      score: 0,
      matches: [],
      shouldBlock: false,
      message: 'Sin duplicados detectados.',
    };
  }

  // El match más severo determina el estado global
  const topMatch = matches[0];
  const status   = scoreToDuplicateStatus(topMatch.score, topMatch.matchType);
  const block    = shouldBlockSave(status);

  const message = block
    ? getDuplicateBlockMessage(topMatch)
    : getDuplicateMessage(topMatch);

  return { status, score: topMatch.score, matches, shouldBlock: block, message };
}

// ── Comparación de textos para similitud básica ───────────────────────────────

/**
 * Calcula una similitud simple entre dos strings (0-100).
 * Usa Jaccard sobre bigramas de palabras.
 */
export function textSimilarity(a: string, b: string): number {
  const words1 = new Set(tokenize(a));
  const words2 = new Set(tokenize(b));
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter((w) => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  return Math.round((intersection / union) * 100);
}

function tokenize(text: string): string[] {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

// ── Resolución manual ─────────────────────────────────────────────────────────

export type DuplicateResolution = 'confirmed_duplicate' | 'false_positive' | 'manually_allowed';

export const RESOLUTION_LABELS: Record<DuplicateResolution, string> = {
  confirmed_duplicate: 'Confirmar como duplicado (cancelar)',
  false_positive:      'Falso positivo (no es duplicado)',
  manually_allowed:    'Permitir de todas formas (con motivo)',
};
