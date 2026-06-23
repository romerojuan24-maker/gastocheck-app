import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(12, 'Mínimo 12 caracteres')
    .regex(/[A-Z]/, 'Debe contener mayúsculas')
    .regex(/[0-9]/, 'Debe contener números')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Debe contener caracteres especiales'),
});

export const cobraClientSchema = z.object({
  name: z.string().min(3, 'Nombre requerido'),
  rfc: z.string().min(12, 'RFC inválido'),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
});

export const bankTransactionSchema = z.object({
  description: z.string().min(3, 'Descripción requerida'),
  amount: z.number().gt(0, 'Monto debe ser mayor a 0'),
  transaction_date: z.string().refine((v: string) => !isNaN(Date.parse(v)), 'Fecha inválida'),
  category: z.enum(['gasto', 'cobranza', 'anticipo', 'proveedor', 'cliente', 'transferencia', 'personal', 'ignorar']),
});

export const inventoryProductSchema = z.object({
  name: z.string().min(3, 'Nombre requerido'),
  sku: z.string().optional(),
  cost: z.number().gt(0, 'Costo debe ser > 0'),
  price: z.number().gt(0, 'Precio debe ser > 0'),
  stock_minimum: z.number().gte(0, 'Stock mínimo >= 0'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CobraClientInput = z.infer<typeof cobraClientSchema>;
export type BankTransactionInput = z.infer<typeof bankTransactionSchema>;
export type InventoryProductInput = z.infer<typeof inventoryProductSchema>;
