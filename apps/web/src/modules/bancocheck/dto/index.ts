// BancoCheck DTOs

// ============================================================================
// INPUT
// ============================================================================

export class CreateBankAccountDto {
  tenantId: string;
  name: string;
  bankName: string;
  accountNumberLast4: string;
  currency?: string; // default MXN
  type: string; // corriente, ahorros
  importedBalance: string; // DECIMAL as string
}

export class ImportBankStatementDto {
  tenantId: string;
  bankAccountId: string;
  fileName: string;
  csvData: string; // raw CSV content
  // Format expected: date,description,debit,credit,reference
  // date format: YYYY-MM-DD
}

export class ClassifyTransactionDto {
  status: string; // NEW, SUGGESTED_MATCH, EXPLAINED, NEEDS_RECEIPT, NEEDS_INVOICE, NEEDS_PAYMENT_COMPLEMENT, UNIDENTIFIED, PERSONAL, IGNORED
  category?: string; // gasto_negocio, proveedor, anticipo, reembolso, impuesto, comision_bancaria, prestamo, personal, otro
  notes?: string;
}

export class MatchTransactionDto {
  entityType: string; // invoice, receipt, expense, advance, collection, payment
  entityId: string;
  confidence?: number; // 0-100
}

export class MarkPersonalDto {
  isPersonal: boolean;
}

export class IgnoreTransactionDto {
  reason?: string;
}

// ============================================================================
// OUTPUT
// ============================================================================

export class BankAccountDto {
  id: string;
  tenantId: string;
  name: string;
  bankName: string;
  accountNumberLast4: string;
  currency: string;
  type: string;
  importedBalance: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

export class BankTransactionDto {
  id: string;
  tenantId: string;
  bankAccountId: string;
  date: Date;
  description: string;
  reference?: string;
  debit: string;
  credit: string;
  balanceAfter: string;
  currency: string;
  importBatchId: string;
  uniqueHash: string;
  status: string;
  category?: string;
  matchedEntityType?: string;
  matchedEntityId?: string;
  confidence?: number;
  isPersonal: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BankImportBatchDto {
  id: string;
  tenantId: string;
  bankAccountId: string;
  fileName: string;
  fileHash: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  status: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

export class BankMatchSuggestionDto {
  id: string;
  tenantId: string;
  bankTransactionId: string;
  entityType: string;
  entityId: string;
  confidence: number;
  reason: string;
  accepted: boolean;
  dismissed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BankDashboardDto {
  totalAccounts: number;
  totalTransactions: number;
  totalAmount: string;
  unexplainedCount: number;
  needsReceiptCount: number;
  needsInvoiceCount: number;
  needsPaymentComplementCount: number;
  personalCount: number;
  ignoredCount: number;
  explainedCount: number;
  explainedPercentage: number;
  recentTransactions: BankTransactionDto[];
  suggestions: BankMatchSuggestionDto[];
}

export class ImportResultDto {
  batchId: string;
  fileName: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  status: string;
  errors: string[];
}
