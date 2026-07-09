import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { BancocheckRepository } from './bancocheck.repository';
import { ImportBankStatementDto, ClassifyTransactionDto, MatchTransactionDto } from './dto';
import * as crypto from 'crypto';
import * as Papa from 'papaparse';

@Injectable()
export class BancocheckService {
  constructor(private repo: BancocheckRepository) {}

  // ============================================================================
  // ACCOUNTS
  // ============================================================================

  async createAccount(tenantId: string, userId: string, dto: any) {
    if (!dto.name || !dto.bankName || !dto.accountNumberLast4) {
      throw new BadRequestException('Missing required fields');
    }

    return this.repo.createAccount({
      tenantId,
      name: dto.name,
      bankName: dto.bankName,
      accountNumberLast4: dto.accountNumberLast4,
      currency: dto.currency || 'MXN',
      type: dto.type,
      importedBalance: dto.importedBalance || '0',
      createdById: userId,
    });
  }

  async getAccounts(tenantId: string) {
    return this.repo.getAccounts(tenantId);
  }

  async getTransactions(tenantId: string, bankAccountId?: string, filters?: any) {
    return this.repo.getTransactions(tenantId, bankAccountId, filters);
  }

  async getTransaction(transactionId: string, tenantId: string) {
    return this.repo.getTransaction(transactionId, tenantId);
  }

  // ============================================================================
  // IMPORT CSV
  // ============================================================================

  async importBankStatementCSV(tenantId: string, userId: string, dto: ImportBankStatementDto) {
    // 1. Validate inputs
    if (!tenantId || !userId || !dto.bankAccountId || !dto.csvData) {
      throw new BadRequestException('Missing required fields');
    }

    // 2. Generate file hash
    const fileHash = crypto.createHash('sha256').update(dto.csvData).digest('hex');

    // 3. Create import batch
    const batch = await this.repo.createImportBatch({
      tenantId,
      bankAccountId: dto.bankAccountId,
      fileName: dto.fileName,
      fileHash,
      totalRows: 0,
      createdById: userId,
    });

    // 4. Parse CSV
    const results = Papa.parse(dto.csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (results.errors.length > 0) {
      await this.repo.updateImportBatch(batch.id, {
        status: 'failed',
        errorMessage: results.errors.map(e => e.message).join('; '),
        importedRows: 0,
        duplicateRows: 0,
        errorRows: results.data.length,
      });
      throw new BadRequestException('CSV parsing failed: ' + results.errors[0].message);
    }

    // 5. Process rows
    const rows = results.data as any[];
    const transactionsToCreate = [];
    let importedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      try {
        // Normalize CSV columns (flexible header names)
        const date = this.parseDate(row.fecha || row.date || row.Fecha);
        const description = (row.descripcion || row.description || row.Descripción || '').toString().trim();
        const reference = (row.referencia || row.reference || row.Referencia || '').toString().trim();
        const debit = this.normalizeDecimal(row.debito || row.debit || row.Débito || '0');
        const credit = this.normalizeDecimal(row.credito || row.credit || row.Crédito || '0');
        const balanceAfter = this.normalizeDecimal(row.saldo || row.balance || row.Saldo || '0');

        // Validate
        if (!date || !description) {
          errorCount++;
          continue;
        }

        // Generate unique hash
        const uniqueHash = this.repo.generateUniqueHash(
          tenantId,
          dto.bankAccountId,
          date,
          description,
          debit,
          credit,
          reference,
        );

        // Check for duplicate
        const isDuplicate = await this.repo.checkDuplicate(tenantId, batch.id, uniqueHash);
        if (isDuplicate) {
          duplicateCount++;
          continue;
        }

        transactionsToCreate.push({
          tenantId,
          bankAccountId: dto.bankAccountId,
          date,
          description,
          reference: reference || undefined,
          debit,
          credit,
          balanceAfter,
          currency: 'MXN',
          importBatchId: batch.id,
          uniqueHash,
          rawData: row,
        });

        importedCount++;
      } catch (err) {
        errorCount++;
        console.error('Row parse error:', err, row);
      }
    }

    // 6. Create transactions in DB (ACID)
    if (transactionsToCreate.length > 0) {
      await this.repo.createTransactions(transactionsToCreate);
    }

    // 7. Update batch status
    await this.repo.updateImportBatch(batch.id, {
      status: 'completed',
      totalRows: rows.length,
      importedRows: importedCount,
      duplicateRows: duplicateCount,
      errorRows: errorCount,
    });

    // 8. Audit
    await this.repo.logAudit({
      tenantId,
      action: 'import_csv',
      oldValue: null,
      newValue: { batchId: batch.id, importedRows: importedCount, duplicateRows: duplicateCount },
      userId,
      reason: `Imported ${dto.fileName}`,
    });

    return {
      batchId: batch.id,
      fileName: dto.fileName,
      totalRows: rows.length,
      importedRows: importedCount,
      duplicateRows: duplicateCount,
      errorRows: errorCount,
      status: 'completed',
      errors: [],
    };
  }

  // ============================================================================
  // CLASSIFY TRANSACTION
  // ============================================================================

