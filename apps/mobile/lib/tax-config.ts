import type { RegionCode } from './regions';

export interface TaxConfig {
  vat: number;
  localTaxes: { name: string; rate: number }[];
  retentions: { name: string; rate: number }[];
}

export const TAX_CONFIGS: Record<RegionCode, TaxConfig> = {
  MX: {
    vat: 16,
    localTaxes: [
      { name: 'IEPS (Combustibles)', rate: 38 },
      { name: 'IEPS (Bebidas)', rate: 20 },
      { name: 'ISH (Hospedaje)', rate: 3 },
    ],
    retentions: [
      { name: 'Retención IVA', rate: 6.67 },
      { name: 'Retención ISR', rate: 10 },
    ],
  },
  BR: {
    vat: 0, // ICMS varía por estado
    localTaxes: [
      { name: 'ICMS (São Paulo)', rate: 18 },
      { name: 'ICMS (Minas Gerais)', rate: 18 },
      { name: 'PIS', rate: 1.65 },
      { name: 'COFINS', rate: 7.6 },
    ],
    retentions: [
      { name: 'Imposto de Renda', rate: 15 },
      { name: 'Contribuição Social', rate: 9 },
    ],
  },
  AR: {
    vat: 21,
    localTaxes: [
      { name: 'Impuesto al Combustible', rate: 1.1 },
      { name: 'Impuesto Inmobiliario', rate: 1.5 },
    ],
    retentions: [
      { name: 'Retención IVA', rate: 10.5 },
      { name: 'Retención Ganancias', rate: 17 },
    ],
  },
  CO: {
    vat: 19,
    localTaxes: [
      { name: 'ICA (Bogotá)', rate: 3.5 },
      { name: 'ICA (Cali)', rate: 3 },
      { name: 'Consumo (Bebidas)', rate: 8 },
    ],
    retentions: [
      { name: 'Retención en la Fuente', rate: 2.5 },
      { name: 'Retención IVA', rate: 15 },
    ],
  },
  CL: {
    vat: 19,
    localTaxes: [
      { name: 'Impuesto Adicional', rate: 0.5 },
      { name: 'Impuesto Específico', rate: 1 },
    ],
    retentions: [
      { name: 'Retención IVA', rate: 50 },
      { name: 'Retención Renta', rate: 10 },
    ],
  },
  PE: {
    vat: 18,
    localTaxes: [
      { name: 'IPM (Impuesto Selectivo)', rate: 8 },
      { name: 'Derecho Arancelario', rate: 6 },
    ],
    retentions: [
      { name: 'Retención IGV', rate: 50 },
      { name: 'Retención Renta', rate: 8 },
    ],
  },
  ES: {
    vat: 21,
    localTaxes: [
      { name: 'IVA Reducido', rate: 10 },
      { name: 'IVA Superreducido', rate: 4 },
      { name: 'Impuesto Especiales', rate: 2.5 },
    ],
    retentions: [
      { name: 'Retención IRPF', rate: 15 },
      { name: 'Retención Profesional', rate: 19 },
    ],
  },
  US: {
    vat: 0,
    localTaxes: [
      { name: 'Sales Tax (NY)', rate: 8.875 },
      { name: 'Sales Tax (CA)', rate: 7.25 },
      { name: 'Sales Tax (TX)', rate: 6.25 },
      { name: 'Sales Tax (FL)', rate: 6 },
    ],
    retentions: [
      { name: 'Federal Income Tax', rate: 22 },
      { name: 'FICA (Social Security)', rate: 6.2 },
      { name: 'Medicare', rate: 1.45 },
    ],
  },
};

export function getTaxConfig(region: RegionCode): TaxConfig {
  return TAX_CONFIGS[region] || TAX_CONFIGS.MX;
}

export function calculateTotalTax(
  region: RegionCode,
  subtotal: number,
  customVAT?: number
): { vat: number; localTaxes: number; retentions: number; total: number } {
  const config = getTaxConfig(region);
  const vat = customVAT ?? config.vat;

  const vatAmount = (subtotal * vat) / 100;
  const localTaxAmount = (subtotal * config.localTaxes[0].rate) / 100;
  const retentionAmount = (subtotal * config.retentions[0].rate) / 100;

  return {
    vat: vatAmount,
    localTaxes: localTaxAmount,
    retentions: retentionAmount,
    total: subtotal + vatAmount + localTaxAmount - retentionAmount,
  };
}
