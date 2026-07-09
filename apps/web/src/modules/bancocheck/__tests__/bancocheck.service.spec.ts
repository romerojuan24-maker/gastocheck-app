import { Test, TestingModule } from '@nestjs/testing';
import { BancocheckService } from '../bancocheck.service';
import { BancocheckRepository } from '../bancocheck.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('BancocheckService', () => {
  let service: BancocheckService;
  let repo: BancocheckRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BancocheckService,
        {
          provide: BancocheckRepository,
          useValue: {
            createAccount: jest.fn(),
            getAccounts: jest.fn(),
            getTransaction: jest.fn(),
            createImportBatch: jest.fn(),
            updateImportBatch: jest.fn(),
            createTransactions: jest.fn(),
            logAudit: jest.fn(),
            checkDuplicate: jest.fn(),
            generateUniqueHash: jest.fn(),
            updateTransaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BancocheckService>(BancocheckService);
    repo = module.get<BancocheckRepository>(BancocheckRepository);
  });

  describe('createAccount', () => {
    it('should create a bank account', async () => {
      const dto = {
        name: 'BBVA Nóminas',
        bankName: 'BBVA',
        accountNumberLast4: '1234',
        currency: 'MXN',
      };

      (repo.createAccount as jest.Mock).mockResolvedValue({
        id: 'acc_1',
        ...dto,
      });

      const result = await service.createAccount('tenant_1', 'user_1', dto);
      expect(result.id).toBe('acc_1');
      expect(repo.createAccount).toHaveBeenCalled();
    });

    it('should throw if missing required fields', async () => {
      const dto = { name: 'BBVA' };
      await expect(service.createAccount('tenant_1', 'user_1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('importBankStatementCSV', () => {
    it('should parse and import CSV rows', async () => {
      const dto = {
        bankAccountId: 'acc_1',
        fileName: 'test.csv',
        csvData: `fecha,descripcion,debito,credito
2026-07-01,PAGO ACME,1500.00,0
2026-07-02,INGRESO CLIENTE,0,5000.00`,
      };

      (repo.createImportBatch as jest.Mock).mockResolvedValue({ id: 'batch_1' });
      (repo.checkDuplicate as jest.Mock).mockResolvedValue(false);
      (repo.createTransactions as jest.Mock).mockResolvedValue([]);
      (repo.updateImportBatch as jest.Mock).mockResolvedValue({});
      (repo.logAudit as jest.Mock).mockResolvedValue({});

      const result = await service.importBankStatementCSV('tenant_1', 'user_1', dto);
      expect(result.importedRows).toBe(2);
    });

    it('should detect duplicates', async () => {
      const dto = {
        bankAccountId: 'acc_1',
        fileName: 'test.csv',
        csvData: `fecha,descripcion,debito,credito
2026-07-01,PAGO ACME,1500.00,0`,
      };

      (repo.createImportBatch as jest.Mock).mockResolvedValue({ id: 'batch_1' });
      (repo.checkDuplicate as jest.Mock).mockResolvedValue(true);
      (repo.updateImportBatch as jest.Mock).mockResolvedValue({});
      (repo.logAudit as jest.Mock).mockResolvedValue({});

      const result = await service.importBankStatementCSV('tenant_1', 'user_1', dto);
      expect(result.duplicateRows).toBe(1);
      expect(result.importedRows).toBe(0);
    });
  });

  describe('classifyTransaction', () => {
    it('should classify a transaction', async () => {
      const oldTrans = { id: 'trans_1', status: 'NEW', category: null };
      (repo.getTransaction as jest.Mock).mockResolvedValue(oldTrans);
      (repo.updateTransaction as jest.Mock).mockResolvedValue({
        id: 'trans_1',
        status: 'EXPLAINED',
        category: 'gasto_negocio',
      });
      (repo.logAudit as jest.Mock).mockResolvedValue({});

      const result = await service.classifyTransaction('tenant_1', 'user_1', 'trans_1', {
        status: 'EXPLAINED',
        category: 'gasto_negocio',
        notes: 'Gastos de oficina',
      });

      expect(result.status).toBe('EXPLAINED');
    });

    it('should throw if transaction not found', async () => {
      (repo.getTransaction as jest.Mock).mockResolvedValue(null);
      await expect(
        service.classifyTransaction('tenant_1', 'user_1', 'nonexistent', {
          status: 'EXPLAINED',
          category: 'gasto',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('matchTransaction', () => {
    it('should match transaction to entity', async () => {
      const oldTrans = { id: 'trans_1', matchedEntityType: null, matchedEntityId: null };
      (repo.getTransaction as jest.Mock).mockResolvedValue(oldTrans);
      (repo.updateTransaction as jest.Mock).mockResolvedValue({
        id: 'trans_1',
        status: 'EXPLAINED',
        matchedEntityType: 'invoice',
        matchedEntityId: 'inv_123',
      });
      (repo.logAudit as jest.Mock).mockResolvedValue({});

      const result = await service.matchTransaction('tenant_1', 'user_1', 'trans_1', {
        entityType: 'invoice',
        entityId: 'inv_123',
        confidence: 95,
      });

      expect(result.matchedEntityType).toBe('invoice');
    });
  });

  describe('getDashboard', () => {
    it('should aggregate transaction stats', async () => {
      const mockTransactions = [
        { id: 't1', status: 'EXPLAINED', isPersonal: false },
        { id: 't2', status: 'NEW', isPersonal: false },
        { id: 't3', status: 'PERSONAL', isPersonal: true },
      ];

      (repo.getTransactions as jest.Mock).mockResolvedValue(mockTransactions);

      const result = await service.getDashboard('tenant_1');
      expect(result.totalTransactions).toBe(3);
      expect(result.unexplainedCount).toBe(1);
      expect(result.explainedPercentage).toBe(33);
    });
  });
});
