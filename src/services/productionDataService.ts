/**
 * Production Data Service — Dữ liệu sản xuất mà Nhanh.vn không cung cấp
 * 
 * Quản lý:
 * - KPI sản xuất (tỷ lệ hoàn thành, lead time, năng suất)
 * - Export/Import dữ liệu toàn bộ hệ thống
 * - Báo cáo sản xuất
 */

import type { Product, ProductionBatch, Sale, Expense, ActualRevenue } from '../types';

// ============================
// KPI & Metrics
// ============================

export interface ProductionMetrics {
  totalBatches: number;
  activeBatches: number;
  completedBatches: number;
  completionRate: number; // %
  avgLeadTimeDays: number;
  totalUnitsProduced: number;
  totalUnitsInProgress: number;
}

/**
 * Tính KPI sản xuất xưởng
 */
export const getProductionMetrics = (batches: ProductionBatch[]): ProductionMetrics => {
  const active = batches.filter((b) => b.status === 'running');
  const completed = batches.filter((b) => b.status === 'completed');

  // Tính lead time trung bình (từ createdAt đến targetDate cho lô hoàn thành)
  let totalLeadDays = 0;
  completed.forEach((b) => {
    const start = new Date(b.createdAt).getTime();
    const end = new Date(b.targetDate).getTime();
    totalLeadDays += Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
  });

  return {
    totalBatches: batches.length,
    activeBatches: active.length,
    completedBatches: completed.length,
    completionRate: batches.length > 0 ? (completed.length / batches.length) * 100 : 0,
    avgLeadTimeDays: completed.length > 0 ? Math.round(totalLeadDays / completed.length) : 0,
    totalUnitsProduced: completed.reduce((sum, b) => sum + b.items.reduce((s, i) => s + i.quantity, 0), 0),
    totalUnitsInProgress: active.reduce((sum, b) => sum + b.items.reduce((s, i) => s + i.quantity, 0), 0),
  };
};

// ============================
// Export & Import
// ============================

export interface ExportData {
  version: string;
  exportedAt: string;
  products: Product[];
  productionBatches: ProductionBatch[];
  sales: Sale[];
  expenses: Expense[];
  actualRevenues?: ActualRevenue[];
}

/**
 * Xuất toàn bộ dữ liệu hệ thống dạng JSON
 */
export const exportAllData = (
  products: Product[],
  batches: ProductionBatch[],
  sales: Sale[],
  expenses: Expense[],
  actualRevenues: ActualRevenue[] = []
): string => {
  const exportData: ExportData = {
    version: '1.1',
    exportedAt: new Date().toISOString(),
    products,
    productionBatches: batches,
    sales,
    expenses,
    actualRevenues,
  };
  return JSON.stringify(exportData, null, 2);
};

/**
 * Import dữ liệu từ file JSON
 * Trả về dữ liệu đã validate hoặc lỗi
 */
export const parseImportData = (json: string): {
  success: boolean;
  data?: ExportData;
  error?: string;
} => {
  try {
    const parsed = JSON.parse(json);

    // Validate cấu trúc cơ bản
    if (!parsed.version) {
      return { success: false, error: 'File JSON không hợp lệ: thiếu trường version.' };
    }
    if (!Array.isArray(parsed.products)) {
      return { success: false, error: 'File JSON không hợp lệ: thiếu hoặc sai định dạng trường products.' };
    }
    if (!Array.isArray(parsed.productionBatches)) {
      return { success: false, error: 'File JSON không hợp lệ: thiếu hoặc sai định dạng trường productionBatches.' };
    }
    if (!Array.isArray(parsed.sales)) {
      return { success: false, error: 'File JSON không hợp lệ: thiếu hoặc sai định dạng trường sales.' };
    }
    if (!Array.isArray(parsed.expenses)) {
      return { success: false, error: 'File JSON không hợp lệ: thiếu hoặc sai định dạng trường expenses.' };
    }

    return { success: true, data: parsed as ExportData };
  } catch (e) {
    return { success: false, error: `Lỗi parse JSON: ${(e as Error).message}` };
  }
};

/**
 * Tính lịch sử tiến độ sản xuất theo SKU
 */
export const getProductionTimeline = (sku: string, batches: ProductionBatch[]) => {
  return batches
    .filter((b) => b.productSku === sku)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((b) => ({
      batchId: b.id,
      quantity: b.quantity,
      stage: b.currentStage,
      status: b.status,
      createdAt: b.createdAt,
      targetDate: b.targetDate,
    }));
};
