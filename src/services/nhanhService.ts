/**
 * Service kết nối và đồng bộ API Nhanh.vn (v3.0)
 * Tài liệu: https://open.nhanh.vn/
 * 
 * === Quy cách API v3.0 ===
 * - URL: https://pos.open.nhanh.vn/v3.0/{resource}/{action}?appId=...&businessId=...
 * - Header: Authorization: {accessToken}, Content-Type: application/json
 * - Body: JSON { filters: {...}, paginator: { size: N } }
 * 
 * Hỗ trợ 2 chế độ:
 * - live: Gọi API Nhanh.vn thực tế qua Vite Proxy (dev) hoặc CORS proxy (production)
 * - sandbox: Sử dụng dữ liệu giả lập
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
 * Gửi request đến Nhanh.vn API v3.0
 * 
 * Format chuẩn v3.0:
 * - URL: {base}/v3.0/{resource}/{action}?appId=...&businessId=...
 * - Header: Authorization: {accessToken}, Content-Type: application/json
 * - Body: JSON { filters: {...}, paginator: { size: N } }
 * 
 * Retry 2 lần với exponential backoff khi gặp lỗi mạng
 */
const callNhanhAPI = async (
  endpoint: string,
  body: Record<string, unknown> = {},
  retries = 2
): Promise<unknown | null> => {
  const { appId, accessToken, businessId } = getCredentials();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const isProduction = import.meta.env.PROD;

      // Xây dựng URL với appId và businessId trong query string
      const queryParams = `appId=${encodeURIComponent(appId)}&businessId=${encodeURIComponent(businessId)}`;

      let fetchUrl: string;
      if (isProduction) {
        // Production (GitHub Pages): dùng CORS proxy
        const targetUrl = `https://pos.open.nhanh.vn${endpoint}?${queryParams}`;
        fetchUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
      } else {
        // Dev: dùng Vite proxy
        fetchUrl = `/nhanh-v3${endpoint}?${queryParams}`;
      }

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Authorization': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 403) {
        console.error('[Nhanh.vn] ERR_403: Thiếu quyền truy cập. Kiểm tra lại permissions trên open.nhanh.vn.');
        return null;
      }

      if (response.status === 429) {
        console.error('[Nhanh.vn] ERR_429: Vượt quá giới hạn tần suất gọi API.');
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[Nhanh.vn] ${endpoint} =>`, result);
      return result;
    } catch (error) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 500; // 500ms, 1000ms
        console.warn(`[Nhanh.vn] Retry ${attempt + 1}/${retries} sau ${delay}ms...`, error);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.warn('[Nhanh.vn] Không thể kết nối API sau ' + (retries + 1) + ' lần thử.', error);
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
 * Gửi request nhỏ lấy 1 sản phẩm để xác nhận credentials hoạt động
 */
export const checkNhanhConnection = async (): Promise<NhanhConnectionResult> => {
  const mode = getApiMode();
  const creds = hasCredentials();

  console.log('[Nhanh.vn] checkConnection:', { mode, hasCredentials: creds });

  if (mode === 'sandbox') {
    return {
      connected: false,
      mode: 'sandbox',
      message: 'Đang chạy chế độ Sandbox. Chuyển sang Live trong Cài đặt để kết nối thực.',
    };
  }

  if (!creds) {
    const { appId, accessToken, businessId } = getCredentials();
    return {
      connected: false,
      mode: 'sandbox',
      message: `Thiếu credentials: AppID=${appId ? '✓' : '✗'}, BizID=${businessId ? '✓' : '✗'}, Token=${accessToken ? '✓' : '✗'}. Vui lòng điền đầy đủ trong Cài đặt.`,
    };
  }

  try {
    const result = await callNhanhAPI('/v3.0/product/list', {
      filters: {},
      paginator: { size: 1 },
    }, 1);

    if (result && typeof result === 'object') {
      const data = result as Record<string, unknown>;

      // API v3.0 trả về code=1 khi thành công
      if (data.code === 1) {
        return { connected: true, mode: 'live', message: 'Kết nối API Nhanh.vn thành công!' };
      }

      // Trả về lỗi từ API
      const errorMsg = Array.isArray(data.messages) ? data.messages[0] : (data.message || `code=${data.code}`);
      return { connected: false, mode: 'live', message: `Lỗi API Nhanh.vn: ${errorMsg}` };
    }

    return { connected: false, mode: 'sandbox', message: 'Không nhận được phản hồi hợp lệ từ API.' };
  } catch {
    return { connected: false, mode: 'sandbox', message: 'Không thể kết nối đến máy chủ Nhanh.vn.' };
  }
};

/**
 * Lấy danh sách sản phẩm (tồn kho + giá) từ Nhanh.vn
 * API v3.0: POST /v3.0/product/list
 */
export const fetchNhanhStock = async (): Promise<NhanhProductStock[]> => {
  const mode = getApiMode();

  if (mode === 'live' && hasCredentials()) {
    const allProducts: NhanhProductStock[] = [];
    let nextCursor: Record<string, unknown> | null = null;
    let pageCount = 0;
    const maxPages = 30; // Giới hạn tối đa 30 trang (3000 SP)

    do {
      const paginator: Record<string, unknown> = { size: 100 };
      if (nextCursor) {
        paginator.next = nextCursor;
      }

      const result = await callNhanhAPI('/v3.0/product/list', {
        filters: {}, // Lấy tất cả sản phẩm
        paginator,
      });

      if (!result || typeof result !== 'object') {
        throw new Error('Không nhận được dữ liệu phản hồi từ API sản phẩm Nhanh.vn (hoặc lỗi CORS).');
      }

      const data = result as Record<string, unknown>;
      if (data.code !== 1) {
        const errorMsg = Array.isArray(data.messages) ? data.messages[0] : (data.message || `Lỗi code=${data.code}`);
        throw new Error(`API Nhanh.vn trả về lỗi: ${errorMsg}`);
      }

      if (!data.data) {
        throw new Error('Dữ liệu trả về từ API sản phẩm trống.');
      }

      const responseData = data.data;
      let productList: unknown[] = [];

      // Phân tích cú pháp linh hoạt (Array hoặc Object lồng nhau)
      if (Array.isArray(responseData)) {
        productList = responseData;
      } else if (responseData && typeof responseData === 'object') {
        const resObj = responseData as Record<string, unknown>;
        const rawProducts = resObj.products || resObj.inventory;
        if (Array.isArray(rawProducts)) {
          productList = rawProducts;
        } else if (rawProducts && typeof rawProducts === 'object') {
          productList = Object.values(rawProducts as Record<string, Record<string, unknown>>);
        } else {
          // Fallback: Thử lấy trực tiếp values của data object
          productList = Object.values(resObj).filter(val => val && typeof val === 'object' && ('code' in val || 'name' in val || 'id' in val));
        }
      }

      productList.forEach((rawItem: unknown) => {
        if (!rawItem || typeof rawItem !== 'object') return;
        const item = rawItem as Record<string, unknown>;
        const inv = item.inventory as Record<string, unknown> | undefined;
        const priceObj = item.prices as Record<string, unknown> | undefined;

        // Lấy giá bán hỗ trợ nhiều biến thể cấu trúc khác nhau
        const price = parseFloat(
          String(item.price || priceObj?.retail || item.retailPrice || priceObj?.price || '0')
        );

        allProducts.push({
          sku: String(item.code || item.barcode || item.id || '').toUpperCase(),
          name: String(item.name || ''),
          stock: parseInt(String(inv?.remain || inv?.available || item.remain || item.available || '0')),
          price,
        });
      });

      // Xử lý phân trang: kiểm tra paginator.next
      let resPaginator: Record<string, unknown> | undefined;
      if (responseData && typeof responseData === 'object') {
        resPaginator = (responseData as Record<string, unknown>).paginator as Record<string, unknown> | undefined;
      }
      nextCursor = (resPaginator?.next as Record<string, unknown>) || null;
      pageCount++;

    } while (nextCursor && pageCount < maxPages);

    if (allProducts.length > 0) {
      console.log(`[Nhanh.vn] Đã tải ${allProducts.length} sản phẩm từ ${pageCount} trang.`);
      return allProducts;
    }
  }

  // Sandbox: Trả về array rỗng — user sẽ nhập sản phẩm trực tiếp trên web
  console.log('[SANDBOX] fetchNhanhStock — Không có API key, trả về danh sách rỗng.');
  return [];
};

/**
 * Lấy danh sách đơn hàng từ Nhanh.vn
 * API v3.0: POST /v3.0/order/list
 * Phân loại nguồn: Shopee, Tiktok, Lên ngoài (offline)
 * 
 * Lưu ý: API giới hạn lọc trong khoảng 31 ngày.
 * Mặc định đồng bộ đơn hàng trong 7 ngày qua để đảm bảo không bỏ sót đơn.
 */
export const fetchNhanhOrders = async (fromDate?: string, toDate?: string): Promise<NhanhOrder[]> => {
  const mode = getApiMode();

  if (mode === 'live' && hasCredentials()) {
    // Chuyển đổi ngày sang timestamp (giây)
    const now = new Date();
    // Mặc định đồng bộ 7 ngày qua nếu không truyền fromDate
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const defaultStart = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    let createdAtFrom = Math.floor(defaultStart.getTime() / 1000);
    if (fromDate) {
      const d = new Date(fromDate);
      if (!isNaN(d.getTime())) {
        createdAtFrom = Math.floor(d.getTime() / 1000);
      }
    }

    let createdAtTo = Math.floor(todayEnd.getTime() / 1000);
    if (toDate) {
      const d = new Date(toDate + 'T23:59:59');
      if (!isNaN(d.getTime())) {
        createdAtTo = Math.floor(d.getTime() / 1000);
      }
    }

    const allOrders: NhanhOrder[] = [];
    let nextCursor: Record<string, unknown> | null = null;
    let pageCount = 0;
    const maxPages = 10;

    do {
      const paginator: Record<string, unknown> = { size: 100 };
      if (nextCursor) {
        paginator.next = nextCursor;
      }

      const result = await callNhanhAPI('/v3.0/order/list', {
        filters: {
          createdAtFrom,
          createdAtTo,
        },
        paginator,
      });

      if (!result || typeof result !== 'object') {
        throw new Error('Không nhận được dữ liệu phản hồi từ API đơn hàng Nhanh.vn (hoặc lỗi CORS).');
      }

      const data = result as Record<string, unknown>;
      if (data.code !== 1) {
        const errorMsg = Array.isArray(data.messages) ? data.messages[0] : (data.message || `Lỗi code=${data.code}`);
        throw new Error(`API Nhanh.vn trả về lỗi: ${errorMsg}`);
      }

      if (!data.data) {
        throw new Error('Dữ liệu trả về từ API đơn hàng trống.');
      }

      const responseData = data.data;
      let orderList: unknown[] = [];

      // Phân tích cú pháp linh hoạt (Array hoặc Object lồng nhau)
      if (Array.isArray(responseData)) {
        orderList = responseData;
      } else if (responseData && typeof responseData === 'object') {
        const resObj = responseData as Record<string, unknown>;
        const rawOrders = resObj.orders;
        if (Array.isArray(rawOrders)) {
          orderList = rawOrders;
        } else if (rawOrders && typeof rawOrders === 'object') {
          orderList = Object.values(rawOrders as Record<string, Record<string, unknown>>);
        } else {
          // Fallback: Thử lấy trực tiếp values của data object
          orderList = Object.values(resObj).filter(val => val && typeof val === 'object' && ('id' in val || 'customerName' in val));
        }
      }

      orderList.forEach((rawItem: unknown) => {
        if (!rawItem || typeof rawItem !== 'object') return;
        const item = rawItem as Record<string, unknown>;
        const orderProducts = item.products as Record<string, unknown>[] | undefined;
        const productList = Array.isArray(orderProducts)
          ? orderProducts.map((p: Record<string, unknown>) => ({
              sku: String(p.productCode || p.code || p.barcode || '').toUpperCase().trim(),
              quantity: parseInt(String(p.quantity || '1')),
              price: parseFloat(String(p.price || '0')),
            }))
          : [];

        // Lấy tên kênh bán hàng từ đối tượng channel trong v3.0 API
        const channelObj = item.channel as Record<string, unknown> | undefined;
        const channelName = String(
          channelObj?.sourceName ||
          channelObj?.name ||
          item.fromChannel ||
          item.depotName ||
          ''
        );

        // Parse ngày tạo đơn hàng an toàn tuyệt đối, tránh lỗi "Invalid time value" RangeError
        let orderDate = new Date().toISOString().split('T')[0];
        const rawDate = item.createdDateTime || item.createdAt || item.created;
        if (rawDate) {
          if (typeof rawDate === 'number') {
            const timestampMs = rawDate < 9999999999 ? rawDate * 1000 : rawDate;
            const d = new Date(timestampMs);
            if (!isNaN(d.getTime())) {
              orderDate = d.toISOString().split('T')[0];
            }
          } else if (typeof rawDate === 'string') {
            if (/^\d+$/.test(rawDate)) {
              const ts = parseInt(rawDate);
              const timestampMs = ts < 9999999999 ? ts * 1000 : ts;
              const d = new Date(timestampMs);
              if (!isNaN(d.getTime())) {
                orderDate = d.toISOString().split('T')[0];
              }
            } else {
              // Parse chuỗi ngày dạng "YYYY-MM-DD HH:mm:ss"
              const d = new Date(rawDate.replace(' ', 'T'));
              if (!isNaN(d.getTime())) {
                orderDate = d.toISOString().split('T')[0];
              }
            }
          }
        }

        allOrders.push({
          id: String(item.id || ''),
          customerName: String(item.customerName || ''),
          customerMobile: String(item.customerMobile || ''),
          products: productList,
          createdAt: orderDate,
          status: String(item.statusCode || item.status || 'Success'),
          salesChannel: mapNhanhChannel(channelName),
        });
      });

      // Phân trang
      let resPaginator: Record<string, unknown> | undefined;
      if (responseData && typeof responseData === 'object') {
        resPaginator = (responseData as Record<string, unknown>).paginator as Record<string, unknown> | undefined;
      }
      nextCursor = (resPaginator?.next as Record<string, unknown>) || null;
      pageCount++;

    } while (nextCursor && pageCount < maxPages);

    if (allOrders.length > 0 || pageCount > 0) {
      console.log(`[Nhanh.vn] Đã tải ${allOrders.length} đơn hàng từ ${pageCount} trang.`);
      return allOrders;
    }
  }

  // Sandbox: Trả về array rỗng
  console.log('[SANDBOX] fetchNhanhOrders — Không có API key, trả về danh sách rỗng.');
  return [];
};

/**
 * Lấy tồn kho riêng biệt từ Nhanh.vn (endpoint chuyên dụng, nhẹ hơn product/list)
 * API v3.0: POST /v3.0/product/inventory
 */
export const fetchNhanhInventory = async (): Promise<NhanhProductStock[]> => {
  const mode = getApiMode();

  if (mode === 'live' && hasCredentials()) {
    const result = await callNhanhAPI('/v3.0/product/inventory', {
      filters: {},
      paginator: { size: 100 },
    });

    if (result && typeof result === 'object') {
      const data = result as Record<string, unknown>;
      if (data.code === 1 && data.data) {
        const responseData = data.data as Record<string, unknown>;
        const inventory = responseData.inventory || responseData.products;

        if (inventory && typeof inventory === 'object') {
          const items = Array.isArray(inventory)
            ? inventory
            : Object.values(inventory as Record<string, Record<string, unknown>>);

          return items.map((item: Record<string, unknown>) => ({
            sku: String(item.code || item.barcode || item.productId || ''),
            name: String(item.name || ''),
            stock: parseInt(String(item.remain || item.available || '0')),
            price: parseFloat(String(item.price || '0')),
          }));
        }
      }
    }
  }

  return [];
};

/**
 * Đẩy số lượng tồn kho lên Nhanh.vn
 * Lưu ý: API v3.0 không hỗ trợ trực tiếp push tồn kho từ bên ngoài.
 * Nhanh.vn khuyến nghị dùng Webhooks để đồng bộ ngược.
 * Hàm này giữ lại để tương thích với giao diện hiện tại.
 */
export const updateNhanhStock = async (sku: string, availableStock: number): Promise<boolean> => {
  const mode = getApiMode();

  if (mode === 'live' && hasCredentials()) {
    // Thử gọi endpoint cập nhật sản phẩm (nếu app có quyền updateProduct)
    const result = await callNhanhAPI('/v3.0/product/update', {
      products: [{ code: sku, inventory: { remain: availableStock } }],
    });

    if (result && typeof result === 'object') {
      const data = result as Record<string, unknown>;
      if (data.code === 1) return true;
      console.warn('[Nhanh.vn] updateNhanhStock failed:', data);
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
  if (lower.includes('tiktok') || lower.includes('tik tok') || lower.includes('tik_tok')) return 'tiktok';
  if (lower.includes('lazada')) return 'shopee'; // Nhóm tạm vào shopee theo logic có sẵn
  if (lower.includes('facebook') || lower.includes('fb') || lower.includes('pos') || lower.includes('offline') || lower.includes('lẻ')) return 'offline';
  if (lower.includes('website') || lower.includes('web') || lower.includes('nhanh')) return 'nhanh_vn';
  // Mặc định: "Lên ngoài" (offline / walk-in)
  return 'offline';
};
