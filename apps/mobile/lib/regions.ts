export type RegionCode = 'MX' | 'BR' | 'AR' | 'CO' | 'CL' | 'PE' | 'ES' | 'US';

export const REGIONS = {
  MX: {
    name: 'México',
    emoji: '🇲🇽',
    currency: 'MXN',
    language: 'es',
    taxSystem: 'CFDI',
    defaultVAT: 16,
    idType: 'RFC',
    idPattern: /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/,
    invoiceSystem: 'CFDI 4.0',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  BR: {
    name: 'Brasil',
    emoji: '🇧🇷',
    currency: 'BRL',
    language: 'pt-BR',
    taxSystem: 'NF-e',
    defaultVAT: 0, // ICMS varies by state
    idType: 'CNPJ/CPF',
    idPattern: /^\d{11,14}$/,
    invoiceSystem: 'NF-e 4.0',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  AR: {
    name: 'Argentina',
    emoji: '🇦🇷',
    currency: 'ARS',
    language: 'es',
    taxSystem: 'Factura Electrónica',
    defaultVAT: 21,
    idType: 'CUIT',
    idPattern: /^\d{11}$/,
    invoiceSystem: 'AFIP',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  CO: {
    name: 'Colombia',
    emoji: '🇨🇴',
    currency: 'COP',
    language: 'es',
    taxSystem: 'Factura Electrónica',
    defaultVAT: 19,
    idType: 'NIT',
    idPattern: /^\d{5,15}$/,
    invoiceSystem: 'DIAN',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  CL: {
    name: 'Chile',
    emoji: '🇨🇱',
    currency: 'CLP',
    language: 'es',
    taxSystem: 'DTE',
    defaultVAT: 19,
    idType: 'RUT',
    idPattern: /^\d{1,8}-[\dK]$/,
    invoiceSystem: 'SII',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  PE: {
    name: 'Perú',
    emoji: '🇵🇪',
    currency: 'PEN',
    language: 'es',
    taxSystem: 'CPE',
    defaultVAT: 18,
    idType: 'RUC',
    idPattern: /^\d{11}$/,
    invoiceSystem: 'SUNAT',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  ES: {
    name: 'España',
    emoji: '🇪🇸',
    currency: 'EUR',
    language: 'es',
    taxSystem: 'Factura Electrónica',
    defaultVAT: 21,
    idType: 'NIF/CIF',
    idPattern: /^[A-Z]{1,2}\d{7,8}[0-9A-J]$/,
    invoiceSystem: 'FacturaE',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  US: {
    name: 'United States',
    emoji: '🇺🇸',
    currency: 'USD',
    language: 'en',
    taxSystem: 'Sales Tax',
    defaultVAT: 0, // Varies by state
    idType: 'EIN',
    idPattern: /^\d{2}-\d{7}$/,
    invoiceSystem: 'State-based',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
} as const;

export function getRegion(code: RegionCode) {
  return REGIONS[code];
}

export function validateID(idType: string, idValue: string): boolean {
  const region = Object.values(REGIONS).find(r => r.idType.includes(idType));
  if (!region) return true; // Fallback: no validation
  return region.idPattern.test(idValue);
}

export function formatIDExample(regionCode: RegionCode): string {
  const examples: Record<RegionCode, string> = {
    MX: 'ABC123456XYZ',
    BR: '12345678901234',
    AR: '20123456789',
    CO: '12345678',
    CL: '12345678-K',
    PE: '20123456789',
    ES: 'A12345678',
    US: '12-3456789',
  };
  return examples[regionCode];
}
