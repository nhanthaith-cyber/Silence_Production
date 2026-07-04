import React, { createContext, useState, useEffect, useCallback } from 'react';
import type {
  Product, ProductionBatch, ProductionBatchItem, ProductionStage, Sale, Expense,
  AppContextType, NhanhApiMode, ConnectionStatus, SyncLog, UserWithPassword
} from '../types';
import { defaultProducts, defaultBatches, defaultSales, defaultExpenses } from '../data/defaultData';
import { getTodayISO, generateId } from '../utils/formatters';
import { fetchNhanhStock, fetchNhanhOrders, updateNhanhStock, checkNhanhConnection } from '../services/nhanhService';
import { mapNhanhOrderToSale, mergeProductData } from '../services/nhanhDataMapper';
import { exportAllData as exportData, parseImportData } from '../services/productionDataService';

// Export context để hook useApp có thể truy cập
export const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper: migrate batches from old single-SKU format to new items[] format
const migrateBatches = (batches: ProductionBatch[]): ProductionBatch[] =>
  batches.map((b) => {
    if (b.items && b.items.length > 0) return b; // Already new format
    // Old format: has productSku and quantity at top level
    const legacySku = (b as unknown as { productSku?: string }).productSku;
    const legacyQty = (b as unknown as { quantity?: number }).quantity;
    const oldStageMap: Record<string, string> = {
      cutting: 'ordered', sewing: 'paid', finishing: 'shipping', qc: 'producing', ready: 'delivered',
    };
    const migratedStage = (oldStageMap[(b.currentStage as string)] ?? b.currentStage) as ProductionBatch['currentStage'];
    return {
      ...b,
      currentStage: migratedStage,
      items: legacySku ? [{ productSku: legacySku, quantity: legacyQty ?? 0 }] : [],
    };
  });

