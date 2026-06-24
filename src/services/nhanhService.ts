/**
 * Service kết nối và đồng bộ API Nhanh.vn (v3.0)
 * Tài liệu: https://open.nhanh.vn/
 * 
 * Hỗ trợ 2 chế độ:
 * - live: Gọi API Nhanh.vn thực tế qua Vite Proxy (dev) hoặc reverse proxy (production)
 * - sandbox: Sử dụng dữ liệu giả lập chuẩn cấu trúc API Nhanh.vn v3.0
 */

import type { NhanhApiMode } from '../types';

// ============================
// Interfaces cho API Response v3.0
// ============================

export interface NhanhProductStock {
  sku: string;
  name: string;
  stock: number;
  price: number;
}

export interface NhanhOrder {
  id: string;
  customerName: string;
  customerMobile: string;
  products: {
    sku: string;
    quantity: number;
    price: number;
  }[];
  createdAt: string;
  status: string;
  /** Nguồn đơn hàng: Shopee, Tiktok, Lên ngoài... */
  salesChannel: string;
}

export interface NhanhConnectionResult {
  connected: boolean;
  mode: NhanhApiMode;
  message: string;
}

// ============================
// Helpers
// ============================

/** Lấy chế độ API hiện tại từ env hoặc localStorage override */
const getApiMode = (): NhanhApiMode => {
  const override = localStorage.getItem('silence_nhanh_api_mode');
  if (override === 'live' || override === 'sandbox') return override;
  return (import.meta.env.VITE_NHANH_API_MODE as NhanhApiMode) || 'sandbox';
};

/** Kiểm tra có đủ credentials không */
const hasCredentials = (): boolean => {
  const appId = localStorage.getItem('silence_nhanh_app_id') || import.meta.env.VITE_NHANH_APP_ID || '';
  const token = localStorage.getItem('silence_nhanh_access_token') || import.meta.env.VITE_NHANH_ACCESS_TOKEN || '';
  const bizId = localStorage.getItem('silence_nhanh_business_id') || import.meta.env.VITE_NHANH_BUSINESS_ID || '';
  return !!(appId && token && bizId);
};

/** Lấy credentials (ưu tiên localStorage, fallback env) */
const getCredentials = () => ({
  appId: localStorage.getItem('silence_nhanh_app_id') || import.meta.env.VITE_NHANH_APP_ID || '',
  accessToken: localStorage.getItem('silence_nhanh_access_token') || import.meta.env.VITE_NHANH_ACCESS_TOKEN || '',
  businessId: localStorage.getItem('silence_nhanh_business_id') || import.meta.env.VITE_NHANH_BUSINESS_ID || '',
});

/**
 * Gửi request đến Nhanh.vn API v3.0 qua proxy
 * Retry 2 lần với exponential backoff khi gặp lỗi mạng
 */
