import type { Product, ProductionBatch, Sale, Expense } from '../types';
import productsJson from '../../data/products.json';
import batchesJson from '../../data/batches.json';
import salesJson from '../../data/sales.json';
import expensesJson from '../../data/expenses.json';

// ============================
// Dữ liệu mẫu mặc định (Seed Data)
// ============================

export const defaultProducts: Product[] = productsJson as Product[];
export const defaultBatches: ProductionBatch[] = batchesJson as ProductionBatch[];
export const defaultSales: Sale[] = salesJson as Sale[];
export const defaultExpenses: Expense[] = expensesJson as Expense[];