const defaultUsers: UserWithPassword[] = [
  {
    username: 'admin',
    password: 'silence@2026',
    name: 'Quản trị viên',
    role: 'admin',
    allowedPages: ['dashboard', 'production', 'expenses', 'inventory', 'products', 'forecast', 'ai', 'settings'],
  },
  {
    username: 'production',
    password: 'production@2026',
    name: 'Quản lý Sản xuất',
    role: 'production',
    allowedPages: ['dashboard', 'production', 'products', 'ai'],
  },
  {
    username: 'finance',
    password: 'finance@2026',
    name: 'Quản lý Tài chính',
    role: 'finance',
    allowedPages: ['dashboard', 'expenses', 'settings'],
  },
  {
    username: 'warehouse',
    password: 'warehouse@2026',
    name: 'Thủ kho',
    role: 'warehouse',
    allowedPages: ['dashboard', 'inventory', 'products', 'forecast'],
  },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<UserWithPassword[]>([]);

  // Connection & Sync State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [apiMode, setApiModeState] = useState<NhanhApiMode>('sandbox');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Load from LocalStorage or seed defaults
  useEffect(() => {
    try {
      const localUsers = localStorage.getItem('silence_prod_users');
      if (localUsers) setUsers(JSON.parse(localUsers));
      else {
        setUsers(defaultUsers);
        localStorage.setItem('silence_prod_users', JSON.stringify(defaultUsers));
      }

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

      if (localBatches) {
        const raw = JSON.parse(localBatches);
        const migrated = migrateBatches(raw);
        setProductionBatches(migrated);
        // Persist migrated data if it changed
        if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
          localStorage.setItem('silence_prod_batches', JSON.stringify(migrated));
        }
      } else {
        const migrated = migrateBatches(defaultBatches);
        setProductionBatches(migrated);
        localStorage.setItem('silence_prod_batches', JSON.stringify(migrated));
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
    } catch (e) {
      console.error('Error loading data from localStorage, resetting to defaults:', e);
      setProducts(defaultProducts);
      setProductionBatches(defaultBatches);
      setSales(defaultSales);
      setExpenses(defaultExpenses);
      localStorage.setItem('silence_prod_products', JSON.stringify(defaultProducts));
      localStorage.setItem('silence_prod_batches', JSON.stringify(defaultBatches));
      localStorage.setItem('silence_prod_sales', JSON.stringify(defaultSales));
      localStorage.setItem('silence_prod_expenses', JSON.stringify(defaultExpenses));
    }

    // Kiểm tra kết nối ban đầu
    checkNhanhConnection().then((result) => {
      setConnectionStatus(result.connected ? 'connected' : 'sandbox');
    });
  }, []);

  // Tự động đồng bộ ngầm định kỳ (Auto-Polling) mỗi 5 phút một lần
  useEffect(() => {
    // Chỉ tự động đồng bộ khi ở chế độ Live và đã kết nối thành công
    if (connectionStatus !== 'connected' || apiMode !== 'live') return;

    // Trì hoãn 3 giây trước khi chạy lượt đồng bộ ngầm đầu tiên (tránh làm chậm ứng dụng khi vừa tải trang)
    const initialTimer = setTimeout(() => {
      console.log('[Auto-Sync] Bắt đầu tự động đồng bộ lần đầu...');
      syncSalesFromNhanh().catch(err => console.warn('[Auto-Sync Sales Error]', err));
      syncStockFromNhanh().catch(err => console.warn('[Auto-Sync Stock Error]', err));
    }, 3000);

    // Đồng bộ định kỳ mỗi 5 phút
    const intervalTime = 5 * 60 * 1000;
    const interval = setInterval(() => {
      console.log('[Auto-Sync] Chạy đồng bộ định kỳ...');
      syncSalesFromNhanh().catch(err => console.warn('[Auto-Sync Sales Error]', err));
      syncStockFromNhanh().catch(err => console.warn('[Auto-Sync Stock Error]', err));
    }, intervalTime);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus, apiMode]);

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

  const createProductionBatch = (batch: { items: ProductionBatchItem[]; targetDate: string }) => {
    const today = getTodayISO();
    const rand = Math.floor(Math.random() * 9000) + 1000;
    const newBatch: ProductionBatch = {
      id: `LOT-${today.replace(/-/g, '')}-${rand}`,
      items: batch.items,
      currentStage: 'ordered',
      status: 'running',
      targetDate: batch.targetDate,
      createdAt: today,
    };
    const updated = [newBatch, ...productionBatches];
    setProductionBatches(updated);
    saveToLocal('silence_prod_batches', updated);
  };

  const advanceBatchStage = (batchId: string) => {
    const stages: ProductionStage[] = ['ordered', 'paid', 'shipping', 'producing', 'delivered'];
    const updated = productionBatches.map((batch) => {
      if (batch.id !== batchId) return batch;

      const currentIndex = stages.indexOf(batch.currentStage);
      if (currentIndex === -1 || currentIndex === stages.length - 1) return batch;

      const nextStage = stages[currentIndex + 1];
      const isCompleted = nextStage === 'delivered';

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
  const syncSalesFromNhanh = async (fromDate?: string, toDate?: string): Promise<number> => {
    try {
      const nhanhOrders = await fetchNhanhOrders(fromDate, toDate);

      if (nhanhOrders.length === 0) {
        addSyncLog('Nhanh.vn', 'Đồng bộ đơn hàng', connectionStatus === 'connected' ? 'success' : 'sandbox',
          'Không có đơn hàng mới.');
        return 0;
      }

      // Trạng thái đơn hàng không tính vào doanh thu bán hàng (Hủy, Thất bại, Trả hàng)
      const cancelStatuses = ['canceled', 'failed', 'returned', 'returning', 'aborted', 'cancel'];

      let addedCount = 0;
      let removedCount = 0;
      let updatedCount = 0;

      setSales((prevSales) => {
        let currentSales = [...prevSales];

        nhanhOrders.forEach((order) => {
          const isCanceled = cancelStatuses.includes(order.status.toLowerCase());
          const orderIdStr = String(order.id);

          // Tìm đơn hàng local liên quan đến orderId này (hỗ trợ đơn nhiều sản phẩm bị tách dòng)
          const relatedSales = currentSales.filter(
            (s) => s.id === orderIdStr || s.id.startsWith(orderIdStr + '-')
          );
          const exists = relatedSales.length > 0;

          if (isCanceled) {
            // Nếu đơn hàng bị hủy hoặc chuyển hoàn -> Xóa khỏi doanh số local
            if (exists) {
              currentSales = currentSales.filter(
                (s) => s.id !== orderIdStr && !s.id.startsWith(orderIdStr + '-')
              );
              removedCount += relatedSales.length;
            }
          } else {
            const mappedSales = mapNhanhOrderToSale(order);

            if (!exists) {
              // Chưa có ở local -> Thêm mới
              currentSales = [...mappedSales, ...currentSales];
              addedCount += mappedSales.length;
            } else {
              // Đã có ở local -> Cập nhật thông tin mới nhất bằng cách ghi đè
              currentSales = currentSales.filter(
                (s) => s.id !== orderIdStr && !s.id.startsWith(orderIdStr + '-')
              );
              currentSales = [...mappedSales, ...currentSales];
              updatedCount += mappedSales.length;
            }
          }
        });

        saveToLocal('silence_prod_sales', currentSales);
        return currentSales;
      });

      // Tạo thông điệp log chi tiết
      let logMsg = `Đồng bộ hoàn tất: `;
      const parts: string[] = [];
      if (addedCount > 0) parts.push(`thêm mới ${addedCount} đơn`);
      if (removedCount > 0) parts.push(`hủy bỏ ${removedCount} đơn (do hủy/trả trên Nhanh)`);
      if (updatedCount > 0) parts.push(`cập nhật ${updatedCount} đơn`);
      
      if (parts.length > 0) {
        logMsg += parts.join(', ') + '.';
      } else {
        logMsg += 'không có thay đổi nào.';
      }

      addSyncLog('Nhanh.vn', 'Đồng bộ đơn hàng', connectionStatus === 'connected' ? 'success' : 'sandbox', logMsg);
      return addedCount;
    } catch (e) {
      console.error('Lỗi syncSalesFromNhanh:', e);
      addSyncLog('Nhanh.vn', 'Đồng bộ đơn hàng', 'error', `Lỗi: ${(e as Error).message}`);
      throw e;
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
      throw e;
    }
  };

  /** Đẩy tồn kho khả dụng từ xưởng lên Nhanh.vn */
  const syncStockToNhanh = async (sku: string): Promise<boolean> => {
    try {
      // Tính tồn kho khả dụng từ items[] của các lô đã hoàn thành
      const totalReady = productionBatches
        .filter((b) => b.status === 'completed')
        .reduce((sum, b) => {
          const itemQty = b.items.filter((i) => i.productSku === sku).reduce((s, i) => s + i.quantity, 0);
          return sum + itemQty;
        }, 0);
      const totalSold = sales
        .filter((s) => s.productSku === sku)
        .reduce((sum, s) => sum + s.quantity, 0);
      const availableStock = Math.max(0, totalReady - totalSold);

      const success = await updateNhanhStock(sku, availableStock);

      addSyncLog('Nhanh.vn', 'Đẩy tồn kho', success ? 'success' : 'error',
        success
          ? `Đã đẩy SKU ${sku}: ${availableStock} cái lên Nhanh.vn.`
          : `Lỗi đẩy SKU ${sku}.`);

      if (success) {
        setProducts((prev) => {
          const updated = prev.map((p) => p.sku === sku ? { ...p, nhanhStock: availableStock } : p);
          saveToLocal('silence_prod_products', updated);
          return updated;
        });
      }

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
    const migratedBatches = migrateBatches(data.productionBatches);
    setProducts(data.products);
    setProductionBatches(migratedBatches);
    setSales(data.sales);
    setExpenses(data.expenses);

    saveToLocal('silence_prod_products', data.products);
    saveToLocal('silence_prod_batches', migratedBatches);
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
    localStorage.removeItem('silence_prod_users');
    setProducts(defaultProducts);
    setProductionBatches(defaultBatches);
    setSales(defaultSales);
    setExpenses(defaultExpenses);
    setUsers(defaultUsers);
  };

  const addUser = (newUser: UserWithPassword) => {
    const usernameClean = newUser.username.trim().toLowerCase();
    if (!usernameClean) return { success: false, error: 'Tên đăng nhập không được để trống!' };
    if (users.some((u) => u.username === usernameClean)) {
      return { success: false, error: 'Tên đăng nhập đã tồn tại!' };
    }
    const updated = [...users, { ...newUser, username: usernameClean }];
    setUsers(updated);
    saveToLocal('silence_prod_users', updated);
    return { success: true };
  };

  const deleteUser = (username: string) => {
    const usernameClean = username.trim().toLowerCase();
    if (usernameClean === 'admin') {
      return { success: false, error: 'Không thể xóa tài khoản Quản trị viên hệ thống (admin)!' };
    }
    const updated = users.filter((u) => u.username !== usernameClean);
    setUsers(updated);
    saveToLocal('silence_prod_users', updated);
    return { success: true };
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
        users,
        addUser,
        deleteUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
