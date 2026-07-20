/**
 * Firebase Sync Service — Đồng bộ dữ liệu realtime giữa các thiết bị
 *
 * Cung cấp:
 * - pushToFirebase(): Ghi dữ liệu lên Firebase (có debounce)
 * - listenFirebase(): Lắng nghe thay đổi realtime từ Firebase
 * - pushAllToFirebase(): Đẩy toàn bộ dữ liệu local lên Firebase (first-time setup)
 *
 * Tất cả các hàm đều graceful — nếu Firebase chưa config thì bỏ qua, không crash app.
 */

import { ref, set, onValue, type Unsubscribe, type Database } from 'firebase/database';
import { initFirebase, isFirebaseConfigured } from './firebaseConfig';
import type {
  Product, ProductionBatch, Sale, Expense, ActualRevenue, ActionLog,
  UserWithPassword, FirebaseSyncStatus,
} from '../types';

// ============================
// Types
// ============================

/** Dữ liệu lưu trên Firebase — tương đương toàn bộ state của app */
export interface FirebaseData {
  products: Product[];
  productionBatches: ProductionBatch[];
  sales: Sale[];
  expenses: Expense[];
  actualRevenues: ActualRevenue[];
  users: UserWithPassword[];
  actionLogs: ActionLog[];
  /** Metadata: timestamp lần cập nhật gần nhất */
  lastUpdated: string;
  /** Metadata: thiết bị nào cập nhật cuối cùng */
  lastUpdatedBy: string;
}

/** Các path dữ liệu trên Firebase */
export type FirebaseDataPath =
  | 'products'
  | 'productionBatches'
  | 'sales'
  | 'expenses'
  | 'actualRevenues'
  | 'users'
  | 'actionLogs';

// ============================
// Debounce Manager
// ============================

/** Quản lý debounce cho từng path riêng biệt — tránh ghi quá nhiều lần */
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const DEBOUNCE_MS = 500; // Chờ 500ms sau lần thay đổi cuối cùng mới ghi lên Firebase

/**
 * Các path đang được push từ local client này.
 * Firebase listener sẽ bỏ qua echo khi path này được đánh dấu.
 */
const localPushInProgress: Record<string, boolean> = {};
const LOCAL_PUSH_SUPPRESS_MS = 3000; // Chặn echo trong 3 giây sau mỗi lần push

/**
 * Kiểm tra xem path này có đang được push từ local không.
 * AppContext dùng hàm này để quyết định có nên bỏ qua Firebase listener callback hay không.
 */
export const isLocalPushInProgress = (path: string): boolean => !!localPushInProgress[path];

// ============================
// Core Functions
// ============================

let db: Database | null = null;
let currentStatus: FirebaseSyncStatus = 'disabled';
let statusListeners: Array<(status: FirebaseSyncStatus) => void> = [];

/** Cập nhật trạng thái sync và thông báo cho listeners */
const setStatus = (newStatus: FirebaseSyncStatus) => {
  currentStatus = newStatus;
  statusListeners.forEach((fn) => fn(newStatus));
};

/** Đăng ký listener để theo dõi trạng thái sync */
export const onSyncStatusChange = (callback: (status: FirebaseSyncStatus) => void): (() => void) => {
  statusListeners.push(callback);
  // Gửi trạng thái hiện tại ngay lập tức
  callback(currentStatus);
  return () => {
    statusListeners = statusListeners.filter((fn) => fn !== callback);
  };
};

/** Lấy trạng thái sync hiện tại */
export const getSyncStatus = (): FirebaseSyncStatus => currentStatus;

/**
 * Khởi tạo kết nối Firebase.
 * Trả về true nếu kết nối thành công, false nếu không.
 */
export const initSync = (): boolean => {
  if (!isFirebaseConfigured()) {
    setStatus('disabled');
    return false;
  }

  setStatus('connecting');

  try {
    const result = initFirebase();
    if (!result) {
      setStatus('error');
      return false;
    }

    db = result.database;
    setStatus('connected');
    console.log('[FirebaseSync] ✅ Sẵn sàng đồng bộ realtime.');
    return true;
  } catch (error) {
    console.error('[FirebaseSync] ❌ Lỗi khởi tạo:', error);
    setStatus('error');
    return false;
  }
};

/**
 * Ghi dữ liệu lên Firebase với debounce.
 * Nếu Firebase chưa config → bỏ qua (graceful).
 *
 * @param path - Path trên Firebase (vd: 'products', 'sales')
 * @param data - Dữ liệu cần ghi
 * @param deviceId - ID thiết bị ghi (để tracking)
 */
export const markLocalPushInProgress = (path: FirebaseDataPath): void => {
  localPushInProgress[path] = true;
  const existingSuppress = debounceTimers[`suppress_${path}`];
  if (existingSuppress) clearTimeout(existingSuppress);
  debounceTimers[`suppress_${path}`] = setTimeout(() => {
    localPushInProgress[path] = false;
  }, LOCAL_PUSH_SUPPRESS_MS);
};

