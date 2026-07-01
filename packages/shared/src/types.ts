// GastoCheck — Tipos de dominio compartidos (web + móvil)

// ── Enums / literales ────────────────────────────────────────────────────────

export type MemberRole =
  | 'owner' | 'supervisor' | 'spender' | 'operator'
  | 'office' | 'admin' | 'accountant' | 'superadmin';

export type CompanyPlan = 'basico' | 'equipo' | 'empresa' | 'corporativo';
export type PolicyStatus = 'open' | 'closed';
export type AdvanceMethod = 'transfer' | 'cash' | 'card' | 'other';
export type AttachmentKind = 'ticket' | 'pdf' | 'xml' | 'payment' | 'receipt';
export type CostCenterType =
  | 'obra' | 'ruta' | 'proyecto' | 'lote' | 'cliente' | 'unidad' | 'sucursal' | 'otro';

export type ExpenseStatus =
  | 'captured' | 'pending_auth' | 'authorized' | 'pending_invoice'
  | 'invoice_applied' | 'observed' | 'rejected' | 'deleted'
  | 'duplicate' | 'closed_in_policy';

export type ReceiptStatus =
  | 'captured' | 'submitted' | 'approved' | 'rejected'
  | 'included_in_batch' | 'exported' | 'cancelled';

export type DuplicateStatus =
  | 'no_duplicate' | 'possible_duplicate' | 'strong_duplicate'
  | 'blocked_duplicate' | 'manually_approved_duplicate';

export type MatchType =
  | 'fiscal_uuid' | 'file_hash' | 'image_phash'
  | 'provider_date_amount' | 'rfc_date_amount' | 'ocr_similarity';

export type BatchStatus = 'draft' | 'open' | 'closed' | 'exported' | 'cancelled';

export type CompanySector =
  | 'agro' | 'construccion' | 'alimentos' | 'transportistas'
  | 'distribucion' | 'servicios_tecnicos' | 'manufactura' | 'comercio'
  | 'flotillas' | 'otro';

// ── Fleet / Flotillas ────────────────────────────────────────────────────────

export type VehicleType = 'sedan' | 'suv' | 'van' | 'pickup' | 'camion' | 'moto' | 'otro';
export type VehicleStatus = 'active' | 'maintenance' | 'inactive';
export type OperatorStatus = 'active' | 'inactive' | 'suspended';
export type FleetClientType = 'regular' | 'occasional' | 'corporate';

export interface FleetVehicle {
  id:               string;
  company_id:       string;
  economic_number:  string | null;
  plates:           string | null;
  brand:            string | null;
  model:            string | null;
  year:             number | null;
  vehicle_type:     VehicleType;
  current_km:       number | null;
  status:           VehicleStatus;
  notes:            string | null;
  created_at:       string;
}

export interface FleetOperator {
  id:                  string;
  company_id:          string;
  name:                string;
  phone:               string | null;
  license_number:      string | null;
  status:              OperatorStatus;
  assigned_vehicle_id: string | null;
  notes:               string | null;
  created_at:          string;
}

export interface FleetRoute {
  id:           string;
  company_id:   string;
  name:         string;
  zone:         string | null;
  city:         string | null;
  distance_km:  number | null;
  is_active:    boolean;
  created_at:   string;
}

export interface FleetClient {
  id:          string;
  company_id:  string;
  name:        string;
  address:     string | null;
  client_type: FleetClientType;
  is_active:   boolean;
  created_at:  string;
}

export type TagType =
  | 'obra' | 'rancho' | 'lote' | 'cultivo' | 'unidad' | 'ruta'
  | 'tecnico' | 'cliente' | 'proyecto' | 'temporada' | 'maquinaria' | 'otro';

export type ExportSystemType =
  | 'universal_excel' | 'contpaqi' | 'aspel_coi' | 'microsip' | 'custom';

export type RiskLevel = 'low' | 'medium' | 'high';

// ── Entidades principales ────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  rfc: string | null;
  plan: CompanyPlan;
  plan_seats: number;
  allow_supervisor_close: boolean;
  sector: CompanySector | null;
}

export interface Policy {
  id: string;
  company_id: string;
  holder_id: string;
  name: string;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number;
  closing_balance: number | null;
  status: PolicyStatus;
  policy_type: 'anticipo' | 'reembolso';
  previous_policy_id: string | null;
  closed_at: string | null;
}

export interface Advance {
  id: string;
  company_id: string;
  policy_id: string;
  amount: number;
  method: AdvanceMethod;
  reference: string | null;
  concept: string | null;
  attachment_url: string | null;
  date: string;
  created_by: string;
  created_at: string;
}

export interface Expense {
  id: string;
  company_id: string;
  policy_id: string;
  spender_id: string;
  category_id: string | null;
  cost_center_id: string | null;
  provider_name: string | null;
  provider_rfc: string | null;
  subtotal: number | null;
  iva: number | null;
  total: number;
  expense_date: string | null;
  status: ExpenseStatus;
  notes: string | null;
  authorized_by: string | null;
  authorized_at: string | null;
  receipt_id: string | null;
  rejection_reason: string | null;
}

