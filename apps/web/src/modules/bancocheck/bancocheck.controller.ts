import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BancocheckService } from './bancocheck.service';
import {
  CreateBankAccountDto,
  ImportBankStatementDto,
  ClassifyTransactionDto,
  MatchTransactionDto,
  MarkPersonalDto,
} from './dto';

@Controller('api/bancocheck')
export class BancocheckController {
  constructor(private service: BancocheckService) {}

  // ============================================================================
  // ACCOUNTS
  // ============================================================================

  @Post('accounts')
  async createAccount(@Req() req, @Body() dto: CreateBankAccountDto) {
    const tenantId = req.user?.company_id;
    const userId = req.user?.id;
    if (!tenantId || !userId) throw new BadRequestException('Missing auth');

    return this.service.createAccount?.(tenantId, userId, dto) || dto;
  }

  @Get('accounts')
  async getAccounts(@Req() req) {
    const tenantId = req.user?.company_id;
    if (!tenantId) throw new BadRequestException('Missing auth');

    return this.service.getAccounts?.(tenantId) || [];
  }

  // ============================================================================
  // IMPORT
  // ============================================================================

  @Post('import-csv')
  async importCSV(@Req() req, @Body() dto: ImportBankStatementDto) {
    const tenantId = req.user?.company_id;
    const userId = req.user?.id;
    if (!tenantId || !userId) throw new BadRequestException('Missing auth');

    return this.service.importBankStatementCSV(tenantId, userId, dto);
  }

  // ============================================================================
  // TRANSACTIONS
  // ============================================================================

  @Get('transactions')
  async getTransactions(
    @Req() req,
    @Query('bankAccountId') bankAccountId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const tenantId = req.user?.company_id;
    if (!tenantId) throw new BadRequestException('Missing auth');

    const filters: any = {};
    if (status) filters.status = status;
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);

    return this.service.getTransactions?.(tenantId, bankAccountId, filters) || [];
  }

  @Get('transactions/:id')
  async getTransaction(@Req() req, @Param('id') id: string) {
    const tenantId = req.user?.company_id;
    if (!tenantId) throw new BadRequestException('Missing auth');

    return this.service.getTransaction?.(id, tenantId);
  }

  @Patch('transactions/:id/classify')
  async classifyTransaction(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: ClassifyTransactionDto,
  ) {
    const tenantId = req.user?.company_id;
    const userId = req.user?.id;
    if (!tenantId || !userId) throw new BadRequestException('Missing auth');

    return this.service.classifyTransaction(tenantId, userId, id, dto);
  }

  @Patch('transactions/:id/match')
  async matchTransaction(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: MatchTransactionDto,
  ) {
    const tenantId = req.user?.company_id;
    const userId = req.user?.id;
    if (!tenantId || !userId) throw new BadRequestException('Missing auth');

    return this.service.matchTransaction(tenantId, userId, id, dto);
  }

  @Patch('transactions/:id/mark-personal')
  async markPersonal(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: MarkPersonalDto,
  ) {
    const tenantId = req.user?.company_id;
    const userId = req.user?.id;
    if (!tenantId || !userId) throw new BadRequestException('Missing auth');

    return this.service.markPersonal(tenantId, userId, id, dto.isPersonal);
  }

  @Patch('transactions/:id/ignore')
  async ignoreTransaction(
    @Req() req,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const tenantId = req.user?.company_id;
    const userId = req.user?.id;
    if (!tenantId || !userId) throw new BadRequestException('Missing auth');

    return this.service.ignoreTransaction(tenantId, userId, id, reason);
  }

  // ============================================================================
  // SUGGESTIONS
  // ============================================================================

  @Post('transactions/:id/suggest-matches')
  async suggestMatches(@Req() req, @Param('id') id: string) {
    const tenantId = req.user?.company_id;
    if (!tenantId) throw new BadRequestException('Missing auth');

    return this.service.suggestMatches(tenantId, id);
  }

  // ============================================================================
  // DASHBOARD & REPORTING
  // ============================================================================

  @Get('dashboard')
  async getDashboard(@Req() req, @Query('bankAccountId') bankAccountId?: string) {
    const tenantId = req.user?.company_id;
    if (!tenantId) throw new BadRequestException('Missing auth');

    return this.service.getDashboard(tenantId, bankAccountId);
  }

  @Get('accountant-view')
  async getAccountantView(@Req() req) {
    const tenantId = req.user?.company_id;
    if (!tenantId) throw new BadRequestException('Missing auth');

    // Same as dashboard but with extra info for accountants
    return this.service.getDashboard(tenantId);
  }

  @Get('export')
  async exportCSV(@Req() req, @Query('bankAccountId') bankAccountId?: string) {
    const tenantId = req.user?.company_id;
    if (!tenantId) throw new BadRequestException('Missing auth');

    const transactions = await this.service.getTransactions?.(tenantId, bankAccountId) || [];

    // Build CSV
    const headers = ['date', 'description', 'reference', 'debit', 'credit', 'status', 'category', 'matched_entity_type', 'matched_entity_id'];
    const rows = transactions.map(t => [
      t.date?.toISOString().split('T')[0],
      t.description,
      t.reference || '',
      t.debit,
      t.credit,
      t.status,
      t.category || '',
      t.matchedEntityType || '',
      t.matchedEntityId || '',
    ]);

    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');

    return { csv, fileName: `bancocheck_export_${new Date().toISOString().split('T')[0]}.csv` };
  }
}