/**
 * Loại bỏ các trường undefined trong object trước khi ghi lên Firebase (vì Firebase không hỗ trợ undefined)
 */
const sanitizeForFirebase = <T>(data: T): T => {
  if (data === undefined) return null as unknown as T;
  return JSON.parse(JSON.stringify(data));
};

export const pushToFirebase = (path: FirebaseDataPath, data: unknown, deviceId?: string): void => {
  if (!db) return; // Firebase chưa config → bỏ qua

  // Đánh dấu path này đang được push từ local — listener sẽ bỏ qua echo
  markLocalPushInProgress(path);

  // Clear timer debounce cũ cho path này
  if (debounceTimers[path]) {
    clearTimeout(debounceTimers[path]);
  }

  debounceTimers[path] = setTimeout(async () => {
    try {
      const sanitizedData = sanitizeForFirebase(data);
      const dataRef = ref(db!, `silence_production/${path}`);
      await set(dataRef, sanitizedData);

      // Cập nhật metadata
      const metaRef = ref(db!, 'silence_production/_meta');
      await set(metaRef, {
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: deviceId || 'unknown',
        lastUpdatedPath: path,
      });

      console.log(`[FirebaseSync] ⬆️ Đã đẩy "${path}" lên Firebase (${Array.isArray(sanitizedData) ? (sanitizedData as unknown[]).length + ' items' : 'object'})`);
    } catch (error) {
      console.error(`[FirebaseSync] ❌ Lỗi ghi "${path}":`, error);
      setStatus('error');
    }
  }, DEBOUNCE_MS);
};

/**
 * Đẩy toàn bộ dữ liệu local lên Firebase (dùng cho lần đầu setup hoặc force sync).
 * Không debounce — ghi ngay lập tức.
 */
export const pushAllToFirebase = async (data: {
  products: Product[];
  productionBatches: ProductionBatch[];
  sales: Sale[];
  expenses: Expense[];
  actualRevenues: ActualRevenue[];
  users: UserWithPassword[];
  actionLogs: ActionLog[];
}): Promise<boolean> => {
  if (!db) {
    console.warn('[FirebaseSync] ⚠️ Firebase chưa kết nối, không thể đẩy dữ liệu.');
    return false;
  }

  setStatus('syncing');

  try {
    // Thay vì set() ở root 'silence_production' (gây lỗi Permission Denied nếu rules chỉ cấp cho child nodes)
    // Chúng ta set() từng child node một cách song song qua Promise.all
    const paths: FirebaseDataPath[] = [
      'products',
      'productionBatches',
      'sales',
      'expenses',
      'actualRevenues',
      'users',
      'actionLogs',
    ];

    await Promise.all(
      paths.map(async (path) => {
        const sanitizedData = sanitizeForFirebase(data[path]);
        const dataRef = ref(db!, `silence_production/${path}`);
        await set(dataRef, sanitizedData);
      })
    );

    // Cập nhật metadata
    const metaRef = ref(db!, 'silence_production/_meta');
    await set(metaRef, {
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: 'full_sync',
    });

    console.log('[FirebaseSync] ✅ Đã đẩy toàn bộ dữ liệu lên Firebase thành công.');
    setStatus('connected');
    return true;
  } catch (error) {
    console.error('[FirebaseSync] ❌ Lỗi đẩy dữ liệu:', error);
    setStatus('error');
    return false;
  }
};

/**
 * Lắng nghe thay đổi realtime từ Firebase cho một path cụ thể.
 * Khi có thay đổi từ máy khác → gọi callback với dữ liệu mới.
 *
 * @param path - Path cần lắng nghe
 * @param callback - Hàm xử lý khi có dữ liệu mới
 * @returns Hàm unsubscribe để hủy lắng nghe
 */
export const listenFirebase = <T>(
  path: FirebaseDataPath,
  callback: (data: T | null) => void
): Unsubscribe | null => {
  if (!db) return null;

  try {
    const dataRef = ref(db, `silence_production/${path}`);
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        const data = snapshot.val() as T | null;
        callback(data);
      },
      (error) => {
        console.error(`[FirebaseSync] ❌ Lỗi listener "${path}":`, error);
        setStatus('error');
      }
    );

    console.log(`[FirebaseSync] 👂 Đang lắng nghe thay đổi "${path}" từ Firebase.`);
    return unsubscribe;
  } catch (error) {
    console.error(`[FirebaseSync] ❌ Lỗi tạo listener "${path}":`, error);
    return null;
  }
};

/**
 * Dọn dẹp tài nguyên khi component unmount.
 * Gọi tất cả các unsubscribe và clear debounce timers.
 */
export const cleanupSync = (unsubscribes: Array<Unsubscribe | null>): void => {
  // Clear tất cả debounce timers
  Object.values(debounceTimers).forEach((timer) => clearTimeout(timer));

  // Unsubscribe tất cả listeners
  unsubscribes.forEach((unsub) => {
    if (unsub) unsub();
  });

  console.log('[FirebaseSync] 🧹 Đã dọn dẹp listeners và timers.');
};
