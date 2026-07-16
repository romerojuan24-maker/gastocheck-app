/**
 * CFDI Parser - Extrae datos estructurados de comprobantes fiscales XML
 * Soporta CFDI 3.3 y 4.0
 */

export interface CFDIData {
  rfc_emisor: string;
  nombre_emisor: string;
  rfc_receptor: string;
  nombre_receptor: string;
  folio: string;
  serie: string;
  fecha: string;
  total: number;
  subtotal: number;
  iva: number;
  tipo_comprobante: 'I' | 'E' | 'T' | 'P' | 'N' | 'C';
  conceptos: CFDIConcepto[];
  uuid?: string;
  estado?: string;
}

export interface CFDIConcepto {
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  importe: number;
  impuestos?: {
    iva: number;
  };
}

/**
 * Parsea un XML CFDI y extrae datos estructurados
 */
export function parseCFDI(xmlContent: string): CFDIData | null {
  try {
    // Crear parser DOM simple (funciona en React Native)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Validar que sea un CFDI válido
    const comprobante = xmlDoc.querySelector('Comprobante');
    if (!comprobante) return null;

    // Extraer atributos raíz
    const rfc_emisor = comprobante.getAttribute('Emisor')?.split('|')[0] || '';
    const rfc_receptor = comprobante.getAttribute('Receptor')?.split('|')[0] || '';
    const folio = comprobante.getAttribute('Folio') || '';
    const serie = comprobante.getAttribute('Serie') || '';
    const fecha = comprobante.getAttribute('Fecha') || new Date().toISOString();
    const total = parseFloat(comprobante.getAttribute('Total') || '0');
    const subtotal = parseFloat(comprobante.getAttribute('SubTotal') || '0');
    const tipo = (comprobante.getAttribute('TipoDeComprobante') || 'I') as CFDIData['tipo_comprobante'];
    const uuid = comprobante.querySelector('TimbreFiscalDigital')?.getAttribute('UUID') || '';

    // Extraer datos del emisor
    const emisorNode = comprobante.querySelector('Emisor');
    const nombre_emisor = emisorNode?.getAttribute('Nombre') || '';

    // Extraer datos del receptor
    const receptorNode = comprobante.querySelector('Receptor');
    const nombre_receptor = receptorNode?.getAttribute('Nombre') || '';

    // Extraer conceptos
    const conceptos: CFDIConcepto[] = [];
    const conceptosNodes = comprobante.querySelectorAll('Concepto');
    conceptosNodes.forEach((concepto) => {
      const descripcion = concepto.getAttribute('Descripcion') || '';
      const cantidad = parseFloat(concepto.getAttribute('Cantidad') || '0');
      const valor_unitario = parseFloat(concepto.getAttribute('ValorUnitario') || '0');
      const importe = parseFloat(concepto.getAttribute('Importe') || '0');

      conceptos.push({
        descripcion,
        cantidad,
        valor_unitario,
        importe,
      });
    });

    // Calcular IVA
    const impuestosNode = comprobante.querySelector('Impuestos');
    const ivaTotal = parseFloat(impuestosNode?.getAttribute('TotalImpuestosTrasladados') || '0');

    return {
      rfc_emisor,
      nombre_emisor,
      rfc_receptor,
      nombre_receptor,
      folio,
      serie,
      fecha,
      total,
      subtotal,
      iva: ivaTotal,
      tipo_comprobante: tipo,
      conceptos,
      uuid,
      estado: 'importado',
    };
  } catch (error) {
    console.error('Error parsing CFDI:', error);
    return null;
  }
}

/**
 * Valida si un XML es un CFDI válido
 */
export function isValidCFDI(xmlContent: string): boolean {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    return !!xmlDoc.querySelector('Comprobante');
  } catch {
    return false;
  }
}

/**
 * Extrae RFC de un CFDI XML
 */
export function extractRFC(xmlContent: string, role: 'emisor' | 'receptor'): string {
  try {
    const data = parseCFDI(xmlContent);
    return role === 'emisor' ? data?.rfc_emisor || '' : data?.rfc_receptor || '';
  } catch {
    return '';
  }
}
