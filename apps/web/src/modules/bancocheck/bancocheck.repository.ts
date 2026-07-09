import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';

@Injectable()
export class BancocheckRepository {
  constructor(private prisma: PrismaService) {}

  // ============================================================================
  // BANK ACCOUNTS
  // ============================================================================

  async createAccount(data: {
    tenantId: string;
    name: string;
    bankName: string;
    accountNumberLast4: string;
    currency: string;
    type: string;
    importedBalance: string;
    createdById: string;
  }) {
    return this.prisma.bankAccount.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: data.tenantId,
        name: data.name,
        bankName: data.bankName,
        accountNumberLast4: data.accountNumberLast4,
        currency: data.currency,
        type: data.type,
        importedBalance: new Decimal(data.importedBalance),
        createdById: data.createdById,
      },
    });
  }

  async getAccounts(tenantId: string) {
    return this.prisma.bankAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAccount(id: string, tenantId: string) {
    return this.prisma.bankAccount.findUnique({
      where: { id },
      rejectOnNotFound: () => new Error('Account not found'),
    });
  }

  // ============================================================================
  // IMPORT BATCHES
  // ============================================================================

  async createImportBatch(data: {
    tenantId: string;
    bankAccountId: string;
    fileName: string;
    fileHash: string;
    totalRows: number;
    createdById: string;
  }) {
    return this.prisma.bankImportBatch.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: data.tenantId,
        bankAccountId: data.bankAccountId,
        fileName: data.fileName,
        fileHash: data.fileHash,
        totalRows: data.totalRows,
        importedRows: 0,
        duplicateRows: 0,
        errorRows: 0,
        status: 'pending',
        createdById: data.createdById,
      },
    });
  }

  async updateImportBatch(id: string, data: {
    status: string;
    importedRows: number;
    duplicateRows: number;
    errorRows: number;
    errorMessage?: string;
  }) {
    return this.prisma.bankImportBatch.update({
      where: { id },
      data,
    });
  }

  async getImportBatch(id: string, tenantId: string) {
    return this.prisma.bankImportBatch.findUnique({
      where: { id },
    });
  }

  // ============================================================================
  // BANK TRANSACTIONS
  // ============================================================================

  async createTransactions(transactions: Array<{
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
    rawData?: any;
  }>) {
    return this.prisma.bankTransaction.createMany({
      data: transactions.map(t => ({
        id: crypto.randomUUID(),
        tenantId: t.tenantId,
        bankAccountId: t.bankAccountId,
        date: t.date,
        description: t.description,
        reference: t.reference,
        debit: new Decimal(t.debit),
        credit: new Decimal(t.credit),
        balanceAfter: new Decimal(t.balanceAfter),
        currency: t.currency,
        importBatchId: t.importBatchId,
        uniqueHash: t.uniqueHash,
        status: 'NEW',
        rawData: t.rawData,
      })),
      skipDuplicates: true,
    });
  }

  async getTransactions(tenantId: string, bankAccountId?: string, filters?: {
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    minAmount?: string;
    maxAmount?: string;
  }) {
    const where: any = { tenantId };
    if (bankAccountId) where.bankAccountId = bankAccountId;
    if (filters?.status) where.status = filters.status;
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = filters.dateFrom;
      if (filters.dateTo) where.date.lte = filters.dateTo;
    }

    return this.prisma.bankTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 1000,
    });
  }

  async getTransaction(id: string, tenantId: string) {
    return this.prisma.bankTransaction.findUnique({
      where: { id },
    });
  }

  async updateTransaction(id: string, data: {
    status?: string;
    category?: string;
    matchedEntityType?: string;
    matchedEntityId?: string;
    confidence?: number;
    isPersonal?: boolean;
    notes?: string;
  }) {
    return this.prisma.bankTransaction.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async getUnexplainedCount(tenantId: string, bankAccountId?: string) {
    const where: any = {
      tenantId,
      status: { in: ['NEW', 'SUGGESTED_MATCH'] },
    };
    if (bankAccountId) where.bankAccountId = bankAccountId;

    return this.prisma.bankTransaction.count({ where });
  }

  async getTransactionsByStatus(tenantId: string, status: string) {
    return this.prisma.bankTransaction.findMany({
      where: { tenantId, status },
    });
  }

  // ============================================================================
  // MATCH SUGGESTIONS
  // ============================================================================

  async createMatchSuggestion(data: {
    tenantId: string;
    bankTransactionId: string;
    entityType: string;
    entityId: string;
    confidence: number;
    reason: string;
  }) {
    return this.prisma.bankMatchSuggestion.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: data.tenantId,
        bankTransactionId: data.bankTransactionId,
        entityType: data.entityType,
        entityId: data.entityId,
        confidence: data.confidence,
        reason: data.reason,
      },
    });
  }

  async getSuggestionsForTransaction(bankTransactionId: string) {
    return this.prisma.bankMatchSuggestion.findMany({
      where: { bankTransactionId, dismissed: false },
      orderBy: { confidence: 'desc' },
    });
  }

  async updateSuggestion(id: string, data: { accepted?: boolean; dismissed?: boolean }) {
    return this.prisma.bankMatchSuggestion.update({
      where: { id },
      data,
    });
  }

  // ============================================================================
  // AUDIT LOG
  // ============================================================================

  async logAudit(data: {
    tenantId: string;
    bankTransactionId?: string;
    action: string;
    oldValue?: any;
    newValue?: any;
    userId: string;
    reason?: string;
  }) {
    return this.prisma.bankAuditLog.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: data.tenantId,
        bankTransactionId: data.bankTransactionId,
        action: data.action,
        oldValue: data.oldValue,
        newValue: data.newValue,
        userId: data.userId,
        reason: data.reason,
      },
    });
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  generateUniqueHash(tenantId: string, bankAccountId: string, date: Date, desc: string, debit: string, credit: string, ref?: string): string {
    const key = `${tenantId}|${bankAccountId}|${date.toISOString()}|${desc.toLowerCase().trim()}|${debit}|${credit}|${ref || ''}`;
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async checkDuplicate(tenantId: string, importBatchId: string, uniqueHash: string): Promise<boolean> {
    const existing = await this.prisma.bankTransaction.findUnique({
      where: { tenantId_importBatchId_uniqueHash: { tenantId, importBatchId, uniqueHash } },
    });
    return !!existing;
  }
}
