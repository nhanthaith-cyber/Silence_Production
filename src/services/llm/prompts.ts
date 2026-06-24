import type { Product, ProductionBatch, Sale, Expense } from '../../types';

/**
 * Xây dựng prompt phân tích nghiệp vụ cho Silence Production.
 * Inject toàn bộ dữ liệu thực vào context để AI trả lời chính xác.
 */
export const buildProductionPrompt = (
  products: Product[],
  batches: ProductionBatch[],
  sales: Sale[],
  expenses: Expense[],
  userQuestion: string
): string => {
  const totalRevenue = sales.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const runningBatches = batches.filter(b => b.status === 'running');
  const completedBatches = batches.filter(b => b.status === 'completed');

  // Tính tồn kho theo từng SKU
  const stockMap = products.map(p => {
    const produced = batches
      .filter(b => b.productSku === p.sku && b.status === 'completed')
      .reduce((s, b) => s + b.quantity, 0);
    const sold = sales
      .filter(s => s.productSku === p.sku)
      .reduce((s, sl) => s + sl.quantity, 0);
    const available = produced - sold;
    const revenue = sales
      .filter(s => s.productSku === p.sku)
      .reduce((s, sl) => s + sl.quantity * sl.unitPrice, 0);
    const cogs = sales
      .filter(s => s.productSku === p.sku)
      .reduce((s, sl) => s + sl.quantity * p.defaultCost, 0);
    return { ...p, available, revenue, profit: revenue - cogs };
  });

  return `Bạn là trợ lý AI thông minh cho xưởng sản xuất thời trang "Silence Production" tại Việt Nam.
Nhiệm vụ: phân tích dữ liệu nghiệp vụ và tư vấn chủ xưởng.
Yêu cầu: trả lời bằng tiếng Việt, ngắn gọn súc tích, dùng số liệu cụ thể từ dữ liệu bên dưới.
Nếu câu hỏi không liên quan đến sản xuất/kinh doanh, lịch sự từ chối và gợi ý câu hỏi phù hợp hơn.

════ DỮ LIỆU THỰC TẾ ════

📦 DANH MỤC SẢN PHẨM (${products.length} SKU):
${stockMap.map(p =>
  `  • ${p.sku} — ${p.name}
     Giá vốn: ${p.defaultCost.toLocaleString('vi-VN')}đ | Giá bán: ${p.defaultPrice.toLocaleString('vi-VN')}đ | Biên LN: ${(((p.defaultPrice - p.defaultCost) / p.defaultPrice) * 100).toFixed(1)}%
     Tồn kho khả dụng: ${p.available} SP | Doanh thu: ${p.revenue.toLocaleString('vi-VN')}đ | Lợi nhuận gộp: ${p.profit.toLocaleString('vi-VN')}đ`
).join('\n')}

🏭 SẢN XUẤT:
  Đang chạy: ${runningBatches.length} lô
${runningBatches.map(b => `  • ${b.id}: ${b.productSku} | Công đoạn: ${b.currentStage} | SL: ${b.quantity} | Hạn: ${b.targetDate}`).join('\n') || '  (Không có)'}
  Đã hoàn thành: ${completedBatches.length} lô

💰 TÀI CHÍNH:
  Doanh thu: ${totalRevenue.toLocaleString('vi-VN')}đ
  Chi phí VH: ${totalExpenses.toLocaleString('vi-VN')}đ
  Lợi nhuận ròng: ${netProfit.toLocaleString('vi-VN')}đ
  Tổng đơn hàng: ${sales.length}

════ CÂU HỎI CỦA CHỦ XƯỞNG ════
${userQuestion}`;
};
