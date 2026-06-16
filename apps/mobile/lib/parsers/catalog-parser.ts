// Parser para catálogos de cuentas (Excel, CSV, TXT)
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

export interface CatalogAccount {
  codigo: string;
  nombre: string;
  tipo?: string;
  ctaSup?: string;
  selected?: boolean;
}

/**
 * Selecciona archivo y detecta formato automáticamente
 */
export async function pickCatalogFile(): Promise<{
  uri: string;
  name: string;
  mimeType: string;
} | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    });

    if (result.canceled) return null;

    const file = result.assets[0];
    return {
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType ?? 'application/octet-stream',
    };
  } catch (err) {
    console.error('[pickCatalogFile] Error:', err);
    return null;
  }
}

/**
 * Detecta el tipo de archivo y parsea
 */
export async function parseCatalogFile(
  fileUri: string,
  fileName: string,
  mimeType: string,
): Promise<CatalogAccount[]> {
  try {
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet')) {
      return await parseExcel(fileUri);
    } else if (ext === 'csv' || mimeType === 'text/csv') {
      return await parseCSV(fileUri);
    } else if (ext === 'txt' || mimeType === 'text/plain') {
      return await parseTXT(fileUri);
    } else {
      throw new Error(`Formato no soportado: ${ext}`);
    }
  } catch (err) {
    console.error('[parseCatalogFile] Error:', err);
    throw err;
  }
}

/**
 * Parsea archivo Excel — fallback a CSV parsing
 */
async function parseExcel(fileUri: string): Promise<CatalogAccount[]> {
  console.warn('[parseExcel] Excel no soportado en RN, usando fallback CSV');
  return parseCSV(fileUri);
}

/**
 * Parsea archivo CSV
 */
async function parseCSV(fileUri: string): Promise<CatalogAccount[]> {
  try {
    const content = await FileSystem.readAsStringAsync(fileUri);

    const lines = content.split('\n').filter((l) => l.trim());
    const accounts: CatalogAccount[] = [];

    // Detectar delimitador (coma, punto y coma, tabulador)
    const delimiter = detectDelimiter(lines[0] ?? '');

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter).map((p) => p.trim());

      if (parts.length < 2 || !parts[0]) continue;

      accounts.push({
        codigo: parts[0],
        nombre: parts[1],
        tipo: parts[2] ?? null,
        ctaSup: parts[3] ?? null,
        selected: false,
      });
    }

    return accounts;
  } catch (err) {
    console.error('[parseCSV] Error:', err);
    throw err;
  }
}

/**
 * Parsea archivo TXT (CONTPAQi format)
 */
async function parseTXT(fileUri: string): Promise<CatalogAccount[]> {
  try {
    const content = await FileSystem.readAsStringAsync(fileUri);

    const lines = content.split('\n').filter((l) => l.trim());
    const accounts: CatalogAccount[] = [];

    // CONTPAQi TXT puede usar pipes (|) o espacios como separador
    const delimiter = lines[0]?.includes('|') ? '|' : '\t';

    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;

      const parts = line.split(delimiter).map((p) => p.trim());

      if (parts.length < 2 || !parts[0]) continue;

      accounts.push({
        codigo: parts[0],
        nombre: parts[1],
        tipo: parts[2] ?? null,
        ctaSup: parts[3] ?? null,
        selected: false,
      });
    }

    return accounts;
  } catch (err) {
    console.error('[parseTXT] Error:', err);
    throw err;
  }
}

/**
 * Detecta el delimitador del CSV
 */
function detectDelimiter(firstLine: string): string {
  if (firstLine.includes(',')) return ',';
  if (firstLine.includes(';')) return ';';
  if (firstLine.includes('\t')) return '\t';
  return ','; // default
}

/**
 * Filtra cuentas por búsqueda
 */
export function filterAccounts(accounts: CatalogAccount[], query: string): CatalogAccount[] {
  if (!query.trim()) return accounts;

  const q = query.toLowerCase();
  return accounts.filter(
    (a) =>
      a.codigo.toLowerCase().includes(q) ||
      a.nombre.toLowerCase().includes(q),
  );
}

/**
 * Obtiene solo las cuentas seleccionadas
 */
export function getSelectedAccounts(accounts: CatalogAccount[]): CatalogAccount[] {
  return accounts.filter((a) => a.selected);
}
