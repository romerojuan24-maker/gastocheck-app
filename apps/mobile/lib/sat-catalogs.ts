// Catálogos SAT (CFDI 4.0) para los comboboxes de emisión. Son los valores
// más usados de cada catálogo oficial; el usuario elige de la lista en vez de
// teclear códigos. (Para clave de producto/servicio el catálogo real tiene
// ~60k entradas, así que se ofrecen las claves comunes + captura manual.)

export interface SatOption { code: string; label: string }

// c_UsoCFDI
export const USO_CFDI: SatOption[] = [
  { code: 'G01', label: 'G01 · Adquisición de mercancías' },
  { code: 'G02', label: 'G02 · Devoluciones, descuentos o bonificaciones' },
  { code: 'G03', label: 'G03 · Gastos en general' },
  { code: 'I01', label: 'I01 · Construcciones' },
  { code: 'I02', label: 'I02 · Mobiliario y equipo de oficina' },
  { code: 'I04', label: 'I04 · Equipo de cómputo' },
  { code: 'I08', label: 'I08 · Otra maquinaria y equipo' },
  { code: 'P01', label: 'P01 · Por definir' },
  { code: 'S01', label: 'S01 · Sin efectos fiscales' },
  { code: 'CP01', label: 'CP01 · Pagos' },
]

// c_RegimenFiscal
export const REGIMEN_FISCAL: SatOption[] = [
  { code: '601', label: '601 · General de Ley Personas Morales' },
  { code: '603', label: '603 · Personas Morales con Fines no Lucrativos' },
  { code: '605', label: '605 · Sueldos y Salarios' },
  { code: '606', label: '606 · Arrendamiento' },
  { code: '607', label: '607 · Enajenación/adquisición de bienes' },
  { code: '612', label: '612 · Personas Físicas con Actividades Empresariales' },
  { code: '614', label: '614 · Ingresos por intereses' },
  { code: '616', label: '616 · Sin obligaciones fiscales' },
  { code: '621', label: '621 · Incorporación Fiscal' },
  { code: '626', label: '626 · Régimen Simplificado de Confianza (RESICO)' },
]

// c_FormaPago
export const FORMA_PAGO: SatOption[] = [
  { code: '01', label: '01 · Efectivo' },
  { code: '02', label: '02 · Cheque nominativo' },
  { code: '03', label: '03 · Transferencia electrónica' },
  { code: '04', label: '04 · Tarjeta de crédito' },
  { code: '28', label: '28 · Tarjeta de débito' },
  { code: '99', label: '99 · Por definir' },
]

// c_MetodoPago
export const METODO_PAGO: SatOption[] = [
  { code: 'PUE', label: 'PUE · Pago en una sola exhibición' },
  { code: 'PPD', label: 'PPD · Pago en parcialidades o diferido' },
]

// c_ClaveUnidad (comunes)
export const CLAVE_UNIDAD: SatOption[] = [
  { code: 'H87', label: 'H87 · Pieza' },
  { code: 'E48', label: 'E48 · Unidad de servicio' },
  { code: 'ACT', label: 'ACT · Actividad' },
  { code: 'KGM', label: 'KGM · Kilogramo' },
  { code: 'LTR', label: 'LTR · Litro' },
  { code: 'MTR', label: 'MTR · Metro' },
  { code: 'HUR', label: 'HUR · Hora' },
  { code: 'DAY', label: 'DAY · Día' },
  { code: 'MON', label: 'MON · Mes' },
  { code: 'XBX', label: 'XBX · Caja' },
]

// c_ClaveProdServ (comunes; el catálogo real es enorme → permitir captura manual)
export const CLAVE_PROD_SERV: SatOption[] = [
  { code: '01010101', label: '01010101 · No existe en el catálogo' },
  { code: '84111506', label: '84111506 · Servicios de facturación' },
  { code: '80141600', label: '80141600 · Actividades de ventas y promoción' },
  { code: '81111500', label: '81111500 · Ingeniería de software o hardware' },
  { code: '78102200', label: '78102200 · Servicios de transporte de carga' },
  { code: '90101500', label: '90101500 · Servicios de comida y bebida' },
  { code: '43231500', label: '43231500 · Software' },
  { code: '80101500', label: '80101500 · Servicios de consultoría de negocios' },
]
