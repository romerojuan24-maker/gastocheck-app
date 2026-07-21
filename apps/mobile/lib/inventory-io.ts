// Import/Export de inventario. Usa SheetJS (xlsx, JS puro — viaja por OTA)
// para LEER .xlsx y .csv. Para exportar, comparte CSV como texto (Share nativo,
// sin depender de expo-sharing que no está en el APK actual); el archivo .xlsx
// descargable llegará con el próximo APK.
import * as XLSX from 'xlsx';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Share } from 'react-native';
import { supabase } from './supabase';

export interface ParsedProduct {
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string;
  cost: number;
  price: number;
  stock_current: number;
  stock_minimum: number;
}

// Busca una columna por varios nombres posibles (español/inglés), sin
// distinguir mayúsculas ni acentos.
function pick(row: Record<string, any>, keys: string[]): any {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const map: Record<string, any> = {};
  for (const k of Object.keys(row)) map[norm(k)] = row[k];
  for (const key of keys) { const v = map[norm(key)]; if (v !== undefined && v !== '') return v; }
  return undefined;
}

function toNum(v: any): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function mapRow(row: Record<string, any>): ParsedProduct | null {
  const name = pick(row, ['nombre', 'producto', 'descripcion', 'name', 'product', 'articulo']);
  if (!name || !String(name).trim()) return null;
  return {
    name: String(name).trim(),
    sku:      (pick(row, ['sku', 'clave', 'codigo', 'code']) ?? null) as any,
    barcode:  (pick(row, ['codigo de barras', 'barcode', 'ean', 'upc']) ?? null) as any,
    category: (pick(row, ['categoria', 'category', 'familia', 'grupo']) ?? null) as any,
    unit:     String(pick(row, ['unidad', 'unit', 'medida']) ?? 'pza').trim() || 'pza',
    cost:     toNum(pick(row, ['costo', 'cost', 'precio costo'])),
    price:    toNum(pick(row, ['precio', 'price', 'precio venta', 'pvp'])),
    stock_current: toNum(pick(row, ['existencia', 'stock', 'cantidad', 'stock actual', 'stock_current', 'inventario'])),
    stock_minimum: toNum(pick(row, ['minimo', 'stock minimo', 'stock_minimum', 'min'])),
  };
}

/** Abre el selector, lee xlsx/csv y devuelve los productos parseados. */
export async function pickAndParseInventory(): Promise<{ products: ParsedProduct[]; skipped: number } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                          // .xls
      'text/csv', 'text/comma-separated-values', 'application/csv',
    ],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const file = res.assets[0];
  const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
  const wb = XLSX.read(b64, { type: 'base64' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  const products: ParsedProduct[] = [];
  let skipped = 0;
  for (const r of rows) {
    const p = mapRow(r);
    if (p) products.push(p); else skipped++;
  }
  return { products, skipped };
}

/** Inserta los productos parseados en inventory_products. */
export async function importInventory(companyId: string, products: ParsedProduct[]): Promise<number> {
  if (products.length === 0) return 0;
  const rows = products.map(p => ({ company_id: companyId, is_active: true, ...p }));
  // Insertar en lotes de 200
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase.from('inventory_products').insert(batch);
    if (error) throw error;
    inserted += batch.length;
  }
  return inserted;
}

/** Exporta el inventario como CSV y lo comparte (texto). */
export async function exportInventoryCsv(products: any[]): Promise<void> {
  const header = 'Nombre,SKU,Categoria,Unidad,Costo,Precio,Existencia,Stock Minimo';
  const lines = products.map(p =>
    [p.name, p.sku ?? '', p.category ?? '', p.unit ?? '', p.cost ?? 0, p.price ?? 0, p.stock_current ?? 0, p.stock_minimum ?? 0]
      .map(v => `"${String(v).replace(/"/g, "'")}"`).join(','));
  const csv = [header, ...lines].join('\n');
  await Share.share({ message: csv, title: 'Inventario (CSV)' });
}