const callNhanhAPI = async (endpoint: string, filters: Record<string, unknown> = {}, retries = 2): Promise<unknown | null> => {
  const { appId, accessToken, businessId } = getCredentials();

  const body = {
    version: '3.0',
    appId,
    businessId,
    accessToken,
    data: JSON.stringify(filters),
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Trong dev: dùng Vite proxy /nhanh-v3/
      // Trong production: cần reverse proxy hoặc backend
      const isProduction = import.meta.env.PROD;
      const baseUrl = isProduction
        ? 'https://pos.open.nhanh.vn'
        : '/nhanh-v3';

      const formData = new FormData();
      Object.entries(body).forEach(([key, val]) => {
        formData.append(key, String(val));
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      if (response.status === 403) {
        console.error('[Nhanh.vn] ERR_403: Thiếu quyền truy cập. Kiểm tra lại permissions trên open.nhanh.vn.');
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 500; // 500ms, 1000ms
        console.warn(`[Nhanh.vn] Retry ${attempt + 1}/${retries} sau ${delay}ms...`, error);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.warn('[Nhanh.vn] Không thể kết nối API sau ' + (retries + 1) + ' lần thử. Chuyển sang chế độ Sandbox.', error);
        return null;
      }
    }
  }
  return null;
};

// ============================
// Public API
// ============================

/**
 * Kiểm tra kết nối API Nhanh.vn
 */
export const checkNhanhConnection = async (): Promise<NhanhConnectionResult> => {
  const mode = getApiMode();

  if (mode === 'sandbox' || !hasCredentials()) {
    return {
      connected: false,
      mode: 'sandbox',
      message: 'Đang chạy chế độ Sandbox. Cấu hình API key trong Cài đặt để kết nối thực.',
    };
  }

  try {
    // Gửi request nhỏ để test kết nối
    const result = await callNhanhAPI('/v3.0/product/list', { page: 1, icpp: 1 }, 1);
    if (result && typeof result === 'object' && 'code' in (result as Record<string, unknown>)) {
      const code = (result as Record<string, unknown>).code;
      if (code === 1) {
        return { connected: true, mode: 'live', message: 'Kết nối API Nhanh.vn thành công!' };
      }
      return { connected: false, mode: 'live', message: `Lỗi API: code=${code}` };
    }
    return { connected: false, mode: 'sandbox', message: 'Không nhận được phản hồi hợp lệ từ API.' };
  } catch {
    return { connected: false, mode: 'sandbox', message: 'Không thể kết nối đến máy chủ Nhanh.vn.' };
  }
};

/**
 * Lấy danh sách sản phẩm (tồn kho + giá) từ Nhanh.vn
 */
export const fetchNhanhStock = async (): Promise<NhanhProductStock[]> => {
  const mode = getApiMode();

  if (mode === 'live' && hasCredentials()) {
    const result = await callNhanhAPI('/v3.0/product/list', { page: 1, icpp: 200 });

    if (result && typeof result === 'object') {
      const data = result as Record<string, unknown>;
      if (data.code === 1 && data.data) {
        const products = (data.data as Record<string, unknown>).products;
        if (products && typeof products === 'object') {
          return Object.values(products as Record<string, Record<string, unknown>>).map((item) => {
            const inv = item.inventory as Record<string, unknown> | undefined;
            return {
              sku: String(item.code || item.barcode || ''),
              name: String(item.name || ''),
              stock: parseInt(String(inv?.remain || inv?.available || '0')),
              price: parseFloat(String(item.price || '0')),
            };
          });
        }
      }
    }
  }

  // Sandbox: Trả về array rỗng — user sẽ nhập sản phẩm trực tiếp trên web
  console.log('[SANDBOX] fetchNhanhStock — Không có API key, trả về danh sách rỗng.');
  return [];
};

/**
 * Lấy danh sách đơn hàng từ Nhanh.vn
 * Phân loại nguồn: Shopee, Tiktok, Lên ngoài (offline)
 */
export const fetchNhanhOrders = async (fromDate?: string, toDate?: string): Promise<NhanhOrder[]> => {
  const mode = getApiMode();
  const today = new Date().toISOString().split('T')[0];

  if (mode === 'live' && hasCredentials()) {
    const result = await callNhanhAPI('/v3.0/order/list', {
      fromDate: fromDate || today,
      toDate: toDate || today,
    });

    if (result && typeof result === 'object') {
      const data = result as Record<string, unknown>;
      if (data.code === 1 && data.data) {
        const orders = (data.data as Record<string, unknown>).orders;
        if (orders && typeof orders === 'object') {
          return Object.values(orders as Record<string, Record<string, unknown>>).map((item) => ({
            id: String(item.id || ''),
            customerName: String(item.customerName || ''),
            customerMobile: String(item.customerMobile || ''),
            products: Array.isArray(item.products)
              ? item.products.map((p: Record<string, unknown>) => ({
                  sku: String(p.productCode || p.code || ''),
                  quantity: parseInt(String(p.quantity || '1')),
                  price: parseFloat(String(p.price || '0')),
                }))
              : [],
            createdAt: String(item.createdDateTime || item.createdDate || today),
            status: String(item.statusCode || item.status || 'Success'),
            salesChannel: mapNhanhChannel(String(item.fromChannel || item.depotName || '')),
          }));
        }
      }
    }
  }

  // Sandbox: Trả về array rỗng
  console.log('[SANDBOX] fetchNhanhOrders — Không có API key, trả về danh sách rỗng.');
  return [];
};

/**
 * Đẩy số lượng tồn kho lên Nhanh.vn
 */
export const updateNhanhStock = async (sku: string, availableStock: number): Promise<boolean> => {
  const mode = getApiMode();

  if (mode === 'live' && hasCredentials()) {
    const result = await callNhanhAPI('/v3.0/product/update', {
      products: [{ code: sku, inventory: { remain: availableStock } }],
    });

    if (result && typeof result === 'object') {
      const data = result as Record<string, unknown>;
      if (data.code === 1) return true;
    }
    return false;
  }

  // Sandbox
  console.log(`[SANDBOX] updateNhanhStock — Đã giả lập đẩy tồn kho SKU ${sku}: ${availableStock} cái`);
  return true;
};

// ============================
// Channel Mapping
// ============================

/** Map tên kênh bán hàng từ Nhanh.vn sang SaleSource */
const mapNhanhChannel = (channel: string): string => {
  const lower = channel.toLowerCase();
  if (lower.includes('shopee')) return 'shopee';
  if (lower.includes('tiktok') || lower.includes('tik tok')) return 'tiktok';
  if (lower.includes('lazada')) return 'shopee'; // Group with shopee for now
  if (lower.includes('facebook') || lower.includes('fb')) return 'offline';
  if (lower.includes('website') || lower.includes('web')) return 'nhanh_vn';
  // Mặc định: "Lên ngoài" (offline / walk-in)
  return 'offline';
};
