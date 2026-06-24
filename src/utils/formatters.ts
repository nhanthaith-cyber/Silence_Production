// ============================
// Hàm tiện ích dùng chung (Shared Utilities)
// ============================

/**
 * Định dạng số tiền theo chuẩn VND.
 * Ví dụ: 150000 → "150.000 ₫"
 */
export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
};

/**
 * Định dạng số nguyên với dấu phân cách hàng nghìn.
 * Ví dụ: 8420 → "8.420"
 */
export const formatNumber = (val: number): string => {
  return new Intl.NumberFormat('vi-VN').format(val);
};

/**
 * Sinh mã ID ngẫu nhiên với prefix tùy chỉnh.
 * Ví dụ: generateId('SALE', 5) → "SALE-48291"
 */
export const generateId = (prefix: string, digits: number = 5): string => {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  const rand = Math.floor(Math.random() * (max - min + 1)) + min;
  return `${prefix}-${rand}`;
};

/**
 * Lấy ngày hôm nay theo format YYYY-MM-DD.
 */
export const getTodayISO = (): string => {
  return new Date().toISOString().split('T')[0];
};
