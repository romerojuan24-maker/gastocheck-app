/**
 * EJEMPLO: Cómo usar scan-document desde la app mobile (React Native/Expo)
 * Este archivo es referencia — cópialo a tu proyecto según sea necesario
 */

import { supabase } from '@/lib/supabase';

interface ScannedDocument {
  amount: number | null;
  date: string | null;
  vendor: string | null;
  concept: string | null;
  rfc: string | null;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

/**
 * Captura una foto del gasto y extrae datos automáticamente
 * @param imageBase64 - Imagen en base64 (sin prefijo data:)
 * @param mimeType - Tipo MIME (default: image/jpeg)
 * @returns Datos extraídos del documento
 */
export async function captureExpenseDocument(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<ScannedDocument> {
  try {
    const { data, error } = await supabase.functions.invoke('scan-document', {
      body: {
        image_base64: imageBase64,
        mime_type: mimeType,
      },
    });

    if (error) {
      console.error('scan-document error:', error);
      throw error;
    }

    if (!data?.ok) {
      throw new Error(data?.error || 'Error desconocido en scan-document');
    }

    return data.data as ScannedDocument;
  } catch (err) {
    console.error('captureExpenseDocument error:', err);
    throw err;
  }
}

/**
 * Procesa una foto de ticket y registra el gasto automáticamente
 * Flujo completo: Foto → OCR → Validación → Registro en BD
 */
export async function processReceiptAndCreateExpense(
  imageBase64: string,
  userId: string,
  companyId: string,
  mimeType?: string,
) {
  try {
    // 1. Extraer datos del documento
    console.log('📸 Escaneando documento...');
    const scanned = await captureExpenseDocument(imageBase64, mimeType);

    // 2. Validar confianza mínima
    if (scanned.confidence === 'low') {
      console.warn('⚠️ Baja confianza en los datos extraídos');
      if (scanned.warnings.length > 0) {
        console.warn('Advertencias:', scanned.warnings);
      }
      // Podrías hacer que el usuario confirme manualmente aquí
    }

    // 3. Preparar objeto de gasto para BD
    const expenseData = {
      user_id: userId,
      company_id: companyId,
      amount: scanned.amount || 0,
      date: scanned.date || new Date().toISOString().split('T')[0],
      vendor_name: scanned.vendor || 'Desconocido',
      concept: scanned.concept || 'Gasto',
      vendor_rfc: scanned.rfc,
      receipt_image_base64: imageBase64,
      status: 'draft', // Usuario puede revisar antes de enviar
      extracted_from_ocr: true,
      extraction_confidence: scanned.confidence,
      extraction_warnings: scanned.warnings,
    };

    // 4. Registrar en BD
    console.log('💾 Registrando gasto en BD...');
    const { data: expense, error: insertError } = await supabase
      .from('expenses')
      .insert([expenseData])
      .select()
      .single();

    if (insertError) {
      console.error('Error al registrar gasto:', insertError);
      throw insertError;
    }

    console.log('✅ Gasto registrado:', expense);
    return {
      expense,
      scanned,
    };
  } catch (err) {
    console.error('processReceiptAndCreateExpense error:', err);
    throw err;
  }
}

/**
 * Hook de React para captura de gastos con cámara
 * Uso en componente:
 *
 * const { captureExpense, loading, error } = useCaptureExpense();
 *
 * <TouchableOpacity onPress={() => captureExpense()}>
 *   <Text>Fotografiar Gasto</Text>
 * </TouchableOpacity>
 */
export function useCaptureExpense() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const captureExpense = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Abrir cámara y capturar foto (usando expo-camera)
      // Este es pseudocódigo — ajusta según tu implementación
      const photo = await openCamera();

      if (!photo) {
        setError('Captura cancelada');
        return;
      }

      // 2. Convertir a base64
      const base64 = await convertFileToBase64(photo.uri);

      // 3. Procesar documento
      const { expense, scanned } = await processReceiptAndCreateExpense(
        base64,
        userId,
        companyId,
        'image/jpeg',
      );

      return { expense, scanned };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { captureExpense, loading, error };
}

/**
 * Componente de ejemplo: "Capturar Gasto"
 */
export function CaptureExpenseButton() {
  const [scanned, setScanned] = React.useState<ScannedDocument | null>(null);
  const { captureExpense, loading } = useCaptureExpense();

  const handleCapture = React.useCallback(async () => {
    const result = await captureExpense();
    if (result) {
      setScanned(result.scanned);
      // Mostrar modal de confirmación o navegar a edición
    }
  }, [captureExpense]);

  return (
    <TouchableOpacity onPress={handleCapture} disabled={loading}>
      <View>
        <Icon name="camera" size={24} />
        <Text>{loading ? 'Escaneando...' : 'Fotografiar Gasto'}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Utilidad: Convertir URI de foto a base64
 */
async function convertFileToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remover prefijo "data:image/jpeg;base64," si existe
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Utilidad: Abrir cámara (pseudocódigo con expo-camera)
 */
async function openCamera() {
  // Import { Camera } from 'expo-camera';
  // Esta es una simplificación — implementa según expo-camera
  return null;
}

// ─────────────────────────────────────────────────────────────
// INTEGRACIONES CON MODELOS EXISTENTES
// ─────────────────────────────────────────────────────────────

/**
 * Registrar gasto OCR con validación de política de gasto
 */
export async function registerOcrExpenseWithPolicy(
  imageBase64: string,
  userId: string,
  companyId: string,
  policyId?: string,
) {
  try {
    // 1. Escanear documento
    const scanned = await captureExpenseDocument(imageBase64);

    // 2. Si hay UUID CFDI (de ocr-extract), validar contra SAT
    // Por ahora, scan-document no lo extrae — ver ocr-extract para eso

    // 3. Registrar con status 'pending_review' si baja confianza
    const status = scanned.confidence === 'low' ? 'pending_review' : 'draft';

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert([
        {
          user_id: userId,
          company_id: companyId,
          policy_id: policyId,
          amount: scanned.amount,
          date: scanned.date,
          vendor_name: scanned.vendor,
          concept: scanned.concept,
          vendor_rfc: scanned.rfc,
          receipt_image_base64: imageBase64,
          status,
          extracted_from_ocr: true,
          extraction_confidence: scanned.confidence,
          extraction_warnings: scanned.warnings,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return expense;
  } catch (err) {
    console.error('registerOcrExpenseWithPolicy error:', err);
    throw err;
  }
}

/**
 * Batch: Procesar múltiples fotos a la vez
 */
export async function processBatchReceipts(
  imagesBase64: string[],
  userId: string,
  companyId: string,
): Promise<{ success: ScannedDocument[]; failed: Array<{ image: string; error: string }> }> {
  const results = {
    success: [] as ScannedDocument[],
    failed: [] as Array<{ image: string; error: string }>,
  };

  for (const imageBase64 of imagesBase64) {
    try {
      const scanned = await captureExpenseDocument(imageBase64);
      results.success.push(scanned);
    } catch (err) {
      results.failed.push({
        image: imageBase64.substring(0, 20) + '...',
        error: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  }

  console.log(`✅ Procesadas ${results.success.length} fotos`);
  console.log(`❌ Fallaron ${results.failed.length} fotos`);

  return results;
}
