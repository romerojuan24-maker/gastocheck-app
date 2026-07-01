// Corre OCR (+ recorte automático + folio/UUID) sobre comprobantes ya guardados
// que quedaron sin proveedor — reutiliza el mismo edge function que la captura rápida.
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import type { OcrResult } from '@gastocheck/shared';
import { supabase } from './supabase';

export interface BatchOcrReceipt {
  id: string;
  file_storage_path: string | null;
  source_type: string;
}

export interface BatchOcrProgress {
  total: number;
  done: number;
  ok: number;
  failed: number;
  current: string | null;
}

async function callOcrExtract(base64: string): Promise<{
  data: OcrResult | null;
  error: string | null;
  croppedImageBase64: string | null;
}> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  const res = await fetch(`${supabaseUrl}/functions/v1/ocr-extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image_base64: base64, mime_type: 'image/jpeg' }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { data: null, error: err.error || err.detail || `Error ${res.status}`, croppedImageBase64: null };
  }
  const body = await res.json();
  return { data: body.data as OcrResult, error: null, croppedImageBase64: body.croppedImageBase64 ?? null };
}

/** Trae los comprobantes "sin proveedor" del usuario (candidatos a re-analizar). */
export async function fetchReceiptsNeedingOcr(companyId: string, userId: string): Promise<BatchOcrReceipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('id, file_storage_path, source_type')
    .eq('company_id', companyId)
    .or(`uploaded_by.eq.${userId},employee_id.eq.${userId}`)
    .is('provider_name', null)
    .eq('source_type', 'photo')
    .not('file_storage_path', 'is', null)
    .not('status', 'in', '(cancelled,deleted,duplicate)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('[ocr-batch] fetchReceiptsNeedingOcr error:', error.message);
    return [];
  }
  return (data ?? []) as BatchOcrReceipt[];
}

/** Corre OCR sobre un comprobante puntual: descarga la foto, llama Gemini, aplica recorte y folio/UUID. */
export async function runOcrOnReceipt(receipt: BatchOcrReceipt, companyId: string): Promise<{ ok: boolean; error?: string }> {
  if (!receipt.file_storage_path) return { ok: false, error: 'Sin archivo' };

  try {
    // 1. Descargar la foto ya guardada en Storage y pasarla a base64
    const { data: signed, error: signErr } = await supabase.storage
      .from('expense-attachments')
      .createSignedUrl(receipt.file_storage_path, 300);
    if (signErr || !signed?.signedUrl) return { ok: false, error: signErr?.message ?? 'Sin URL firmada' };

    const localUri = `${FileSystem.cacheDirectory}ocr-batch-${receipt.id}.jpg`;
    const dl = await FileSystem.downloadAsync(signed.signedUrl, localUri);
    if (dl.status !== 200) return { ok: false, error: `Descarga falló (${dl.status})` };

    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});

    // 2. OCR
    const { data: ocr, error: ocrError, croppedImageBase64 } = await callOcrExtract(base64);
    if (!ocr) return { ok: false, error: ocrError ?? 'OCR sin datos' };

    // 3. Recorte — reemplaza la foto original en el mismo path
    if (croppedImageBase64) {
      const { error: cropUpErr } = await supabase.storage
        .from('expense-attachments')
        .upload(receipt.file_storage_path, decode(croppedImageBase64), { contentType: 'image/jpeg', upsert: true });
      if (cropUpErr) console.warn('[ocr-batch] no se pudo subir imagen recortada:', cropUpErr.message);
    }

    // 4. Folio (no fiscal) vs. validación de UUID duplicado (fiscal) — mismo criterio que captura rápida
    let gc_folio: string | null = null;
    let duplicateStatus: string | null = null;

    if (ocr.fiscalUuid) {
      const { count } = await supabase
        .from('receipts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('fiscal_uuid', ocr.fiscalUuid)
        .neq('id', receipt.id)
        .neq('status', 'cancelled');
      if ((count ?? 0) > 0) duplicateStatus = 'blocked_duplicate';
    } else {
      try {
        const { data: folioData } = await supabase
          .rpc('next_gc_folio', { p_company_id: companyId, p_type: 'receipt' });
        gc_folio = folioData ?? null;
      } catch { /* no bloquea */ }
    }

    const { error: updErr } = await supabase.from('receipts').update({
      provider_name: ocr.providerName ?? null,
      provider_rfc:  ocr.providerRfc  ?? null,
      total_amount:  ocr.total        ?? null,
      receipt_date:  ocr.receiptDate  ?? null,
      fiscal_uuid:   ocr.fiscalUuid   ?? null,
      ...(gc_folio ? { gc_folio } : {}),
      ...(duplicateStatus ? { duplicate_status: duplicateStatus } : {}),
    }).eq('id', receipt.id);

    if (updErr) return { ok: false, error: updErr.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

/** Corre OCR en lote sobre varios comprobantes, reportando progreso incremental. */
export async function runOcrBatch(
  receipts: BatchOcrReceipt[],
  companyId: string,
  onProgress: (p: BatchOcrProgress) => void,
): Promise<BatchOcrProgress> {
  const progress: BatchOcrProgress = { total: receipts.length, done: 0, ok: 0, failed: 0, current: null };
  for (const r of receipts) {
    progress.current = r.id;
    onProgress({ ...progress });
    const result = await runOcrOnReceipt(r, companyId);
    progress.done += 1;
    if (result.ok) progress.ok += 1; else progress.failed += 1;
    onProgress({ ...progress });
  }
  progress.current = null;
  return progress;
}
