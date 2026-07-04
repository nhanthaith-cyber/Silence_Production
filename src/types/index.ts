// ============================
// Type definitions cho Silence Production
// ============================

export interface Product {
  sku: string;
  name: string;
  defaultCost: number;
  defaultPrice: number;
  nhanhStock?: number;
}

export type ProductionStage = 'ordered' | 'paid' | 'shipping' | 'producing' | 'delivered';

export interface ProductionBatchItem {
  productSku: string;
  quantity: number;
}

export interface ProductionBatch {
  id: string;
  /** Danh sách sản phẩm (SKU + số lượng) trong lệnh sản xuất này */
  items: ProductionBatchItem[];
  /** @deprecated Dùng items[0].productSku — chỉ giữ để tương thích với dữ liệu cũ */
  productSku?: string;
  /** @deprecated Dùng items[0].quantity — chỉ giữ để tương thích với dữ liệu cũ */
  quantity?: number;
  currentStage: ProductionStage;
  status: 'running' | 'completed';
  targetDate: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  /** ID đơn hàng gốc từ Nhanh.vn — nhiều Sale cùng orderId = cùng 1 đơn */
  orderId?: string;
  productSku: string;
  quantity: number;
  /** Giá bán gốc (trước chiết khấu) */
  unitPrice: number;
  /** Giá bán sau chiết khấu — dùng để tính doanh thu thực */
  discountedPrice?: number;
  /** Tổng giá trị đơn hàng (bao gồm tất cả sản phẩm trong đơn) */
  totalOrderValue?: number;
  /** Chi phí sàn (hoa hồng Shopee, TikTok...) của toàn đơn */
  platformFee?: number;
  /** Trạng thái đơn hàng từ Nhanh.vn */
  orderStatus?: string;
  saleDate: string;
  source: SaleSource;
}

/** Nguồn đơn hàng: tất cả lấy từ Nhanh.vn, phân loại theo kênh bán */
export type SaleSource = 'shopee' | 'tiktok' | 'offline' | 'manual' | 'nhanh_vn';

export type ExpenseCategory = 'labor' | 'rent' | 'ads' | 'shipping' | 'material' | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  notes: string;
}

/** Chế độ API: sandbox (mock) hoặc live (kết nối thực) */
export type NhanhApiMode = 'sandbox' | 'live';

/** Trạng thái kết nối API Nhanh.vn */
export type ConnectionStatus = 'connected' | 'sandbox' | 'error' | 'checking';

/** Log mỗi lần đồng bộ dữ liệu */
export interface SyncLog {
  id: string;
  timestamp: string;
  source: string;
  action: string;
  result: 'success' | 'error' | 'sandbox';
  details: string;
}

export interface AppContextType {
  products: Product[];
  productionBatches: ProductionBatch[];
  sales: Sale[];
  expenses: Expense[];

  // CRUD Actions
  addProduct: (product: Product) => { success: boolean; error?: string };
  bulkAddProducts: (products: Product[]) => {
    successCount: number;
    duplicateCount: number;
    invalidCount: number;
    duplicates: string[];
    invalid: string[];
  };
  deleteProduct: (sku: string) => void;
  createProductionBatch: (batch: { items: ProductionBatchItem[]; targetDate: string }) => void;
  advanceBatchStage: (batchId: string) => void;
  deleteProductionBatch: (batchId: string) => void;
  addSale: (sale: Omit<Sale, 'id' | 'saleDate'>) => void;
  addExpense: (expense: Omit<Expense, 'id' | 'expenseDate'>) => void;

  // Sync Nhanh.vn
  syncSalesFromNhanh: (fromDate?: string, toDate?: string) => Promise<number>;
  syncStockFromNhanh: () => Promise<number>;
  syncStockToNhanh: (sku: string) => Promise<boolean>;

  // Connection & Status
  connectionStatus: ConnectionStatus;
  apiMode: NhanhApiMode;
  lastSyncTime: string | null;
  syncLogs: SyncLog[];
  checkConnection: () => Promise<boolean>;
  setApiMode: (mode: NhanhApiMode) => void;

  // Data Management
  exportAllData: () => string;
  importAllData: (json: string) => { success: boolean; error?: string };
  clearData: () => void;

  // User Management
  users: UserWithPassword[];
  addUser: (user: UserWithPassword) => { success: boolean; error?: string };
  deleteUser: (username: string) => { success: boolean; error?: string };
}

export interface User {
  username: string;
  name: string;
  role: string;
  allowedPages: string[];
}

export interface UserWithPassword extends User {
  password?: string;
}

// ============================
// Excel Import/Export
// ============================

/** Chế độ import: ghi đè toàn bộ hoặc thêm mới (append) */
export type ExcelImportMode = 'overwrite' | 'append';

/** Kết quả parse file Excel trước khi xác nhận */
export interface ExcelImportResult {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  productionBatches: ProductionBatch[];
  warnings: string[];
  /** Timestamp tạo lúc parse */
  parsedAt: string;
  /** Số sheet đọc được */
  sheetsFound: string[];
}

