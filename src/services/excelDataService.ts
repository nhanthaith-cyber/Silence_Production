/**
 * Excel Data Service — Đọc/ghi dữ liệu qua file Excel (.xlsx)
 *
 * Sử dụng thư viện SheetJS (xlsx) chạy hoàn toàn ở phía client.
 * File này TÁCH BIỆT với nhanhService.ts để dễ bảo trì độc lập.
 *
 * Xuất: 4 sheet — Products, Sales, Expenses, ProductionBatches
 * Import: Đọc từng sheet, validate, trả về ExcelImportResult
 * Template: File Excel mẫu trống có header + hướng dẫn
 */

import * as XLSX from 'xlsx';
import type { Product, ProductionBatch, Sale, Expense, ExcelImportResult } from '../types';

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

const toNum = (v: unknown): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const toStr = (v: unknown): string => (v == null ? '' : String(v).trim());

const TODAY = () => new Date().toISOString().slice(0, 10);

// ────────────────────────────────────────────────
// EXPORT
// ────────────────────────────────────────────────

/**
 * Xuất toàn bộ dữ liệu ra file Excel .xlsx với 4 sheet riêng biệt.
 * Tự động tải xuống trình duyệt.
 */
export const exportToExcel = (
  products: Product[],
  batches: ProductionBatch[],
  sales: Sale[],
  expenses: Expense[]
): void => {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Products ──
  const productRows = products.map((p) => ({
    SKU: p.sku,
    'Ten san pham': p.name,
    'Gia goc (VND)': p.defaultCost,
    'Gia ban (VND)': p.defaultPrice,
    'Ton kho Nhanh.vn': p.nhanhStock ?? 0,
  }));
  const wsProducts = XLSX.utils.json_to_sheet(productRows.length ? productRows : [
    { SKU: '', 'Ten san pham': '', 'Gia goc (VND)': 0, 'Gia ban (VND)': 0, 'Ton kho Nhanh.vn': 0 }
  ]);
  wsProducts['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

  // ── Sheet 2: Sales ──
  const saleRows = sales.map((s) => ({
    ID: s.id,
    SKU: s.productSku,
    'So luong': s.quantity,
    'Don gia (VND)': s.unitPrice,
    'Ngay ban': s.saleDate,
    'Nguon': s.source,
  }));
  const wsSales = XLSX.utils.json_to_sheet(saleRows.length ? saleRows : [
    { ID: '', SKU: '', 'So luong': 0, 'Don gia (VND)': 0, 'Ngay ban': TODAY(), 'Nguon': 'manual' }
  ]);
  wsSales['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSales, 'Sales');

  // ── Sheet 3: Expenses ──
  const expenseRows = expenses.map((e) => ({
    ID: e.id,
    'Danh muc': e.category,
    'So tien (VND)': e.amount,
    'Ngay': e.expenseDate,
    'Ghi chu': e.notes,
  }));
  const wsExpenses = XLSX.utils.json_to_sheet(expenseRows.length ? expenseRows : [
    { ID: '', 'Danh muc': 'other', 'So tien (VND)': 0, 'Ngay': TODAY(), 'Ghi chu': '' }
  ]);
  wsExpenses['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

  // ── Sheet 4: ProductionBatches ──
  const batchRows = batches.map((b) => ({
    ID: b.id,
    'Trang thai': b.status,
    'Giai doan': b.currentStage,
    'Ngay tao': b.createdAt.slice(0, 10),
    'Ngay muc tieu': b.targetDate,
    'San pham (SKU:SL,...)': b.items.map((i) => `${i.productSku}:${i.quantity}`).join(', '),
  }));
  const wsBatches = XLSX.utils.json_to_sheet(batchRows.length ? batchRows : [{
    ID: '', 'Trang thai': 'running', 'Giai doan': 'ordered',
    'Ngay tao': TODAY(), 'Ngay muc tieu': TODAY(), 'San pham (SKU:SL,...)': '',
  }]);
  wsBatches['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsBatches, 'ProductionBatches');

  // ── Sheet 5: HuongDan ──
  const guideRows = [
    { Sheet: 'Products', MoTa: 'SKU la khoa chinh, bat buoc, duy nhat.' },
    { Sheet: 'Sales', MoTa: 'Nguon: shopee | tiktok | offline | manual | nhanh_vn' },
    { Sheet: 'Expenses', MoTa: 'Danh muc: labor | rent | ads | shipping | material | other' },
    { Sheet: 'ProductionBatches', MoTa: 'San pham: "SKU1:100, SKU2:50" - phan tach bang dau phay' },
    { Sheet: 'Luu y', MoTa: 'Khi import, chon GHI DE (xoa data cu) hoac THEM MOI (giu data cu).' },
  ];
  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'HuongDan');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  XLSX.writeFile(wb, `SilenceProduction_${timestamp}.xlsx`);
};

// ────────────────────────────────────────────────
// TEMPLATE (file mau trong)
// ────────────────────────────────────────────────

export const generateExcelTemplate = (): void => {
  const wb = XLSX.utils.book_new();

  const wsP = XLSX.utils.json_to_sheet([
    { SKU: 'VD-001', 'Ten san pham': 'Vi du san pham A', 'Gia goc (VND)': 50000, 'Gia ban (VND)': 120000, 'Ton kho Nhanh.vn': 0 },
  ]);
  wsP['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsP, 'Products');

  const wsS = XLSX.utils.json_to_sheet([
    { ID: '', SKU: 'VD-001', 'So luong': 5, 'Don gia (VND)': 120000, 'Ngay ban': TODAY(), 'Nguon': 'manual' },
  ]);
  wsS['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsS, 'Sales');

  const wsE = XLSX.utils.json_to_sheet([
    { ID: '', 'Danh muc': 'labor', 'So tien (VND)': 5000000, 'Ngay': TODAY(), 'Ghi chu': 'Luong thang' },
  ]);
  wsE['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsE, 'Expenses');

  const wsB = XLSX.utils.json_to_sheet([
    { ID: '', 'Trang thai': 'running', 'Giai doan': 'ordered', 'Ngay tao': TODAY(), 'Ngay muc tieu': TODAY(), 'San pham (SKU:SL,...)': 'VD-001:100' },
  ]);
  wsB['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsB, 'ProductionBatches');

  const wsG = XLSX.utils.json_to_sheet([
    { Sheet: 'Products', MoTa: 'SKU bat buoc, duy nhat. Xoa dong vi du truoc khi import.' },
    { Sheet: 'Sales', MoTa: 'De trong cot ID - he thong tu tao. Nguon: manual | shopee | tiktok | offline | nhanh_vn' },
    { Sheet: 'Expenses', MoTa: 'De trong cot ID. Danh muc: labor | rent | ads | shipping | material | other' },
    { Sheet: 'ProductionBatches', MoTa: 'De trong cot ID. San pham: "SKU1:100, SKU2:50" phan cach bang dau phay.' },
  ]);
  wsG['!cols'] = [{ wch: 22 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsG, 'HuongDan');

  XLSX.writeFile(wb, 'SilenceProduction_Template.xlsx');
};

// ────────────────────────────────────────────────
// IMPORT
// ────────────────────────────────────────────────

const VALID_SOURCES = ['shopee', 'tiktok', 'offline', 'manual', 'nhanh_vn'];
const VALID_EXPENSE_CATS = ['labor', 'rent', 'ads', 'shipping', 'material', 'other'];
const VALID_STAGES = ['ordered', 'paid', 'shipping', 'producing', 'delivered'];
const VALID_STATUSES = ['running', 'completed'];

const parseDate = (raw: unknown): string => {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 10);
  if (typeof raw === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(raw);
    if (date) return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
  }
  return TODAY();
};

/**
 * Parse file Excel tai len tu nguoi dung.
 * Khong ghi vao state — chi tra ve de UI preview truoc khi xac nhan.
 */
export const importFromExcel = (file: File): Promise<ExcelImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });

        const warnings: string[] = [];
        const sheetsFound: string[] = wb.SheetNames.filter((n) => n !== 'HuongDan');

        // ── Parse Products ──
        const products: Product[] = [];
        if (wb.SheetNames.includes('Products')) {
          const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets['Products']);
          rows.forEach((row, idx) => {
            const sku = toStr(row['SKU']).toUpperCase();
            const name = toStr(row['Ten san pham']);
            const cost = toNum(row['Gia goc (VND)']);
            const price = toNum(row['Gia ban (VND)']);
            if (!sku || !name) {
              if (sku || name) warnings.push(`Products dong ${idx + 2}: Bo qua vi thieu SKU hoac Ten.`);
              return;
            }
            if (cost <= 0 || price <= 0) {
              warnings.push(`Products dong ${idx + 2} (${sku}): Gia goc/ban nen > 0.`);
            }
            products.push({
              sku,
              name,
              defaultCost: cost,
              defaultPrice: price,
              nhanhStock: toNum(row['Ton kho Nhanh.vn']),
            });
          });
        }

        // ── Parse Sales ──
        const sales: Sale[] = [];
        if (wb.SheetNames.includes('Sales')) {
          const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets['Sales']);
          rows.forEach((row, idx) => {
            const sku = toStr(row['SKU']).toUpperCase();
            const qty = toNum(row['So luong']);
            const price = toNum(row['Don gia (VND)']);
            const source = toStr(row['Nguon']).toLowerCase();
            const saleDate = parseDate(row['Ngay ban']);

            if (!sku || qty <= 0) {
              if (sku) warnings.push(`Sales dong ${idx + 2}: Bo qua vi thieu SKU hoac So luong <= 0.`);
              return;
            }
            if (!VALID_SOURCES.includes(source)) {
              warnings.push(`Sales dong ${idx + 2} (${sku}): Nguon "${source}" khong hop le, dat thanh "manual".`);
            }
            const existingId = toStr(row['ID']);
            sales.push({
              id: existingId || `SALE-XLS-${Date.now()}-${idx}`,
              productSku: sku,
              quantity: qty,
              unitPrice: price,
              saleDate,
              source: (VALID_SOURCES.includes(source) ? source : 'manual') as Sale['source'],
            });
          });
        }

        // ── Parse Expenses ──
        const expenses: Expense[] = [];
        if (wb.SheetNames.includes('Expenses')) {
          const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets['Expenses']);
          rows.forEach((row, idx) => {
            const category = toStr(row['Danh muc']).toLowerCase();
            const amount = toNum(row['So tien (VND)']);
            const expenseDate = parseDate(row['Ngay']);

            if (amount <= 0) {
              warnings.push(`Expenses dong ${idx + 2}: Bo qua vi So tien <= 0.`);
              return;
            }
            if (!VALID_EXPENSE_CATS.includes(category)) {
              warnings.push(`Expenses dong ${idx + 2}: Danh muc "${category}" khong hop le, dat thanh "other".`);
            }
            const existingId = toStr(row['ID']);
            expenses.push({
              id: existingId || `EXP-XLS-${Date.now()}-${idx}`,
              category: (VALID_EXPENSE_CATS.includes(category) ? category : 'other') as Expense['category'],
              amount,
              expenseDate,
              notes: toStr(row['Ghi chu']),
            });
          });
        }

        // ── Parse ProductionBatches ──
        const productionBatches: ProductionBatch[] = [];
        if (wb.SheetNames.includes('ProductionBatches')) {
          const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets['ProductionBatches']);
          rows.forEach((row, idx) => {
            const stage = toStr(row['Giai doan']).toLowerCase();
            const status = toStr(row['Trang thai']).toLowerCase();
            const itemsRaw = toStr(row['San pham (SKU:SL,...)']);
            const createdDateStr = parseDate(row['Ngay tao']);
            const targetDate = parseDate(row['Ngay muc tieu']);
            const createdAt = new Date(createdDateStr).toISOString();

            const items = itemsRaw.split(',').map((s) => s.trim()).filter(Boolean).map((seg) => {
              const parts = seg.split(':');
              return { productSku: (parts[0] || '').trim().toUpperCase(), quantity: toNum(parts[1]) };
            }).filter((i) => i.productSku && i.quantity > 0);

            if (items.length === 0) {
              if (itemsRaw) warnings.push(`ProductionBatches dong ${idx + 2}: Bo qua vi khong co san pham hop le.`);
              return;
            }
            if (!VALID_STAGES.includes(stage)) {
              warnings.push(`ProductionBatches dong ${idx + 2}: Giai doan "${stage}" khong hop le, dat thanh "ordered".`);
            }
            const existingId = toStr(row['ID']);
            productionBatches.push({
              id: existingId || `BATCH-XLS-${Date.now()}-${idx}`,
              items,
              currentStage: (VALID_STAGES.includes(stage) ? stage : 'ordered') as ProductionBatch['currentStage'],
              status: (VALID_STATUSES.includes(status) ? status : 'running') as ProductionBatch['status'],
              createdAt,
              targetDate,
            });
          });
        }

        resolve({
          products,
          sales,
          expenses,
          productionBatches,
          warnings,
          parsedAt: new Date().toISOString(),
          sheetsFound,
        });
      } catch (err) {
        reject(new Error(`Khong the doc file Excel: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error('Loi doc file.'));
    reader.readAsArrayBuffer(file);
  });
};

// ────────────────────────────────────────────────
// PAGE-SPECIFIC EXPORT & TEMPLATE HELPERS
// ────────────────────────────────────────────────

export const exportProductsToExcel = (products: Product[]): void => {
  const wb = XLSX.utils.book_new();
  const productRows = products.map((p) => ({
    SKU: p.sku,
    'Ten san pham': p.name,
    'Gia goc (VND)': p.defaultCost,
    'Gia ban (VND)': p.defaultPrice,
    'Ton kho Nhanh.vn': p.nhanhStock ?? 0,
  }));
  const wsProducts = XLSX.utils.json_to_sheet(productRows.length ? productRows : [
    { SKU: '', 'Ten san pham': '', 'Gia goc (VND)': 0, 'Gia ban (VND)': 0, 'Ton kho Nhanh.vn': 0 }
  ]);
  wsProducts['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  XLSX.writeFile(wb, `SilenceProduction_Products_${timestamp}.xlsx`);
};

export const generateProductsTemplate = (): void => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    { SKU: 'AO-THUN-01', 'Ten san pham': 'Áo thun Silence Classic', 'Gia goc (VND)': 65000, 'Gia ban (VND)': 150000, 'Ton kho Nhanh.vn': 120 }
  ]);
  ws['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'SilenceProduction_Products_Template.xlsx');
};

export const exportBatchesToExcel = (batches: ProductionBatch[]): void => {
  const wb = XLSX.utils.book_new();
  const batchRows = batches.map((b) => ({
    ID: b.id,
    'Trang thai': b.status,
    'Giai doan': b.currentStage,
    'Ngay tao': b.createdAt.slice(0, 10),
    'Ngay muc tieu': b.targetDate,
    'San pham (SKU:SL,...)': b.items.map((i) => `${i.productSku}:${i.quantity}`).join(', '),
  }));
  const wsBatches = XLSX.utils.json_to_sheet(batchRows.length ? batchRows : [{
    ID: '', 'Trang thai': 'running', 'Giai doan': 'ordered',
    'Ngay tao': TODAY(), 'Ngay muc tieu': TODAY(), 'San pham (SKU:SL,...)': '',
  }]);
  wsBatches['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsBatches, 'ProductionBatches');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  XLSX.writeFile(wb, `SilenceProduction_Batches_${timestamp}.xlsx`);
};

export const generateBatchesTemplate = (): void => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    { ID: 'LOT-20260704-0001', 'Trang thai': 'running', 'Giai doan': 'ordered', 'Ngay tao': TODAY(), 'Ngay muc tieu': TODAY(), 'San pham (SKU:SL,...)': 'AO-THUN-01:150, AO-KHOAC-02:100' }
  ]);
  ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws, 'ProductionBatches');
  XLSX.writeFile(wb, 'SilenceProduction_Batches_Template.xlsx');
};

export const exportExpensesToExcel = (expenses: Expense[]): void => {
  const wb = XLSX.utils.book_new();
  const expenseRows = expenses.map((e) => ({
    ID: e.id,
    'Danh muc': e.category,
    'So tien (VND)': e.amount,
    'Ngay': e.expenseDate,
    'Ghi chu': e.notes,
  }));
  const wsExpenses = XLSX.utils.json_to_sheet(expenseRows.length ? expenseRows : [
    { ID: '', 'Danh muc': 'other', 'So tien (VND)': 0, 'Ngay': TODAY(), 'Ghi chu': '' }
  ]);
  wsExpenses['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  XLSX.writeFile(wb, `SilenceProduction_Expenses_${timestamp}.xlsx`);
};

export const generateExpensesTemplate = (): void => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    { ID: 'EXP-001', 'Danh muc': 'labor', 'So tien (VND)': 4500000, 'Ngay': TODAY(), 'Ghi chu': 'Lương nhân viên đóng gói' }
  ]);
  ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  XLSX.writeFile(wb, 'SilenceProduction_Expenses_Template.xlsx');
};

export const exportSalesToExcel = (sales: Sale[]): void => {
  const wb = XLSX.utils.book_new();
  const saleRows = sales.map((s) => ({
    ID: s.id,
    SKU: s.productSku,
    'So luong': s.quantity,
    'Don gia (VND)': s.unitPrice,
    'Gia sau CK (VND)': s.discountedPrice ?? s.unitPrice,
    'Tong don (VND)': s.totalOrderValue ?? (s.quantity * (s.discountedPrice ?? s.unitPrice)),
    'CP san (VND)': s.platformFee ?? 0,
    'Trang thai': s.orderStatus ?? 'success',
    'Ngay ban': s.saleDate,
    'Nguon': s.source,
  }));
  const wsSales = XLSX.utils.json_to_sheet(saleRows.length ? saleRows : [
    { ID: '', SKU: '', 'So luong': 0, 'Don gia (VND)': 0, 'Gia sau CK (VND)': 0, 'Tong don (VND)': 0, 'CP san (VND)': 0, 'Trang thai': 'success', 'Ngay ban': TODAY(), 'Nguon': 'manual' }
  ]);
  wsSales['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSales, 'Sales');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  XLSX.writeFile(wb, `SilenceProduction_Sales_${timestamp}.xlsx`);
};

export const generateSalesTemplate = (): void => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    { ID: 'SALE-001', SKU: 'AO-THUN-01', 'So luong': 2, 'Don gia (VND)': 150000, 'Gia sau CK (VND)': 140000, 'Tong don (VND)': 280000, 'CP san (VND)': 15000, 'Trang thai': 'success', 'Ngay ban': TODAY(), 'Nguon': 'shopee' }
  ]);
  ws['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  XLSX.writeFile(wb, 'SilenceProduction_Sales_Template.xlsx');
};

export const exportInventoryToExcel = (inventoryData: any[]): void => {
  const wb = XLSX.utils.book_new();
  const rows = inventoryData.map((d) => ({
    SKU: d.sku,
    'Ten san pham': d.name,
    'Ton kha dung (Available)': d.available,
    'Dang san xuat (In Production)': d.inProduction,
    'Da ban (Sold)': d.sold,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  XLSX.writeFile(wb, `SilenceProduction_Inventory_${timestamp}.xlsx`);
};

export const exportForecastToExcel = (forecastData: any[]): void => {
  const wb = XLSX.utils.book_new();
  const rows = forecastData.map((d) => ({
    SKU: d.sku,
    'Ten san pham': d.name,
    'Toc do ban/Ngay': d.dailyVelocity.toFixed(2),
    'Ton kha dung': d.available,
    'Dang san xuat': d.inProduction,
    'Tong ton': d.totalStock,
    'Ngay bao phu (Days of Cover)': d.daysOfCover === Infinity ? 'Infinity' : d.daysOfCover.toFixed(1),
    'Diem dat hang (ROP)': d.reorderPoint.toFixed(1),
    'De xuat goi (Proposed)': d.proposedQty,
    'Canh bao (Alert)': d.alertLevel.toUpperCase(),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, 'ForecastReport');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  XLSX.writeFile(wb, `SilenceProduction_Forecast_${timestamp}.xlsx`);
};