export interface CfdiData {
  expense_id: string;
  uuid: string;
  rfc_emisor: string;
  rfc_receptor: string;
  subtotal: number;
  descuento: number;
  iva: number;
  ieps: number;
  retencion_iva: number;
  retencion_isr: number;
  total: number;
  fecha: string;
  metodo_pago: string;
  forma_pago: string;
  conceptos: { descripcion: string; importe: number; cantidad?: number }[];
}

export interface PolicyBalance {
  opening: number;
  advances: number;
  authorizedSpent: number;
  available: number;
  pendingToVerify: number;
}

// ── Comprobantes (receipts) ───────────────────────────────────────────────────

export interface Receipt {
  id: string;
  company_id: string;
  uploaded_by: string;
  employee_id: string | null;
  source_type: 'photo' | 'pdf' | 'xml' | 'manual';

  provider_name: string | null;
  normalized_provider_name: string | null;
  provider_rfc: string | null;
  supplier_id: string | null;

  receipt_date: string | null;
  receipt_time: string | null;

  total_amount: number | null;
  subtotal_amount: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  ieps_amount: number | null;
  ish_amount: number | null;
  retencion_iva: number | null;
  retencion_isr: number | null;
  currency: string;

  fiscal_uuid: string | null;
  internal_folio: string | null;
  payment_method: string | null;

  ocr_text: string | null;
  ocr_confidence: number | null;
  extracted_json: Record<string, unknown> | null;

  file_url: string | null;
  file_storage_path: string | null;
  file_sha256: string | null;
  image_phash: string | null;

  duplicate_status: DuplicateStatus;
  duplicate_score: number | null;
  duplicate_of_receipt_id: string | null;
  duplicate_reason: string | null;

  status: ReceiptStatus;
  category_id: string | null;
  cost_center_id: string | null;
  notes: string | null;
  rejection_reason: string | null;
  batch_id: string | null;

  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;

  created_at: string;
  updated_at: string;
}

// ── OCR ──────────────────────────────────────────────────────────────────────

export interface OcrLineItem {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  confidence?: number;
}

export interface OcrResult {
  providerName?: string | null;
  providerRfc?: string | null;
  receiptDate?: string | null;
  receiptTime?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  ieps?: number | null;
  ish?: number | null;
  retencionIva?: number | null;
  retencionIsr?: number | null;
  total?: number | null;
  currency?: string;
  fiscalUuid?: string | null;
  internalFolio?: string | null;
  paymentMethod?: string | null;
  fullText: string;
  lineItems?: OcrLineItem[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  documentBox?: { x0: number; y0: number; x1: number; y1: number } | null;
}

// ── Proveedores ───────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  normalized_name: string;
  rfc: string | null;
  phone: string | null;
  email: string | null;
  canonical_supplier_id: string | null;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  total_purchases: number;
  purchase_count: number;
}

// ── Conceptos/productos ───────────────────────────────────────────────────────

export interface PurchaseItem {
  id: string;
  company_id: string;
  receipt_id: string;
  item_name: string;
  normalized_item_name: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  extracted_by: 'manual' | 'ocr' | 'xml';
  confidence: number | null;
  created_at: string;
}

// ── Relaciones / Cierres ──────────────────────────────────────────────────────

export interface ReceiptBatch {
  id: string;
  company_id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: BatchStatus;
  notes: string | null;
  reopen_reason: string | null;
  total_amount: number | null;
  receipt_count: number | null;
  created_by: string;
  closed_by: string | null;
  exported_by: string | null;
  reopened_by: string | null;
  created_at: string;
  closed_at: string | null;
  exported_at: string | null;
  reopened_at: string | null;
}

// ── Duplicados ────────────────────────────────────────────────────────────────

export interface ReceiptDuplicateMatch {
  id: string;
  company_id: string;
  receipt_id: string;
  matched_receipt_id: string;
  match_type: MatchType;
  match_score: number | null;
  match_reason: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolution: 'confirmed_duplicate' | 'false_positive' | 'manually_allowed' | null;
  resolution_reason: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ── Etiquetas ─────────────────────────────────────────────────────────────────

export interface ExpenseTag {
  id: string;
  company_id: string;
  name: string;
  tag_type: TagType | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Exportación contable ──────────────────────────────────────────────────────

export interface AccountingExportProfile {
  id: string;
  company_id: string;
  name: string;
  system_type: ExportSystemType;
  config_json: Record<string, unknown>;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AccountingCategoryMap {
  id: string;
  company_id: string;
  expense_category_id: string | null;
  cost_center_id: string | null;
  accounting_account: string;
  tax_account: string | null;
  counterpart_account: string | null;
  department_code: string | null;
  segment_code: string | null;
  export_profile_id: string | null;
}

// ── Categorías ────────────────────────────────────────────────────────────────

export interface ExpenseCategory {
  id: string;
  company_id: string;
  name: string;
  parent_id: string | null;
  active: boolean;
  is_custom: boolean;
  is_template: boolean;
  sector: string | null;
  acct_code: string | null;
  display_order: number;
}

export interface CategoryTemplate {
  id: string;
  sector: string;
  name: string;
  parent_name: string | null;
  description: string | null;
  is_default: boolean;
  display_order: number;
}

// ── Score de riesgo ───────────────────────────────────────────────────────────

export interface RiskFactor {
  reason: string;
  weight: number;
}

export interface RiskScore {
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
}
