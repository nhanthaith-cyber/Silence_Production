import React, { createContext, useState, useEffect, useCallback } from 'react';
import type {
  Product, ProductionBatch, ProductionStage, Sale, Expense,
  AppContextType, NhanhApiMode, ConnectionStatus, SyncLog
} from '../types';
import { defaultProducts, defaultBatches, defaultSales, defaultExpenses } from '../data/defaultData';
import { getTodayISO, generateId } from '../utils/formatters';
import { fetchNhanhStock, fetchNhanhOrders, updateNhanhStock, checkNhanhConnection } from '../services/nhanhService';
import { mapNhanhOrderToSale, mergeProductData, filterNewOrders } from '../services/nhanhDataMapper';
import { exportAllData as exportData, parseImportData } from '../services/productionDataService';

// Export context để hook useApp có thể truy cập
export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Connection & Sync State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [apiMode, setApiModeState] = useState<NhanhApiMode>('sandbox');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Load from LocalStorage or seed defaults
  useEffect(() => {
    const localProducts = localStorage.getItem('silence_prod_products');
    const localBatches = localStorage.getItem('silence_prod_batches');
    const localSales = localStorage.getItem('silence_prod_sales');
    const localExpenses = localStorage.getItem('silence_prod_expenses');
    const localSyncLogs = localStorage.getItem('silence_sync_logs');
    const localLastSync = localStorage.getItem('silence_last_sync');
    const localApiMode = localStorage.getItem('silence_nhanh_api_mode');

    if (localProducts) setProducts(JSON.parse(localProducts));
    else {
      setProducts(defaultProducts);
      localStorage.setItem('silence_prod_products', JSON.stringify(defaultProducts));
    }

    if (localBatches) setProductionBatches(JSON.parse(localBatches));
    else {
      setProductionBatches(defaultBatches);
      localStorage.setItem('silence_prod_batches', JSON.stringify(defaultBatches));
    }

    if (localSales) setSales(JSON.parse(localSales));
    else {
      setSales(defaultSales);
      localStorage.setItem('silence_prod_sales', JSON.stringify(defaultSales));
    }

    if (localExpenses) setExpenses(JSON.parse(localExpenses));
    else {
      setExpenses(defaultExpenses);
      localStorage.setItem('silence_prod_expenses', JSON.stringify(defaultExpenses));
    }

    if (localSyncLogs) setSyncLogs(JSON.parse(localSyncLogs));
    if (localLastSync) setLastSyncTime(localLastSync);
    if (localApiMode === 'live' || localApiMode === 'sandbox') setApiModeState(localApiMode as NhanhApiMode);

    // Kiểm tra kết nối ban đầu
    checkNhanhConnection().then((result) => {
      setConnectionStatus(result.connected ? 'connected' : 'sandbox');
    });
  }, []);

  // Save changes helper
  const saveToLocal = (key: string, data: unknown) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // Add sync log entry
  const addSyncLog = useCallback((source: string, action: string, result: 'success' | 'error' | 'sandbox', details: string) => {
    const log: SyncLog = {
      id: generateId('SYNC', 6),
      timestamp: new Date().toISOString(),
      source,
      action,
      result,
      details,
    };
    setSyncLogs((prev) => {
      const updated = [log, ...prev].slice(0, 50); // Giữ tối đa 50 logs
      saveToLocal('silence_sync_logs', updated);
      return updated;
    });
    setLastSyncTime(log.timestamp);
    localStorage.setItem('silence_last_sync', log.timestamp);
  }, []);

  // ============================
  // CRUD Actions
  // ============================

  const addProduct = (product: Product) => {
    const exists = products.some((p) => p.sku.toUpperCase() === product.sku.toUpperCase());
    if (exists) {
      return { success: false, error: 'Mã SKU này đã tồn tại trong hệ thống!' };
    }
    const updated = [...products, { ...product, sku: product.sku.toUpperCase() }];
    setProducts(updated);
    saveToLocal('silence_prod_products', updated);
    return { success: true };
  };

  const bulkAddProducts = (newProducts: Product[]) => {
    const existingSkus = new Set(products.map((p) => p.sku.toUpperCase()));
    const added: Product[] = [];
    const duplicates: string[] = [];
    const invalid: string[] = [];

    newProducts.forEach((prod) => {
      const sku = prod.sku?.trim().toUpperCase();
      const name = prod.name?.trim();
      const defaultCost = Number(prod.defaultCost);
      const defaultPrice = Number(prod.defaultPrice);

      if (!sku || !name || isNaN(defaultCost) || isNaN(defaultPrice) || defaultCost <= 0 || defaultPrice <= 0) {
        invalid.push(prod.sku || 'Không tên');
        return;
      }

      if (existingSkus.has(sku) || added.some((a) => a.sku === sku)) {
        duplicates.push(sku);
        return;
      }

      added.push({
        sku,
        name,
        defaultCost,
        defaultPrice,
      });
    });

    if (added.length > 0) {
      const updated = [...products, ...added];
      setProducts(updated);
      saveToLocal('silence_prod_products', updated);
      addSyncLog('Hệ thống', 'Import Excel', 'success', `Đã import thành công ${added.length} sản phẩm từ file Excel.`);
    }

    return {
      successCount: added.length,
      duplicateCount: duplicates.length,
      invalidCount: invalid.length,
      duplicates,
      invalid,
    };
  };

  const deleteProduct = (sku: string) => {
    const updated = products.filter((p) => p.sku !== sku);
    setProducts(updated);
    saveToLocal('silence_prod_products', updated);
  };

  const createProductionBatch = (batch: { productSku: string; quantity: number; targetDate: string }) => {
    const today = getTodayISO();
    const rand = Math.floor(Math.random() * 9000) + 1000;
    const newBatch: ProductionBatch = {
      id: `LOT-${today.replace(/-/g, '')}-${rand}`,
      productSku: batch.productSku,
      quantity: batch.quantity,
      currentStage: 'cutting',
      status: 'running',
      targetDate: batch.targetDate,
      createdAt: today,
    };
    const updated = [newBatch, ...productionBatches];
    setProductionBatches(updated);
    saveToLocal('silence_prod_batches', updated);
  };

  const advanceBatchStage = (batchId: string) => {
    const stages: ProductionStage[] = ['cutting', 'sewing', 'finishing', 'qc', 'ready'];
    const updated = productionBatches.map((batch) => {
      if (batch.id !== batchId) return batch;

      const currentIndex = stages.indexOf(batch.currentStage);
      if (currentIndex === -1 || currentIndex === stages.length - 1) return batch;

      const nextStage = stages[currentIndex + 1];
      const isCompleted = nextStage === 'ready';

      return {
        ...batch,
        currentStage: nextStage,
        status: isCompleted ? 'completed' as const : 'running' as const,
      };
    });
    setProductionBatches(updated);
    saveToLocal('silence_prod_batches', updated);
  };

  const deleteProductionBatch = (batchId: string) => {
    const updated = productionBatches.filter((b) => b.id !== batchId);
    setProductionBatches(updated);
    saveToLocal('silence_prod_batches', updated);
  };

  const addSale = (saleData: Omit<Sale, 'id' | 'saleDate'>) => {
    const today = getTodayISO();
    const newSale: Sale = {
      id: generateId('SALE', 5),
      ...saleData,
      saleDate: today,
    };
    const updated = [newSale, ...sales];
    setSales(updated);
    saveToLocal('silence_prod_sales', updated);
  };

  const addExpense = (expenseData: Omit<Expense, 'id' | 'expenseDate'>) => {
    const today = getTodayISO();
    const newExpense: Expense = {
      id: `EXP-${today.replace(/-/g, '')}-${Math.floor(Math.random() * 90) + 10}`,
      ...expenseData,
      expenseDate: today,
    };
    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    saveToLocal('silence_prod_expenses', updated);
  };

  // ============================
  // Sync Nhanh.vn
  // ============================

  /** Đồng bộ đơn hàng từ Nhanh.vn (tất cả nguồn: Shopee, Tiktok, Lên ngoài) */
  const syncSalesFromNhanh = async (): Promise<number> => {
    try {
      const nhanhOrders = await fetchNhanhOrders();

      if (nhanhOrders.length === 0) {
        addSyncLog('Nhanh.vn', 'Đồng bộ đơn hàng', connectionStatus === 'connected' ? 'success' : 'sandbox',
          'Không có đơn hàng mới.');
        return 0;
      }

      const newOrders = filterNewOrders(nhanhOrders, sales);
      if (newOrders.length === 0) {
        addSyncLog('Nhanh.vn', 'Đồng bộ đơn hàng', 'success', 'Không có đơn hàng mới (tất cả đã đồng bộ).');
        return 0;
      }

      const newSales: Sale[] = [];
      newOrders.forEach((order) => {
        const mapped = mapNhanhOrderToSale(order);
        newSales.push(...mapped);
      });

      setSales((prev) => {
        const updated = [...newSales, ...prev];
        saveToLocal('silence_prod_sales', updated);
        return updated;
      });

      addSyncLog('Nhanh.vn', 'Đồng bộ đơn hàng', connectionStatus === 'connected' ? 'success' : 'sandbox',
        `Đã nhận ${newSales.length} đơn hàng mới từ ${newOrders.length} order.`);
      return newSales.length;
    } catch (e) {
      console.error('Lỗi syncSalesFromNhanh:', e);
      addSyncLog('Nhanh.vn', 'Đồng bộ đơn hàng', 'error', `Lỗi: ${(e as Error).message}`);
      return 0;
    }
  };

  /** Nhận tồn kho và giá bán từ Nhanh.vn về hệ thống local */
  const syncStockFromNhanh = async (): Promise<number> => {
    try {
      const nhanhStocks = await fetchNhanhStock();

      if (nhanhStocks.length === 0) {
        addSyncLog('Nhanh.vn', 'Nhận tồn kho', connectionStatus === 'connected' ? 'success' : 'sandbox',
          'Không có dữ liệu sản phẩm mới từ Nhanh.vn.');
        return 0;
      }

      const merged = mergeProductData(nhanhStocks, products);
      const updatedCount = merged.length - products.length + nhanhStocks.filter((ns) =>
        products.some((p) => p.sku.toUpperCase() === ns.sku.toUpperCase())
      ).length;

      setProducts(merged);
      saveToLocal('silence_prod_products', merged);

      addSyncLog('Nhanh.vn', 'Nhận tồn kho', connectionStatus === 'connected' ? 'success' : 'sandbox',
        `Đã cập nhật ${updatedCount} sản phẩm, thêm mới ${merged.length - products.length} sản phẩm.`);
      return updatedCount;
    } catch (e) {
      console.error('Lỗi syncStockFromNhanh:', e);
      addSyncLog('Nhanh.vn', 'Nhận tồn kho', 'error', `Lỗi: ${(e as Error).message}`);
      return 0;
    }
  };

  /** Đẩy tồn kho khả dụng từ xưởng lên Nhanh.vn */
  const syncStockToNhanh = async (sku: string): Promise<boolean> => {
    try {
      // Tính tồn kho khả dụng
      const totalReady = productionBatches
        .filter((b) => b.productSku === sku && b.status === 'completed')
        .reduce((sum, b) => sum + b.quantity, 0);
      const totalSold = sales
        .filter((s) => s.productSku === sku)
        .reduce((sum, s) => sum + s.quantity, 0);
      const availableStock = Math.max(0, totalReady - totalSold);

      const success = await updateNhanhStock(sku, availableStock);

      addSyncLog('Nhanh.vn', 'Đẩy tồn kho', success ? 'success' : 'error',
        success
          ? `Đã đẩy SKU ${sku}: ${availableStock} cái lên Nhanh.vn.`
          : `Lỗi đẩy SKU ${sku}.`);
      return success;
    } catch (e) {
      console.error('Lỗi syncStockToNhanh:', e);
      addSyncLog('Nhanh.vn', 'Đẩy tồn kho', 'error', `Lỗi: ${(e as Error).message}`);
      return false;
    }
  };

  // ============================
  // Connection & API Mode
  // ============================

  const checkConnection = async (): Promise<boolean> => {
    setConnectionStatus('checking');
    const result = await checkNhanhConnection();
    setConnectionStatus(result.connected ? 'connected' : 'sandbox');
    addSyncLog('Hệ thống', 'Kiểm tra kết nối', result.connected ? 'success' : 'sandbox', result.message);
    return result.connected;
  };

  const setApiMode = (mode: NhanhApiMode) => {
    setApiModeState(mode);
    localStorage.setItem('silence_nhanh_api_mode', mode);
    // Re-check connection khi đổi mode
    checkConnection();
  };

  // ============================
  // Data Management
  // ============================

  const exportAllDataFn = (): string => {
    return exportData(products, productionBatches, sales, expenses);
  };

  const importAllData = (json: string): { success: boolean; error?: string } => {
    const result = parseImportData(json);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const { data } = result;
    setProducts(data.products);
    setProductionBatches(data.productionBatches);
    setSales(data.sales);
    setExpenses(data.expenses);

    saveToLocal('silence_prod_products', data.products);
    saveToLocal('silence_prod_batches', data.productionBatches);
    saveToLocal('silence_prod_sales', data.sales);
    saveToLocal('silence_prod_expenses', data.expenses);

    addSyncLog('Hệ thống', 'Import dữ liệu', 'success',
      `Đã import: ${data.products.length} sản phẩm, ${data.productionBatches.length} lô SX, ${data.sales.length} đơn hàng, ${data.expenses.length} chi phí.`);

    return { success: true };
  };

  const clearData = () => {
    localStorage.removeItem('silence_prod_products');
    localStorage.removeItem('silence_prod_batches');
    localStorage.removeItem('silence_prod_sales');
    localStorage.removeItem('silence_prod_expenses');
    setProducts(defaultProducts);
    setProductionBatches(defaultBatches);
    setSales(defaultSales);
    setExpenses(defaultExpenses);
  };

  return (
    <AppContext.Provider
      value={{
        products,
        productionBatches,
        sales,
        expenses,
        addProduct,
        bulkAddProducts,
        deleteProduct,
        createProductionBatch,
        advanceBatchStage,
        deleteProductionBatch,
        addSale,
        addExpense,
        syncSalesFromNhanh,
        syncStockFromNhanh,
        syncStockToNhanh,
        connectionStatus,
        apiMode,
        lastSyncTime,
        syncLogs,
        checkConnection,
        setApiMode,
        exportAllData: exportAllDataFn,
        importAllData,
        clearData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
