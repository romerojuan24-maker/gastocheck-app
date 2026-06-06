// GastoCheck — Parser de CFDI 4.0 (XML SAT) sin dependencias externas.
// Pensado para correr en Edge Function (Deno) o navegador con DOMParser.
import type { CfdiData } from './types';

/** Extrae datos fiscales de un XML CFDI 4.0/3.3. `getAttr` se inyecta para
 *  poder usarlo tanto con DOMParser (web) como con un parser de Deno. */
export function parseCfdiXml(xml: string): Omit<CfdiData, 'expense_id'> {
  const attr = (tag: string, name: string): string => {
    // match básico: <tag ... name="valor"
    const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}\\b[^>]*?\\b${name}="([^"]*)"`, 'i');
    const m = xml.match(re);
    return m ? m[1] : '';
  };

  const num = (s: string) => (s ? parseFloat(s) : 0);

  // Impuestos: el nodo Impuestos del comprobante trae TotalImpuestosTrasladados
  const iva = num(attr('Impuestos', 'TotalImpuestosTrasladados'));

  // Conceptos
  const conceptos: CfdiData['conceptos'] = [];
  const conceptoRe = /<(?:[a-zA-Z0-9]+:)?Concepto\b[^>]*>/gi;
  let cm: RegExpExecArray | null;
  while ((cm = conceptoRe.exec(xml))) {
    const block = cm[0];
    const get = (n: string) => (block.match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1] || '';
    conceptos.push({
      descripcion: get('Descripcion'),
      importe: num(get('Importe')),
      cantidad: num(get('Cantidad')) || 1,
    });
  }

  return {
    uuid: attr('TimbreFiscalDigital', 'UUID'),
    rfc_emisor: attr('Emisor', 'Rfc'),
    rfc_receptor: attr('Receptor', 'Rfc'),
    subtotal: num(attr('Comprobante', 'SubTotal')),
    iva,
    total: num(attr('Comprobante', 'Total')),
    fecha: attr('Comprobante', 'Fecha'),
    metodo_pago: attr('Comprobante', 'MetodoPago'),
    forma_pago: attr('Comprobante', 'FormaPago'),
    conceptos,
  };
}
