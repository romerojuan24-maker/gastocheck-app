// Parser para catálogos de cuentas contables (Excel Contpaqi, CSV, TXT)
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

export interface CatalogAccount {
  codigo:   string;
  nombre:   string;
  tipo?:    string;
  ctaSup?:  string;
  selected?: boolean;
}

// ── Selección de archivo ───────────────────────────────────────────────────────

export async function pickCatalogFile(): Promise<{
  uri: string; name: string; mimeType: string;
} | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'text/plain',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
    });
    if (result.canceled) return null;
    const file = result.assets[0];
    return { uri: file.uri, name: file.name, mimeType: file.mimeType ?? 'application/octet-stream' };
  } catch (err) {
    console.error('[pickCatalogFile]', err);
    return null;
  }
}

// ── Dispatcher principal ───────────────────────────────────────────────────────

export async function parseCatalogFile(
  fileUri:  string,
  fileName: string,
  mimeType: string,
): Promise<CatalogAccount[]> {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return parseExcel(fileUri);
  } else if (ext === 'csv' || mimeType === 'text/csv') {
    return parseText(fileUri, 'csv');
  } else if (ext === 'txt' || mimeType === 'text/plain') {
    return parseText(fileUri, 'txt');
  }
  throw new Error(`Formato no soportado: .${ext ?? 'desconocido'}`);
}

// ── Parser Excel (.xls / .xlsx) ───────────────────────────────────────────────
// Columnas Contpaqi: A(0)=Código, C(2)=Nombre, F(5)=Tipo
// Se filtran filas donde Nombre esté vacío.

async function parseExcel(fileUri: string): Promise<CatalogAccount[]> {
  const b64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(b64, { type: 'base64' });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  // header:1 → array de arrays (sin inferir cabecera)
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

  const accounts: CatalogAccount[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row    = rows[i];
    const codigo = String(row[0] ?? '').trim();
    const nombre = String(row[2] ?? '').trim();   // Columna C
    const tipo   = String(row[5] ?? '').trim();   // Columna F

    if (!nombre) continue; // filtrar filas sin nombre

    accounts.push({ codigo, nombre, tipo: tipo || undefined, selected: false });
  }

  return accounts;
}

// ── Parser CSV / TXT ───────────────────────────────────────────────────────────

async function parseText(fileUri: string, format: 'csv' | 'txt'): Promise<CatalogAccount[]> {
  const content   = await FileSystem.readAsStringAsync(fileUri);
  const lines     = content.split('\n').filter(l => l.trim());
  const delimiter = format === 'txt' && lines[0]?.includes('|') ? '|'
                  : detectDelimiter(lines[0] ?? '');

  const accounts: CatalogAccount[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith('#')) continue;
    const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));

    const codigo = parts[0] ?? '';
    const nombre = parts[1] ?? '';  // CSV/TXT: A=Código, B=Nombre
    const tipo   = parts[2] ?? '';

    if (!nombre) continue;
    accounts.push({ codigo, nombre, tipo: tipo || undefined, selected: false });
  }

  return accounts;
}

function detectDelimiter(line: string): string {
  if (line.includes(';'))  return ';';
  if (line.includes('\t')) return '\t';
  return ',';
}

// ── Utilidades de UI ───────────────────────────────────────────────────────────

export function filterAccounts(accounts: CatalogAccount[], query: string): CatalogAccount[] {
  const q = query.toLowerCase().trim();
  if (!q) return accounts;
  return accounts.filter(
    a => a.codigo.toLowerCase().includes(q) || a.nombre.toLowerCase().includes(q),
  );
}

export function getSelectedAccounts(accounts: CatalogAccount[]): CatalogAccount[] {
  return accounts.filter(a => a.selected);
}
