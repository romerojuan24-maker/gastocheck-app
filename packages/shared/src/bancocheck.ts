// ── BancoCheck — tipos compartidos ───────────────────────────────────────────

export type BankTransactionStatus =
  | 'new'
  | 'matched'
  | 'explained'
  | 'personal'
  | 'ignored'
  | 'pending_document'
  | 'pending_invoice'
  | 'unidentified';

export type BankTransactionCategory =
  | 'expense'
  | 'collection'
  | 'advance'
  | 'supplier'
  | 'client'
  | 'personal'
  | 'transfer'
  | 'ignore';

export interface BankAccount {
  id:              string;
  company_id:      string;
  name:            string;
  bank_name:       string | null;
  last4:           string | null;
  currency:        string;
  current_balance: number;
  is_active:       boolean;
  notes:           string | null;
  created_at:      string;
  updated_at:      string;
}

export interface BankTransaction {
  id:               string;
  company_id:       string;
  bank_account_id:  string;
  transaction_date: string;
  description:      string;
  reference:        string | null;
  amount:           number;
  balance_after:    number | null;
  status:           BankTransactionStatus;
  category:         BankTransactionCategory | null;
  notes:            string | null;
  related_receipt_id:  string | null;
  related_invoice_id:  string | null;
  related_advance_id:  string | null;
  imported_from:    string;
  import_batch_id:  string | null;
  created_at:       string;
  updated_at:       string;
}

export interface BankMatchSuggestion {
  id:             string;
  company_id:     string;
  transaction_id: string;
  match_type:     'receipt' | 'invoice' | 'advance' | 'client' | 'supplier';
  match_id:       string;
  confidence:     number;
  status:         'pending' | 'accepted' | 'rejected';
  created_at:     string;
}

export const BANK_TRANSACTION_STATUS_META: Record<BankTransactionStatus, {
  label: string; color: string; semaforo: 'green' | 'yellow' | 'red' | 'gray';
}> = {
  new:              { label: 'Nuevo',                   color: '#90A4AE', semaforo: 'gray'   },
  matched:          { label: 'Probable coincidencia',   color: '#FB8C00', semaforo: 'yellow' },
  explained:        { label: 'Explicado',               color: '#43A047', semaforo: 'green'  },
  personal:         { label: 'Personal',                color: '#90A4AE', semaforo: 'gray'   },
  ignored:          { label: 'Ignorado',                color: '#B0BEC5', semaforo: 'gray'   },
  pending_document: { label: 'Falta comprobante',       color: '#FF9800', semaforo: 'yellow' },
  pending_invoice:  { label: 'Falta factura',           color: '#FF9800', semaforo: 'yellow' },
  unidentified:     { label: 'Sin identificar',         color: '#E53935', semaforo: 'red'    },
};

export const BANK_CATEGORY_LABELS: Record<BankTransactionCategory, string> = {
  expense:    'Gasto',
  collection: 'Cobranza',
  advance:    'Anticipo',
  supplier:   'Proveedor',
  client:     'Cliente',
  personal:   'Personal',
  transfer:   'Transferencia',
  ignore:     'Ignorar',
};

export function parseBankCSVRow(row: Record<string, string>): Partial<BankTransaction> {
  const clean = (v: string | undefined) => (v ?? '').trim();
  const num = (v: string | undefined) => {
    const n = parseFloat(clean(v).replace(/,/g, '').replace(/\$/g, ''));
    return isNaN(n) ? 0 : n;
  };
  return {
    transaction_date: clean(row['Fecha'] ?? row['fecha'] ?? row['Date'] ?? row['date']),
    description:      clean(row['Descripción'] ?? row['descripcion'] ?? row['Concepto'] ?? row['Description'] ?? ''),
    reference:        clean(row['Referencia'] ?? row['referencia'] ?? row['Reference']) || null,
    amount:           num(row['Cargo'] ?? row['cargo'])
                      ? -num(row['Cargo'] ?? row['cargo'])
                      : num(row['Abono'] ?? row['abono'] ?? row['Deposito'] ?? row['Monto'] ?? row['Amount']),
    balance_after:    num(row['Saldo'] ?? row['saldo'] ?? row['Balance']) || null,
    status:           'new',
    imported_from:    'csv',
  };
}