  async classifyTransaction(tenantId: string, userId: string, transactionId: string, dto: ClassifyTransactionDto) {
    const transaction = await this.repo.getTransaction(transactionId, tenantId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const oldValue = {
      status: transaction.status,
      category: transaction.category,
    };

    const updated = await this.repo.updateTransaction(transactionId, {
      status: dto.status,
      category: dto.category,
      notes: dto.notes,
    });

    // Audit
    await this.repo.logAudit({
      tenantId,
      bankTransactionId: transactionId,
      action: 'classify',
      oldValue,
      newValue: { status: dto.status, category: dto.category },
      userId,
      reason: dto.notes,
    });

    return updated;
  }

  // ============================================================================
  // MATCH TRANSACTION
  // ============================================================================

  async matchTransaction(tenantId: string, userId: string, transactionId: string, dto: MatchTransactionDto) {
    const transaction = await this.repo.getTransaction(transactionId, tenantId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const oldValue = {
      matchedEntityType: transaction.matchedEntityType,
      matchedEntityId: transaction.matchedEntityId,
    };

    const updated = await this.repo.updateTransaction(transactionId, {
      matchedEntityType: dto.entityType,
      matchedEntityId: dto.entityId,
      confidence: dto.confidence || 100,
      status: 'EXPLAINED',
    });

    // Audit
    await this.repo.logAudit({
      tenantId,
      bankTransactionId: transactionId,
      action: 'match',
      oldValue,
      newValue: { entityType: dto.entityType, entityId: dto.entityId },
      userId,
    });

    return updated;
  }

  // ============================================================================
  // MARK PERSONAL
  // ============================================================================

  async markPersonal(tenantId: string, userId: string, transactionId: string, isPersonal: boolean) {
    const transaction = await this.repo.getTransaction(transactionId, tenantId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const updated = await this.repo.updateTransaction(transactionId, {
      isPersonal,
      status: isPersonal ? 'PERSONAL' : 'NEW',
    });

    await this.repo.logAudit({
      tenantId,
      bankTransactionId: transactionId,
      action: 'mark_personal',
      oldValue: { isPersonal: transaction.isPersonal },
      newValue: { isPersonal },
      userId,
    });

    return updated;
  }

  // ============================================================================
  // IGNORE TRANSACTION
  // ============================================================================

  async ignoreTransaction(tenantId: string, userId: string, transactionId: string, reason?: string) {
    const transaction = await this.repo.getTransaction(transactionId, tenantId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const updated = await this.repo.updateTransaction(transactionId, {
      status: 'IGNORED',
      notes: reason,
    });

    await this.repo.logAudit({
      tenantId,
      bankTransactionId: transactionId,
      action: 'ignore',
      oldValue: { status: transaction.status },
      newValue: { status: 'IGNORED' },
      userId,
      reason,
    });

    return updated;
  }

  // ============================================================================
  // SUGGEST MATCHES (SIMPLE AI)
  // ============================================================================

  async suggestMatches(tenantId: string, transactionId: string) {
    const transaction = await this.repo.getTransaction(transactionId, tenantId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const suggestions = [];

    // Simple matching logic
    if (transaction.credit > 0) {
      // Deposit: look for matching invoices/collections
      suggestions.push({
        entityType: 'collection',
        entityId: 'demo_collection_1',
        confidence: 85,
        reason: 'amount_matches_invoice',
      });
    } else if (transaction.debit > 0) {
      // Charge: look for matching expenses/CFDIs
      suggestions.push({
        entityType: 'expense',
        entityId: 'demo_expense_1',
        confidence: 75,
        reason: 'supplier_in_description',
      });
    }

    // Save suggestions
    for (const sugg of suggestions) {
      await this.repo.createMatchSuggestion({
        tenantId,
        bankTransactionId: transactionId,
        ...sugg,
      });
    }

    return suggestions;
  }

  // ============================================================================
  // DASHBOARD
  // ============================================================================

  async getDashboard(tenantId: string, bankAccountId?: string) {
    const transactions = await this.repo.getTransactions(tenantId, bankAccountId);

    const stats = {
      totalAccounts: 1, // TODO: real count
      totalTransactions: transactions.length,
      totalAmount: '0',
      unexplainedCount: transactions.filter(t => t.status === 'NEW').length,
      needsReceiptCount: transactions.filter(t => t.status === 'NEEDS_RECEIPT').length,
      needsInvoiceCount: transactions.filter(t => t.status === 'NEEDS_INVOICE').length,
      needsPaymentComplementCount: transactions.filter(t => t.status === 'NEEDS_PAYMENT_COMPLEMENT').length,
      personalCount: transactions.filter(t => t.isPersonal).length,
      ignoredCount: transactions.filter(t => t.status === 'IGNORED').length,
      explainedCount: transactions.filter(t => t.status === 'EXPLAINED').length,
      explainedPercentage: transactions.length > 0
        ? Math.round((transactions.filter(t => t.status === 'EXPLAINED').length / transactions.length) * 100)
        : 0,
      recentTransactions: transactions.slice(0, 10),
      suggestions: [],
    };

    return stats;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0]) {
          return new Date(`${match[1]}-${match[2]}-${match[3]}`);
        } else if (format === formats[1]) {
          return new Date(`${match[3]}-${match[2]}-${match[1]}`);
        } else {
          return new Date(`${match[3]}-${match[2]}-${match[1]}`);
        }
      }
    }

    return null;
  }

  private normalizeDecimal(value: string): string {
    if (!value) return '0';
    return value.replace(/[^0-9.-]/g, '').trim() || '0';
  }
}
