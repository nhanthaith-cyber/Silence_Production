/**
 * Mapping & đồng bộ dữ liệu giữa Nhanh.vn và Silence Production
 * Chuyển đổi cấu trúc dữ liệu Nhanh.vn v3.0 → Types nội bộ
 */

import type { Product, Sale, SaleSource } from '../types';
import type { NhanhProductStock, NhanhOrder } from './nhanhService';

/**
 * Chuyển đổi sản phẩm Nhanh.vn → Product nội bộ
 * Giữ nguyên giá vốn hiện tại (defaultCost) vì Nhanh.vn không quản lý giá vốn sản xuất
 */
export const mapNhanhProductToLocal = (
  nhanhProduct: NhanhProductStock,
  existingProduct?: Product
): Product => ({
  sku: nhanhProduct.sku.toUpperCase().trim(),
  name: nhanhProduct.name,
  // Giữ nguyên giá vốn nếu đã có, vì user quản lý giá vốn trực tiếp trên web
  defaultCost: existingProduct?.defaultCost || 0,
  // Cập nhật giá bán từ Nhanh.vn
  defaultPrice: nhanhProduct.price || existingProduct?.defaultPrice || 0,
  nhanhStock: nhanhProduct.stock,
});

/**
 * Chuyển đổi đơn hàng Nhanh.vn → Sale nội bộ
 * Phân loại nguồn: Shopee, Tiktok, Lên ngoài
 */
export const mapNhanhOrderToSale = (nhanhOrder: NhanhOrder): Sale[] => {
  // Tính tổng giá trị đơn từ discountedPrice (ưu tiên) hoặc price
  const calculatedTotal = nhanhOrder.products.reduce(
    (sum, p) => sum + (p.discountedPrice ?? p.price) * p.quantity,
    0
  );
  const totalOrderValue = nhanhOrder.totalPrice ?? calculatedTotal;

  return nhanhOrder.products.map((p, index) => ({
    id: `${nhanhOrder.id}${index > 0 ? `-${index}` : ''}`,
    orderId: String(nhanhOrder.id),
    productSku: p.sku.toUpperCase().trim(),
    quantity: p.quantity,
    unitPrice: p.price,
    discountedPrice: p.discountedPrice ?? p.price,
    totalOrderValue,
    platformFee: nhanhOrder.platformFee ?? 0,
    orderStatus: nhanhOrder.status,
    saleDate: nhanhOrder.createdAt.split(' ')[0] || new Date().toISOString().split('T')[0],
    source: mapChannelToSource(nhanhOrder.salesChannel),
  }));
};


/**
 * Map salesChannel string → SaleSource type
 */
const mapChannelToSource = (channel: string): SaleSource => {
  switch (channel) {
    case 'shopee': return 'shopee';
    case 'tiktok': return 'tiktok';
    case 'offline': return 'offline';
    case 'nhanh_vn': return 'nhanh_vn';
    default: return 'offline';
  }
};

/**
 * So sánh danh sách sản phẩm từ Nhanh.vn với danh sách nội bộ
 * Trả về diff: sản phẩm mới, cập nhật, và chỉ có ở local
 */
export const calculateSyncDiff = (
  nhanhProducts: NhanhProductStock[],
  localProducts: Product[]
) => {
  const newProducts: NhanhProductStock[] = [];
  const updatedProducts: { nhanh: NhanhProductStock; local: Product }[] = [];
  const localOnly: Product[] = [];

  // Tìm sản phẩm mới và cần cập nhật
  nhanhProducts.forEach((np) => {
    const existing = localProducts.find(
      (lp) => lp.sku.toUpperCase().trim() === np.sku.toUpperCase().trim()
    );
    if (!existing) {
      newProducts.push(np);
    } else if (existing.defaultPrice !== np.price || existing.name !== np.name || existing.nhanhStock !== np.stock) {
      updatedProducts.push({ nhanh: np, local: existing });
    }
  });

  // Tìm sản phẩm chỉ có ở local (không có trên Nhanh.vn)
  localProducts.forEach((lp) => {
    const onNhanh = nhanhProducts.find(
      (np) => np.sku.toUpperCase().trim() === lp.sku.toUpperCase().trim()
    );
    if (!onNhanh) {
      localOnly.push(lp);
    }
  });

  return { newProducts, updatedProducts, localOnly };
};

/**
 * Merge dữ liệu sản phẩm: giữ giá vốn từ local, cập nhật tên + giá bán + tồn kho từ Nhanh.vn
 */
export const mergeProductData = (
  nhanhProducts: NhanhProductStock[],
  localProducts: Product[]
): Product[] => {
  const merged: Product[] = [];

  // Cập nhật các sản phẩm đã có bằng dữ liệu Nhanh.vn
  localProducts.forEach((local) => {
    const nhanhMatch = nhanhProducts.find(
      (np) => np.sku.toUpperCase().trim() === local.sku.toUpperCase().trim()
    );
    if (nhanhMatch) {
      merged.push({
        ...local,
        name: nhanhMatch.name || local.name,
        defaultPrice: nhanhMatch.price || local.defaultPrice,
        nhanhStock: nhanhMatch.stock,
        // Giữ nguyên defaultCost — user quản lý trực tiếp
      });
    } else {
      merged.push(local);
    }
  });

  // Thêm sản phẩm mới từ Nhanh.vn chưa có ở local
  nhanhProducts.forEach((np) => {
    const exists = localProducts.find(
      (lp) => lp.sku.toUpperCase().trim() === np.sku.toUpperCase().trim()
    );
    if (!exists) {
      merged.push(mapNhanhProductToLocal(np));
    }
  });

  return merged;
};

/**
 * Lọc đơn hàng mới (chưa tồn tại trong sales hiện tại)
 */
export const filterNewOrders = (nhanhOrders: NhanhOrder[], existingSales: Sale[]): NhanhOrder[] => {
  return nhanhOrders.filter(
    (no) => !existingSales.some((s) => s.id === no.id || s.id === String(no.id))
  );
};
