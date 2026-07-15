import type { RegionCode } from './regions';

// RFC (México) — Formato: ABC123456XYZ (3-4 letras + 6 dígitos + 3 caracteres)
export function validateRFC(rfc: string): boolean {
  const pattern = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
  return pattern.test(rfc.toUpperCase());
}

// CNPJ (Brasil) — 14 dígitos, válido por check digit
export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;

  let sum = 0;
  let remainder = 0;

  for (let i = 1; i <= 8; i++) {
    sum += parseInt(digits.substring(i - 1, i)) * (9 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.substring(8, 9))) return false;

  sum = 0;
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(digits.substring(i - 1, i)) * (10 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.substring(9, 10))) return false;

  return true;
}

// CPF (Brasil) — 11 dígitos, válido por check digit
export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = 11 - (sum % 11);
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;

  return true;
}

// CUIT (Argentina) — 11 dígitos
export function validateCUIT(cuit: string): boolean {
  const digits = cuit.replace(/\D/g, '');
  return digits.length === 11;
}

// NIT (Colombia) — 5-15 dígitos
export function validateNIT(nit: string): boolean {
  const digits = nit.replace(/\D/g, '');
  return digits.length >= 5 && digits.length <= 15;
}

// RUT (Chile) — Formato: 12345678-K o 12345678-9
export function validateRUT(rut: string): boolean {
  const pattern = /^\d{1,8}-[\dK]$/;
  return pattern.test(rut.toUpperCase());
}

// RUC (Perú) — 11 dígitos
export function validateRUC(ruc: string): boolean {
  const digits = ruc.replace(/\D/g, '');
  return digits.length === 11;
}

// NIF/CIF (España) — Formato: A12345678
export function validateNIF(nif: string): boolean {
  const pattern = /^[A-Z]{1,2}\d{7,8}[0-9A-J]$/;
  return pattern.test(nif.toUpperCase());
}

// EIN (USA) — Formato: 12-3456789
export function validateEIN(ein: string): boolean {
  const pattern = /^\d{2}-\d{7}$/;
  return pattern.test(ein);
}

export function validateID(regionCode: RegionCode, idValue: string): boolean {
  const id = idValue.trim().toUpperCase();

  switch (regionCode) {
    case 'MX':
      return validateRFC(id);
    case 'BR':
      return validateCNPJ(id) || validateCPF(id);
    case 'AR':
      return validateCUIT(id);
    case 'CO':
      return validateNIT(id);
    case 'CL':
      return validateRUT(id);
    case 'PE':
      return validateRUC(id);
    case 'ES':
      return validateNIF(id);
    case 'US':
      return validateEIN(id);
    default:
      return true;
  }
}

export function getIDValidationHint(regionCode: RegionCode): string {
  const hints: Record<RegionCode, string> = {
    MX: 'RFC formato: ABC123456XYZ',
    BR: 'CNPJ (14) o CPF (11)',
    AR: 'CUIT formato: 11 dígitos',
    CO: 'NIT: 5-15 dígitos',
    CL: 'RUT formato: 12345678-K',
    PE: 'RUC: 11 dígitos',
    ES: 'NIF/CIF formato: A12345678',
    US: 'EIN formato: 12-3456789',
  };
  return hints[regionCode] || '';
}
