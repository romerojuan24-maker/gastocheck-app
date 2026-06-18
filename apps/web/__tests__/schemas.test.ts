import { loginSchema, cobraClientSchema, bankTransactionSchema } from '../lib/schemas';

describe('Validation Schemas', () => {
  it('loginSchema validates correct email', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('loginSchema rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'invalid', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('cobraClientSchema validates correct data', () => {
    const result = cobraClientSchema.safeParse({ name: 'ABC Corp', rfc: 'ABC123456789' });
    expect(result.success).toBe(true);
  });

  it('bankTransactionSchema validates transactions', () => {
    const result = bankTransactionSchema.safeParse({
      description: 'Test',
      amount: 1000,
      transaction_date: '2024-01-01',
      category: 'gasto',
    });
    expect(result.success).toBe(true);
  });
});
