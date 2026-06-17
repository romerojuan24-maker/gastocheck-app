// Exportador de pólizas a formatos contables (CSV, XLS, CONTPAQi, Aspel)
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface ExportExpense {
  folio: string;
  provider_name: string;
  expense_date: string;
  total: number;
  iva: number;
  isr: number;
  ieps: number;
  category: string;
  sat_status: string;
  authorization_status: string;
  cfdi_uuid: string | null;
}

export async function exportPolicyToCSV(
  policyName: string,
  expenses: ExportExpense[],
): Promise<string> {
  const headers = [
    'Folio',
    'Proveedor',
    'Fecha',
    'Monto',
    'IVA',
    'ISR',
    'IEPS',
    'Categoría',
    'SAT',
    'Autorización',
    'UUID CFDI',
  ];

  const rows = expenses.map(e => [
    e.folio,
    e.provider_name || '—',
    e.expense_date || '—',
    e.total.toFixed(2),
    e.iva.toFixed(2),
    e.isr.toFixed(2),
    e.ieps.toFixed(2),
    e.category || '—',
    e.sat_status || '—',
    e.authorization_status,
    e.cfdi_uuid || '—',
  ]);

  const csv = [
    `Póliza: ${policyName}`,
    `Generado: ${new Date().toLocaleString('es-MX')}`,
    '',
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csv;
}

export async function exportPolicyToXLS(
  policyName: string,
  expenses: ExportExpense[],
): Promise<string> {
  // Fallback a CSV si no hay librería XLS en RN
  // En producción, podrías usar una librería como xlsx-style
  const csv = await exportPolicyToCSV(policyName, expenses);
  return csv; // Devuelve CSV como fallback
}

export async function exportPolicyCONTPAQi(
  policyName: string,
  expenses: ExportExpense[],
): Promise<string> {
  // Formato CONTPAQi (tab-separated, no headers)
  const rows = expenses.map(e => [
    e.folio,
    e.expense_date || '',
    e.provider_name || '',
    e.category || '',
    e.total.toFixed(2),
    e.iva.toFixed(2),
    e.isr.toFixed(2),
    e.ieps.toFixed(2),
    e.cfdi_uuid || '',
  ]).join('\n');

  return rows;
}

export async function saveAndShareFile(
  content: string,
  fileName: string,
  fileExtension: 'csv' | 'txt' | 'xls',
): Promise<void> {
  const mimeType = {
    csv: 'text/csv',
    txt: 'text/plain',
    xls: 'application/vnd.ms-excel',
  }[fileExtension];

  const path = `${FileSystem.documentDirectory}${fileName}.${fileExtension}`;

  try {
    // Guardar archivo
    await FileSystem.writeAsStringAsync(path, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Compartir (abre diálogo nativo)
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType,
        dialogTitle: `Compartir ${fileName}`,
        UTI: `public.${fileExtension}`,
      });
    } else {
      throw new Error('Compartir no disponible en este dispositivo');
    }
  } catch (err) {
    console.error('[saveAndShareFile] Error:', err);
    throw err;
  }
}

export async function saveFileSilently(
  content: string,
  fileName: string,
  fileExtension: 'csv' | 'txt' | 'xls',
): Promise<string> {
  const path = `${FileSystem.documentDirectory}${fileName}.${fileExtension}`;

  try {
    await FileSystem.writeAsStringAsync(path, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return path;
  } catch (err) {
    console.error('[saveFileSilently] Error:', err);
    throw err;
  }
}
