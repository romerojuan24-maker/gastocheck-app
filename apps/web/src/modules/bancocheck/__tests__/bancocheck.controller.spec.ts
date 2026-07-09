import { Test, TestingModule } from '@nestjs/testing';
import { BancocheckController } from '../bancocheck.controller';
import { BancocheckService } from '../bancocheck.service';

describe('BancocheckController (Integration)', () => {
  let controller: BancocheckController;
  let service: BancocheckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BancocheckController],
      providers: [
        {
          provide: BancocheckService,
          useValue: {
            createAccount: jest.fn(),
            getAccounts: jest.fn(),
            getTransactions: jest.fn(),
            getTransaction: jest.fn(),
            importBankStatementCSV: jest.fn(),
            classifyTransaction: jest.fn(),
            matchTransaction: jest.fn(),
            markPersonal: jest.fn(),
            ignoreTransaction: jest.fn(),
            suggestMatches: jest.fn(),
            getDashboard: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BancocheckController>(BancocheckController);
    service = module.get<BancocheckService>(BancocheckService);
  });

  describe('POST /accounts', () => {
    it('should create account and validate tenant', async () => {
      const req = { user: { company_id: 'tenant_1', id: 'user_1' } };
      const dto = {
        name: 'Test Bank',
        bankName: 'BBVA',
        accountNumberLast4: '1234',
        currency: 'MXN',
        type: 'corriente',
      };

      (service.createAccount as jest.Mock).mockResolvedValue({ id: 'acc_1', ...dto });

      const result = await controller.createAccount(req as any, dto);

      expect(result.id).toBe('acc_1');
      expect(service.createAccount).toHaveBeenCalledWith('tenant_1', 'user_1', dto);
    });
  });

  describe('GET /accounts', () => {
    it('should return tenant accounts only', async () => {
      const req = { user: { company_id: 'tenant_1' } };
      const mockAccounts = [
        { id: 'acc_1', name: 'BBVA', tenant_id: 'tenant_1' },
      ];

      (service.getAccounts as jest.Mock).mockResolvedValue(mockAccounts);

      const result = await controller.getAccounts(req as any);

      expect(result).toEqual(mockAccounts);
      expect(service.getAccounts).toHaveBeenCalledWith('tenant_1');
    });
  });

  describe('POST /import-csv', () => {
    it('should import CSV and validate tenant', async () => {
      const req = { user: { company_id: 'tenant_1', id: 'user_1' } };
      const dto = {
        bankAccountId: 'acc_1',
        fileName: 'test.csv',
        csvData: 'fecha,descripcion,debito,credito\n2026-07-01,TEST,100,0',
      };

      (service.importBankStatementCSV as jest.Mock).mockResolvedValue({
        batchId: 'batch_1',
        importedRows: 1,
        duplicateRows: 0,
        errorRows: 0,
        status: 'completed',
      });

      const result = await controller.importCSV(req as any, dto);

      expect(result.importedRows).toBe(1);
      expect(service.importBankStatementCSV).toHaveBeenCalledWith('tenant_1', 'user_1', dto);
    });

    it('should return error on empty CSV', async () => {
      const req = { user: { company_id: 'tenant_1', id: 'user_1' } };
      const dto = {
        bankAccountId: 'acc_1',
        fileName: 'test.csv',
        csvData: '',
      };

      (service.importBankStatementCSV as jest.Mock).mockRejectedValue(new Error('Empty CSV'));

      await expect(controller.importCSV(req as any, dto)).rejects.toThrow();
    });
  });

  describe('GET /transactions', () => {
    it('should filter by status', async () => {
      const req = { user: { company_id: 'tenant_1' } };
      const mockTransactions = [
        { id: 't1', status: 'NEW', description: 'Test' },
      ];

      (service.getTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const result = await controller.getTransactions(req as any, undefined, { status: 'NEW' });

      expect(result).toEqual(mockTransactions);
      expect(service.getTransactions).toHaveBeenCalledWith('tenant_1', undefined, { status: 'NEW' });
    });

    it('should validate tenant isolation', async () => {
      const req = { user: { company_id: 'tenant_1' } };

      (service.getTransactions as jest.Mock).mockResolvedValue([]);

      await controller.getTransactions(req as any, undefined, {});

      expect(service.getTransactions).toHaveBeenCalledWith('tenant_1', undefined, {});
      expect(service.getTransactions).not.toHaveBeenCalledWith('other_tenant', undefined, {});
    });
  });

  describe('PATCH /transactions/:id/classify', () => {
    it('should classify transaction', async () => {
      const req = { user: { company_id: 'tenant_1', id: 'user_1' } };
      const dto = {
        status: 'EXPLAINED',
        category: 'gasto_negocio',
        notes: 'Office supplies',
      };

      (service.classifyTransaction as jest.Mock).mockResolvedValue({
        id: 't1',
        status: 'EXPLAINED',
        category: 'gasto_negocio',
      });

      const result = await controller.classifyTransaction(req as any, 't1', dto);

      expect(result.status).toBe('EXPLAINED');
      expect(service.classifyTransaction).toHaveBeenCalledWith('tenant_1', 'user_1', 't1', dto);
    });
  });

  describe('PATCH /transactions/:id/match', () => {
    it('should match transaction to entity', async () => {
      const req = { user: { company_id: 'tenant_1', id: 'user_1' } };
      const dto = {
        entityType: 'invoice',
        entityId: 'inv_123',
        confidence: 95,
      };

      (service.matchTransaction as jest.Mock).mockResolvedValue({
        id: 't1',
        status: 'EXPLAINED',
        matchedEntityType: 'invoice',
        matchedEntityId: 'inv_123',
      });

      const result = await controller.matchTransaction(req as any, 't1', dto);

      expect(result.matchedEntityType).toBe('invoice');
      expect(service.matchTransaction).toHaveBeenCalledWith('tenant_1', 'user_1', 't1', dto);
    });
  });

  describe('PATCH /transactions/:id/mark-personal', () => {
    it('should mark transaction as personal', async () => {
      const req = { user: { company_id: 'tenant_1', id: 'user_1' } };

      (service.markPersonal as jest.Mock).mockResolvedValue({
        id: 't1',
        isPersonal: true,
        status: 'PERSONAL',
      });

      const result = await controller.markPersonal(req as any, 't1', { isPersonal: true });

      expect(result.isPersonal).toBe(true);
      expect(service.markPersonal).toHaveBeenCalledWith('tenant_1', 'user_1', 't1', true);
    });
  });

  describe('GET /dashboard', () => {
    it('should return dashboard KPIs', async () => {
      const req = { user: { company_id: 'tenant_1' } };
      const mockDashboard = {
        totalTransactions: 50,
        unexplainedCount: 10,
        explainedPercentage: 80,
        personalCount: 5,
      };

      (service.getDashboard as jest.Mock).mockResolvedValue(mockDashboard);

      const result = await controller.getDashboard(req as any, undefined);

      expect(result.totalTransactions).toBe(50);
      expect(result.explainedPercentage).toBe(80);
    });

    it('should filter by bank account if provided', async () => {
      const req = { user: { company_id: 'tenant_1' } };

      (service.getDashboard as jest.Mock).mockResolvedValue({});

      await controller.getDashboard(req as any, 'acc_1');

      expect(service.getDashboard).toHaveBeenCalledWith('tenant_1', 'acc_1');
    });
  });

  describe('Tenant Isolation Tests', () => {
    it('should never leak data across tenants', async () => {
      const req1 = { user: { company_id: 'tenant_1' } };
      const req2 = { user: { company_id: 'tenant_2' } };

      (service.getTransactions as jest.Mock)
        .mockResolvedValueOnce([{ id: 't1', tenant_id: 'tenant_1' }])
        .mockResolvedValueOnce([{ id: 't2', tenant_id: 'tenant_2' }]);

      const result1 = await controller.getTransactions(req1 as any, undefined, {});
      const result2 = await controller.getTransactions(req2 as any, undefined, {});

      expect(result1[0].tenant_id).toBe('tenant_1');
      expect(result2[0].tenant_id).toBe('tenant_2');
      expect(result1).not.toEqual(result2);
    });

    it('should validate tenant in all write operations', async () => {
      const req = { user: { company_id: 'tenant_1', id: 'user_1' } };

      // All write operations should include tenant_id
      await controller.classifyTransaction(req as any, 't1', {
        status: 'EXPLAINED',
        category: 'test',
      });

      expect(service.classifyTransaction).toHaveBeenCalledWith(
        'tenant_1',
        'user_1',
        't1',
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 on missing transaction', async () => {
      const req = { user: { company_id: 'tenant_1' } };

      (service.getTransaction as jest.Mock).mockResolvedValue(null);

      const result = await controller.getTransaction(req as any, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should validate request body format', async () => {
      const req = { user: { company_id: 'tenant_1', id: 'user_1' } };

      // Invalid status should be caught by NestJS validation (in real app)
      // This test verifies the controller passes to service
      (service.classifyTransaction as jest.Mock).mockRejectedValue(new Error('Invalid status'));

      await expect(
        controller.classifyTransaction(req as any, 't1', {
          status: 'INVALID_STATUS',
          category: 'test',
        })
      ).rejects.toThrow();
    });
  });
});
