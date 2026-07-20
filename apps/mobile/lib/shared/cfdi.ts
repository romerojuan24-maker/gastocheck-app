// GastoCheck — Parser de CFDI 4.0 (XML SAT) sin dependencias externas.
// Pensado para correr en Edge Function (Deno) o navegador con DOMParser.
import type { CfdiData } from './types';

/** Extrae datos fiscales de un XML CFDI 4.0/3.3, incluyendo IEPS y retenciones. */
export function parseCfdiXml(xml: string): Omit<CfdiData, 'expense_id'> {
  const attr = (tag: string, name: string): string => {
    const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}\\b[^>]*?\\b${name}="([^"]*)"`, 'i');
    const m = xml.match(re);
    return m ? m[1] : '';
  };

  const num = (s: string) => (s ? parseFloat(s) : 0);

  // ── Traslados: IVA (002) y IEPS (003) por separado ───────────────────────
  let iva = 0;
  let ieps = 0;
  const trasladoRe = /<(?:[a-zA-Z0-9]+:)?Traslado\b[^>]*>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = trasladoRe.exec(xml))) {
    const block = tm[0];
    const get = (n: string) => (block.match(new RegExp(`\\b${n}="([^"]*)"`, 'i')) || [])[1] ?? '';
    const impuesto = get('Impuesto');
    const importe  = num(get('Importe'));
    if (impuesto === '002') iva  += importe;
    else if (impuesto === '003') ieps += importe;
  }

  // Fallback: si no hay <Traslado> individuales, usar el total del nodo Impuestos
  if (iva === 0 && ieps === 0) {
    iva = num(attr('Impuestos', 'TotalImpuestosTrasladados'));
  }

  // ── Retenciones: ISR (001) y IVA retenido (002) ───────────────────────────
  let retencion_iva = 0;
  let retencion_isr = 0;
  const retencionRe = /<(?:[a-zA-Z0-9]+:)?Retencion\b[^>]*>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = retencionRe.exec(xml))) {
    const block = rm[0];
    const get = (n: string) => (block.match(new RegExp(`\\b${n}="([^"]*)"`, 'i')) || [])[1] ?? '';
    const impuesto = get('Impuesto');
    const importe  = num(get('Importe'));
    if (impuesto === '001') retencion_isr += importe;
    else if (impuesto === '002') retencion_iva += importe;
  }

  // ── Descuento en Comprobante ──────────────────────────────────────────────
  const descuento = num(attr('Comprobante', 'Descuento'));

  // ── Conceptos ────────────────────────────────────────────────────────────
  const conceptos: CfdiData['conceptos'] = [];
  const conceptoRe = /<(?:[a-zA-Z0-9]+:)?Concepto\b[^>]*>/gi;
  let cm: RegExpExecArray | null;
  while ((cm = conceptoRe.exec(xml))) {
    const block = cm[0];
    const get = (n: string) => (block.match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1] || '';
    conceptos.push({
      descripcion: get('Descripcion'),
      importe:     num(get('Importe')),
      cantidad:    num(get('Cantidad')) || 1,
    });
  }

  return {
    uuid:             attr('TimbreFiscalDigital', 'UUID'),
    rfc_emisor:       attr('Emisor',       'Rfc'),
    nombre_emisor:    attr('Emisor',       'Nombre'),
    rfc_receptor:     attr('Receptor',     'Rfc'),
    nombre_receptor:  attr('Receptor',     'Nombre'),
    folio:            attr('Comprobante', 'Folio'),
    serie:            attr('Comprobante', 'Serie'),
    tipo_comprobante: attr('Comprobante', 'TipoDeComprobante'),
    subtotal:     num(attr('Comprobante', 'SubTotal')),
    descuento,
    iva,
    ieps,
    retencion_iva,
    retencion_isr,
    total:        num(attr('Comprobante', 'Total')),
    fecha:        attr('Comprobante', 'Fecha'),
    metodo_pago:  attr('Comprobante', 'MetodoPago'),
    forma_pago:   attr('Comprobante', 'FormaPago'),
    conceptos,
  };
}
