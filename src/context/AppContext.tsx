import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  Product, ProductionBatch, ProductionBatchItem, ProductionStage, Sale, Expense,
  ActualRevenue, FirebaseSyncStatus,
  AppContextType, NhanhApiMode, ConnectionStatus, SyncLog, UserWithPassword,
  User, ActionLog, ActionLogCategory
} from '../types';
import { defaultProducts, defaultBatches, defaultSales, defaultExpenses } from '../data/defaultData';
import { getTodayISO, generateId } from '../utils/formatters';
import { fetchNhanhStock, fetchNhanhOrders, updateNhanhStock, checkNhanhConnection } from '../services/nhanhService';
import { mapNhanhOrderToSale, mergeProductData } from '../services/nhanhDataMapper';
import { exportAllData as exportData, parseImportData } from '../services/productionDataService';
import {
  initSync,
  pushToFirebase,
  pushAllToFirebase,
  listenFirebase,
  cleanupSync,
  onSyncStatusChange,
  isLocalPushInProgress,
  markLocalPushInProgress,
  getSyncStatus,
  type FirebaseDataPath,
} from '../services/firebaseSyncService';
import type { Unsubscribe } from 'firebase/database';
import { isFirebaseConfigured } from '../services/firebaseConfig';

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
  const [actualRevenues, setActualRevenues] = useState<ActualRevenue[]>([]);
  const [users, setUsers] = useState<UserWithPassword[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);

  // Connection & Sync State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [apiMode, setApiModeState] = useState<NhanhApiMode>('sandbox');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Firebase Cloud Sync State
  const [firebaseSyncStatus, setFirebaseSyncStatus] = useState<FirebaseSyncStatus>('disabled');
  /**
   * Flag để tránh vòng lặp vô hạn: khi nhận dữ liệu từ Firebase listener,
   * ta set state → nhưng KHÔNG muốn push ngược lên Firebase.
   * Mỗi path có flag riêng, reset sau 1 giây.
   */
  const firebaseUpdateInProgress = useRef<Record<string, boolean>>({});

  // Load from LocalStorage or seed defaults
  useEffect(() => {
    // Hỗ trợ reset dữ liệu qua URL param: ?resetData=true
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('resetData') === 'true') {
      console.log('🔄 resetData=true detected → clearing localStorage...');
      localStorage.removeItem('silence_prod_products');
      localStorage.removeItem('silence_prod_batches');
      localStorage.removeItem('silence_prod_sales');
      localStorage.removeItem('silence_prod_expenses');
      localStorage.removeItem('silence_actual_revenues');
      localStorage.removeItem('silence_sync_logs');
      localStorage.removeItem('silence_last_sync');
      // Remove the query param from URL without reload
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }

    try {
      const localUser = localStorage.getItem('silence_user');
      if (localUser) setUser(JSON.parse(localUser));

      const localActionLogs = localStorage.getItem('silence_action_logs');
      if (localActionLogs) setActionLogs(JSON.parse(localActionLogs));

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

      const localActualRevenues = localStorage.getItem('silence_actual_revenues');
      if (localActualRevenues) setActualRevenues(JSON.parse(localActualRevenues));

      if (localSyncLogs) setSyncLogs(JSON.parse(localSyncLogs));
      if (localLastSync) setLastSyncTime(localLastSync);
      if (localApiMode === 'live' || localApiMode === 'sandbox') setApiModeState(localApiMode as NhanhApiMode);
    } catch (e) {
      console.error('Error loading data from localStorage, resetting to defaults:', e);
      setProducts(defaultProducts);
      setProductionBatches(defaultBatches);
      setSales(defaultSales);
      setExpenses(defaultExpenses);
      setActualRevenues([]);
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

  // ============================
  // Firebase Realtime Sync — Lắng nghe thay đổi từ các thiết bị khác
  // ============================

  useEffect(() => {
    // Khởi tạo Firebase sync
    const firebaseReady = initSync();
    if (!firebaseReady) {
      setFirebaseSyncStatus('disabled');
      return;
    }

    // Đăng ký listener trạng thái sync
    const unsubStatus = onSyncStatusChange((status) => {
      setFirebaseSyncStatus(status);
    });

    // Helper: đánh dấu path đang được cập nhật từ Firebase → tránh dual-write ngược
    const markFirebaseUpdate = (path: string) => {
      firebaseUpdateInProgress.current[path] = true;
      setTimeout(() => {
        firebaseUpdateInProgress.current[path] = false;
      }, 1000);
    };

    // Setup listeners cho từng path dữ liệu
    const unsubscribes: Array<Unsubscribe | null> = [];

    // Listener: Products
    unsubscribes.push(
      listenFirebase<Product[]>('products', (data) => {
        if (data && Array.isArray(data) && !isLocalPushInProgress('products')) {
          markFirebaseUpdate('products');
          setProducts(data);
          localStorage.setItem('silence_prod_products', JSON.stringify(data));
          console.log('[FirebaseSync] 📥 Products cập nhật từ cloud:', data.length, 'items');
        }
      })
    );

    // Listener: Production Batches
    unsubscribes.push(
      listenFirebase<ProductionBatch[]>('productionBatches', (data) => {
        if (data && Array.isArray(data) && !isLocalPushInProgress('productionBatches')) {
          markFirebaseUpdate('productionBatches');
          const migrated = migrateBatches(data);
          setProductionBatches(migrated);
          localStorage.setItem('silence_prod_batches', JSON.stringify(migrated));
          console.log('[FirebaseSync] 📥 Batches cập nhật từ cloud:', migrated.length, 'items');
        }
      })
    );

    // Listener: Sales
    unsubscribes.push(
      listenFirebase<Sale[]>('sales', (data) => {
        if (data && Array.isArray(data) && !isLocalPushInProgress('sales')) {
          markFirebaseUpdate('sales');
          setSales(data);
          localStorage.setItem('silence_prod_sales', JSON.stringify(data));
          console.log('[FirebaseSync] 📥 Sales cập nhật từ cloud:', data.length, 'items');
        }
      })
    );

    // Listener: Expenses
    unsubscribes.push(
      listenFirebase<Expense[]>('expenses', (data) => {
        if (data && Array.isArray(data) && !isLocalPushInProgress('expenses')) {
          markFirebaseUpdate('expenses');
          setExpenses(data);
          localStorage.setItem('silence_prod_expenses', JSON.stringify(data));
          console.log('[FirebaseSync] 📥 Expenses cập nhật từ cloud:', data.length, 'items');
        }
      })
    );

    // Listener: Actual Revenues
    unsubscribes.push(
      listenFirebase<ActualRevenue[]>('actualRevenues', (data) => {
        if (data && Array.isArray(data) && !isLocalPushInProgress('actualRevenues')) {
          markFirebaseUpdate('actualRevenues');
          setActualRevenues(data);
          localStorage.setItem('silence_actual_revenues', JSON.stringify(data));
          console.log('[FirebaseSync] 📥 ActualRevenues cập nhật từ cloud:', data.length, 'items');
        }
      })
    );

    // Listener: Users
    unsubscribes.push(
      listenFirebase<UserWithPassword[]>('users', (data) => {
        if (data && Array.isArray(data)) {
          markFirebaseUpdate('users');
          setUsers(data);
          localStorage.setItem('silence_prod_users', JSON.stringify(data));
          console.log('[FirebaseSync] 📥 Users cập nhật từ cloud:', data.length, 'items');
        }
      })
    );

    // Listener: Action Logs
    unsubscribes.push(
      listenFirebase<ActionLog[]>('actionLogs', (data) => {
        if (data && Array.isArray(data)) {
          markFirebaseUpdate('actionLogs');
          setActionLogs(data);
          localStorage.setItem('silence_action_logs', JSON.stringify(data));
          console.log('[FirebaseSync] 📥 ActionLogs cập nhật từ cloud:', data.length, 'items');
        }
      })
    );

    // Cleanup khi unmount
    return () => {
      unsubStatus();
      cleanupSync(unsubscribes);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================
  // Save changes helper — dual write: LocalStorage + Firebase
  // ============================

  /** Map LocalStorage key → Firebase path */
  const localKeyToFirebasePath: Record<string, FirebaseDataPath> = {
    silence_prod_products: 'products',
    silence_prod_batches: 'productionBatches',
    silence_prod_sales: 'sales',
    silence_prod_expenses: 'expenses',
    silence_actual_revenues: 'actualRevenues',
    silence_prod_users: 'users',
    silence_action_logs: 'actionLogs',
  };

  const saveToLocal = (key: string, data: unknown) => {
    localStorage.setItem(key, JSON.stringify(data));

    // Dual-write: Cũng đẩy lên Firebase nếu đã kết nối
    const fbPath = localKeyToFirebasePath[key];
    if (fbPath && !firebaseUpdateInProgress.current[fbPath]) {
      pushToFirebase(fbPath, data, user?.username || 'system');
    }
  };

  const getLatestUser = (): { username: string; name: string } => {
    try {
      const savedUser = localStorage.getItem('silence_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return { username: parsed.username, name: parsed.name };
      }
    } catch (e) {
      console.error('Failed to get latest user:', e);
    }
    return { username: 'Khách', name: 'Chưa đăng nhập' };
  };

  const createAndSaveActionLog = (action: string, details: string, category: ActionLogCategory) => {
    const latestUser = getLatestUser();
    const newLog: ActionLog = {
      id: generateId('LOG', 6),
      timestamp: new Date().toISOString(),
      username: latestUser.username,
      userDisplayName: latestUser.name,
      action,
      details,
      category,
    };
    setActionLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 1000);
      localStorage.setItem('silence_action_logs', JSON.stringify(updated));
      return updated;
    });
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
    createAndSaveActionLog('Thêm sản phẩm', `Đã thêm sản phẩm mới: ${product.name} (SKU: ${product.sku.toUpperCase()}) với giá bán ${product.defaultPrice.toLocaleString()}đ và giá vốn ${product.defaultCost.toLocaleString()}đ.`, 'product');
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
      createAndSaveActionLog('Import sản phẩm Excel', `Đã import thành công ${added.length} sản phẩm từ Excel (bỏ qua ${duplicates.length} trùng, ${invalid.length} lỗi).`, 'product');
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
    const productToDelete = products.find((p) => p.sku === sku);
    const updated = products.filter((p) => p.sku !== sku);
    setProducts(updated);
    saveToLocal('silence_prod_products', updated);
    createAndSaveActionLog('Xóa sản phẩm', `Đã xóa sản phẩm: ${productToDelete ? productToDelete.name : sku} (SKU: ${sku}).`, 'product');
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
    const itemsDesc = batch.items.map((i) => `${i.productSku}: ${i.quantity} cái`).join(', ');
    createAndSaveActionLog('Tạo lệnh sản xuất', `Tạo lô sản xuất ${newBatch.id} với hạn hoàn thành ${batch.targetDate}. Sản phẩm: ${itemsDesc}.`, 'production');
  };

  const advanceBatchStage = (batchId: string) => {
    const stages: ProductionStage[] = ['ordered', 'paid', 'shipping', 'producing', 'delivered'];
    let batchIdDesc = '';
    let fromStage = '';
    let toStage = '';

    const updated = productionBatches.map((batch) => {
      if (batch.id !== batchId) return batch;

      const currentIndex = stages.indexOf(batch.currentStage);
      if (currentIndex === -1 || currentIndex === stages.length - 1) return batch;

      const nextStage = stages[currentIndex + 1];
      const isCompleted = nextStage === 'delivered';

      batchIdDesc = batch.id;
      fromStage = batch.currentStage;
      toStage = nextStage;

      return {
        ...batch,
        currentStage: nextStage,
        status: isCompleted ? 'completed' as const : 'running' as const,
      };
    });
    setProductionBatches(updated);
    saveToLocal('silence_prod_batches', updated);
    if (batchIdDesc) {
      createAndSaveActionLog('Cập nhật tiến độ', `Chuyển trạng thái lô ${batchIdDesc} từ "${fromStage}" sang "${toStage}".`, 'production');
    }
  };

  const deleteProductionBatch = (batchId: string) => {
    const updated = productionBatches.filter((b) => b.id !== batchId);
    setProductionBatches(updated);
    saveToLocal('silence_prod_batches', updated);
    createAndSaveActionLog('Xóa lệnh sản xuất', `Đã xóa lô sản xuất: ${batchId}.`, 'production');
  };

  const updateProductionBatch = (
    batchId: string,
    data: { items?: import('../types').ProductionBatchItem[]; targetDate?: string }
  ) => {
    const updated = productionBatches.map((batch) => {
      if (batch.id !== batchId) return batch;

      // Auto-increment deliveryCount khi deliveredQty tăng lên
      const newItems = data.items
        ? data.items.map((newItem) => {
            const oldItem = batch.items.find((i) => i.productSku === newItem.productSku);
            const oldDelivered = oldItem?.deliveredQty ?? 0;
            const newDelivered = newItem.deliveredQty ?? 0;
            const oldCount = oldItem?.deliveryCount ?? 0;
            // Chỉ tăng deliveryCount khi số lượng đã trả thực sự tăng lên
            const deliveryCount = newDelivered > oldDelivered ? oldCount + 1 : oldCount;
            return { ...newItem, deliveryCount };
          })
        : batch.items;

      return {
        ...batch,
        items: newItems,
        ...(data.targetDate ? { targetDate: data.targetDate } : {}),
      };
    });
    setProductionBatches(updated);
    saveToLocal('silence_prod_batches', updated);
    const changedBatch = updated.find((b) => b.id === batchId);
    const itemsDesc = changedBatch?.items.map((i) =>
      `${i.productSku}: SL=${i.quantity}, Đã trả=${i.deliveredQty ?? 0}, Lỗi=${i.defectQty ?? 0}, Lần giao=${i.deliveryCount ?? 0}`
    ).join(', ') ?? '';
    createAndSaveActionLog(
      'Cập nhật lệnh sản xuất',
      `Cập nhật lô ${batchId}: ${itemsDesc}.`,
      'production'
    );
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
    createAndSaveActionLog('Thêm đơn bán lẻ', `Đã ghi nhận đơn hàng ${newSale.id} (SKU: ${saleData.productSku}, SL: ${saleData.quantity}, Đơn giá: ${saleData.discountedPrice?.toLocaleString()}đ).`, 'sale');
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
    createAndSaveActionLog('Ghi nhận chi phí', `Đã ghi nhận chi phí ${newExpense.id} thuộc nhóm "${expenseData.category}" số tiền ${expenseData.amount.toLocaleString()}đ.`, 'expense');
  };

  // ============================
  // Actual Revenue (Tiền thu thực tế)
  // ============================

  const addActualRevenue = (data: Omit<ActualRevenue, 'id'>) => {
    const newRevenue: ActualRevenue = {
      id: generateId('AREV', 5),
      ...data,
    };
    const updated = [newRevenue, ...actualRevenues];
    setActualRevenues(updated);
    saveToLocal('silence_actual_revenues', updated);

    const sourceNames: Record<string, string> = {
      shopee: 'Shopee', tiktok: 'TikTok', offline: 'Offline',
      bank_transfer: 'Chuyển khoản', cash: 'Tiền mặt', other: 'Khác',
    };
    createAndSaveActionLog(
      'Ghi nhận tiền thu',
      `Đã ghi nhận tiền thu thực tế ${newRevenue.id}: ${data.amount.toLocaleString()}đ từ ${sourceNames[data.source] || data.source} ngày ${data.receivedDate}.`,
      'sale'
    );
  };

  const deleteActualRevenue = (id: string) => {
    const updated = actualRevenues.filter((r) => r.id !== id);
    setActualRevenues(updated);
    saveToLocal('silence_actual_revenues', updated);
    createAndSaveActionLog('Xóa tiền thu', `Đã xóa bản ghi tiền thu thực tế: ${id}.`, 'sale');
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
      createAndSaveActionLog('Đồng bộ đơn hàng', `Đồng bộ đơn hàng từ Nhanh.vn: ${logMsg}`, 'sync');
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
      createAndSaveActionLog('Nhận tồn kho', `Đồng bộ và nhận tồn kho từ Nhanh.vn: Đã cập nhật ${updatedCount} sản phẩm, thêm mới ${merged.length - products.length} sản phẩm.`, 'sync');
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
        createAndSaveActionLog('Đẩy tồn kho', `Đã đẩy tồn kho SKU ${sku} (${availableStock} cái) lên Nhanh.vn thành công.`, 'sync');
      } else {
        createAndSaveActionLog('Đẩy tồn kho', `Đẩy tồn kho SKU ${sku} lên Nhanh.vn thất bại.`, 'sync');
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
    createAndSaveActionLog('Đổi chế độ kết nối', `Chuyển sang chế độ kết nối ${mode === 'live' ? 'Live (thực tế)' : 'Sandbox (giả lập)'}.`, 'system');
    // Re-check connection khi đổi mode
    checkConnection();
  };

  // ============================
  // Data Management
  // ============================

  const exportAllDataFn = (): string => {
    return exportData(products, productionBatches, sales, expenses, actualRevenues);
  };

  const importAllData = async (json: string): Promise<{ success: boolean; error?: string }> => {
    const result = parseImportData(json);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const { data } = result;
    const migratedBatches = migrateBatches(data.productionBatches);

    // 1. Lưu trực tiếp vào LocalStorage trước để đề phòng trang bị reload giữa chừng
    localStorage.setItem('silence_prod_products', JSON.stringify(data.products));
    localStorage.setItem('silence_prod_batches', JSON.stringify(migratedBatches));
    localStorage.setItem('silence_prod_sales', JSON.stringify(data.sales));
    localStorage.setItem('silence_prod_expenses', JSON.stringify(data.expenses));

    let arCount = actualRevenues.length;
    if (data.actualRevenues !== undefined) {
      localStorage.setItem('silence_actual_revenues', JSON.stringify(data.actualRevenues));
      arCount = data.actualRevenues.length;
    }

    // 2. Nếu đã kết nối Firebase, thực hiện đẩy toàn bộ dữ liệu trực tiếp và chờ hoàn tất (await)
    if (isFirebaseConfigured()) {
      // Đánh dấu bỏ qua phản hồi (echo)
      markLocalPushInProgress('products');
      markLocalPushInProgress('productionBatches');
      markLocalPushInProgress('sales');
      markLocalPushInProgress('expenses');
      markLocalPushInProgress('actualRevenues');

      const pushSuccess = await pushAllToFirebase({
        products: data.products,
        productionBatches: migratedBatches,
        sales: data.sales,
        expenses: data.expenses,
        actualRevenues: data.actualRevenues !== undefined ? data.actualRevenues : actualRevenues,
        users,
        actionLogs,
      });

      if (!pushSuccess) {
        return { success: false, error: 'Đồng bộ đám mây thất bại. Vui lòng kiểm tra kết nối mạng hoặc phân quyền Firebase.' };
      }
    }

    // 3. Cập nhật state trong React
    setProducts(data.products);
    setProductionBatches(migratedBatches);
    setSales(data.sales);
    setExpenses(data.expenses);
    if (data.actualRevenues !== undefined) {
      setActualRevenues(data.actualRevenues);
    }

    addSyncLog('Hệ thống', 'Import dữ liệu', 'success',
      `Đã import: ${data.products.length} sản phẩm, ${data.productionBatches.length} lô SX, ${data.sales.length} đơn hàng, ${data.expenses.length} chi phí, ${arCount} khoản thu.`);
    createAndSaveActionLog('Import Backup JSON', `Đã khôi phục dữ liệu: ${data.products.length} SP, ${data.productionBatches.length} Lô SX, ${data.sales.length} Đơn, ${data.expenses.length} Chi phí, ${arCount} Thu.`, 'system');

    return { success: true };
  };

  const clearData = () => {
    localStorage.removeItem('silence_prod_products');
    localStorage.removeItem('silence_prod_batches');
    localStorage.removeItem('silence_prod_sales');
    localStorage.removeItem('silence_prod_expenses');
    localStorage.removeItem('silence_prod_users');
    localStorage.removeItem('silence_action_logs');
    localStorage.removeItem('silence_actual_revenues');
    setProducts(defaultProducts);
    setProductionBatches(defaultBatches);
    setSales(defaultSales);
    setExpenses(defaultExpenses);
    setActualRevenues([]);
    setUsers(defaultUsers);
    setActionLogs([]);

    // Log reset action
    const newLog: ActionLog = {
      id: generateId('LOG', 6),
      timestamp: new Date().toISOString(),
      username: 'system',
      userDisplayName: 'Hệ thống',
      action: 'Reset dữ liệu',
      details: 'Khôi phục cài đặt gốc và xóa toàn bộ dữ liệu người dùng.',
      category: 'system',
    };
    setActionLogs([newLog]);
    localStorage.setItem('silence_action_logs', JSON.stringify([newLog]));
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
    createAndSaveActionLog('Tạo tài khoản', `Tạo tài khoản mới: ${newUser.username} (Chức danh: ${newUser.role}) với quyền: ${newUser.allowedPages.join(', ')}.`, 'user_management');
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
    createAndSaveActionLog('Xóa tài khoản', `Xóa tài khoản người dùng: ${usernameClean}.`, 'user_management');
    return { success: true };
  };

  const login = (loggedUser: User) => {
    setUser(loggedUser);
    localStorage.setItem('silence_user', JSON.stringify(loggedUser));
    
    // Log đăng nhập
    const newLog: ActionLog = {
      id: generateId('LOG', 6),
      timestamp: new Date().toISOString(),
      username: loggedUser.username,
      userDisplayName: loggedUser.name,
      action: 'Đăng nhập',
      details: `Đăng nhập thành công với vai trò: ${loggedUser.role}`,
      category: 'auth',
    };
    setActionLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 1000);
      localStorage.setItem('silence_action_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    const latestUser = getLatestUser();
    const newLog: ActionLog = {
      id: generateId('LOG', 6),
      timestamp: new Date().toISOString(),
      username: latestUser.username,
      userDisplayName: latestUser.name,
      action: 'Đăng xuất',
      details: 'Đăng xuất khỏi hệ thống',
      category: 'auth',
    };
    setActionLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 1000);
      localStorage.setItem('silence_action_logs', JSON.stringify(updated));
      return updated;
    });
    setUser(null);
    localStorage.removeItem('silence_user');
  };

  const clearActionLogs = () => {
    setActionLogs([]);
    localStorage.removeItem('silence_action_logs');
    createAndSaveActionLog('Xóa nhật ký', 'Đã xóa toàn bộ nhật ký thao tác trên hệ thống.', 'system');
  };

  // ============================
  // Firebase: Đẩy toàn bộ dữ liệu lên Cloud
  // ============================

  const pushAllDataToCloud = async (): Promise<boolean> => {
    const result = await pushAllToFirebase({
      products,
      productionBatches,
      sales,
      expenses,
      actualRevenues,
      users,
      actionLogs,
    });

    if (result) {
      createAndSaveActionLog(
        'Đẩy dữ liệu lên Cloud',
        `Đã đẩy toàn bộ dữ liệu lên Firebase Cloud thành công: ${products.length} SP, ${productionBatches.length} Lô SX, ${sales.length} Đơn, ${expenses.length} Chi phí.`,
        'sync'
      );
    }

    return result;
  };

  return (
    <AppContext.Provider
      value={{
        products,
        productionBatches,
        sales,
        expenses,
        actualRevenues,
        addProduct,
        bulkAddProducts,
        deleteProduct,
        createProductionBatch,
        advanceBatchStage,
        deleteProductionBatch,
        updateProductionBatch,
        addSale,
        addExpense,
        addActualRevenue,
        deleteActualRevenue,
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
        user,
        login,
        logout,
        actionLogs,
        addActionLog: createAndSaveActionLog,
        clearActionLogs,
        firebaseSyncStatus,
        pushAllDataToCloud,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
