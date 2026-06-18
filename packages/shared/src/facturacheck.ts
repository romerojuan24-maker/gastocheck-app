// ── FacturaCheck — tipos compartidos ─────────────────────────────────────────

export type CfdiStatus =
  | 'vigente'
  | 'cancelado'
  | 'not_found'
  | 'duplicate'
  | 'unmatched'
  | 'matched'
  | 'pending_complement';

export type CfdiDirection = 'received' | 'issued';
export type CfdiType = 'I' | 'E' | 'P' | 'T';  // Ingreso | Egreso | Pago | Traslado

export interface CfdiDocument {
  id:                     string;
  company_id:             string;
  direction:              CfdiDirection;
  uuid_cfdi:              string;
  rfc_emisor:             string;
  razon_social_emisor:    string | null;
  rfc_receptor:           string;
  razon_social_receptor:  string | null;
  fecha_emision:          string | null;
  subtotal:               number | null;
  iva:                    number | null;
  ieps:                   number | null;
  retenciones:            number | null;
  total:                  number | null;
  metodo_pago:            string | null;
  forma_pago:             string | null;
  uso_cfdi:               string | null;
  tipo_comprobante:       CfdiType | null;
  status:                 CfdiStatus;
  xml_storage_path:       string | null;
  pdf_storage_path:       string | null;
  related_receipt_id:     string | null;
  related_cobra_invoice_id: string | null;
  related_bank_txn_id:    string | null;
  sat_validated_at:       string | null;
  created_at:             string;
  updated_at:             string;
}

export interface CfdiIssueRequest {
  id:                    string;
  company_id:            string;
  cfdi_type:             'ingreso' | 'egreso' | 'pago' | 'traslado';
  receptor_rfc:          string;
  receptor_razon_social: string | null;
  receptor_uso_cfdi:     string;
  receptor_codigo_postal: string | null;
  receptor_regimen:      string | null;
  items:                 CfdiLineItem[];
  subtotal:              number | null;
  iva:                   number | null;
  total:                 number | null;
  status:                'draft' | 'pending' | 'timbrado' | 'cancelled' | 'error';
  uuid_cfdi:             string | null;
  provider:              string;
  error_message:         string | null;
  requested_by:          string | null;
  timbrado_at:           string | null;
  created_at:            string;
  updated_at:            string;
}

export interface CfdiLineItem {
  description:    string;
  quantity:       number;
  unit:           string;
  unit_price:     number;
  subtotal:       number;
  iva_rate:       number;
  clave_prod_serv?: string;
  clave_unidad?:  string;
}

export interface CfdiProviderConfig {
  id:                   string;
  company_id:           string;
  provider:             'facturama' | 'facturapia' | 'finkok';
  rfc:                  string;
  razon_social:         string | null;
  regimen_fiscal:       string | null;
  codigo_postal_fiscal: string | null;
  mode:                 'sandbox' | 'production';
  is_active:            boolean;
  created_at:           string;
  updated_at:           string;
}

export const CFDI_STATUS_META: Record<CfdiStatus, { label: string; color: string; icon: string }> = {
  vigente:            { label: 'Vigente',              color: '#43A047', icon: '✓'  },
  cancelado:          { label: 'Cancelado',            color: '#E53935', icon: '✕'  },
  not_found:          { label: 'No encontrado en SAT', color: '#FB8C00', icon: '?'  },
  duplicate:          { label: 'Duplicado',            color: '#7B1FA2', icon: '⚡' },
  unmatched:          { label: 'Sin relacionar',       color: '#90A4AE', icon: '○'  },
  matched:            { label: 'Relacionado',          color: '#1565C0', icon: '🔗' },
  pending_complement: { label: 'Falta complemento',    color: '#FF9800', icon: '⏳' },
};

export const CFDI_TYPE_LABELS: Record<CfdiType, string> = {
  I: 'Ingreso',
  E: 'Egreso',
  P: 'Pago',
  T: 'Traslado',
};

export const USO_CFDI_LABELS: Record<string, string> = {
  G01: 'Adquisición de mercancias',
  G02: 'Devoluciones, descuentos o bonificaciones',
  G03: 'Gastos en general',
  I01: 'Construcciones',
  D01: 'Honorarios médicos',
  S01: 'Sin efectos fiscales',
  CP01: 'Pagos',
};

export const FORMA_PAGO_LABELS: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque',
  '03': 'Transferencia',
  '04': 'Tarjeta crédito',
  '28': 'Tarjeta débito',
  '99': 'Por definir',
};
