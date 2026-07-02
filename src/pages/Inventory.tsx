import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { formatNumber } from '../utils/formatters';
import { Boxes, PackagePlus, ShoppingBag, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export const Inventory: React.FC = () => {
  const { products, productionBatches, sales, syncStockFromNhanh, syncStockToNhanh } = useApp();
  const [isSyncing, setIsSyncing] = useState(false);



  // Calculate inventory metrics by product
  const inventoryData = products.map((prod) => {
    // 1. In Production = Running batches quantity
    const inProduction = productionBatches
      .filter((b) => b.status === 'running')
      .reduce((sum, b) => {
        const itemQty = b.items.filter((i) => i.productSku === prod.sku).reduce((s, i) => s + i.quantity, 0);
        return sum + itemQty;
      }, 0);

    // 2. Ready (total produced) = Completed batches quantity
    const totalProduced = productionBatches
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => {
        const itemQty = b.items.filter((i) => i.productSku === prod.sku).reduce((s, i) => s + i.quantity, 0);
        return sum + itemQty;
      }, 0);

    // 3. Sold = Sales quantity
    const sold = sales
      .filter((s) => s.productSku === prod.sku)
      .reduce((sum, s) => sum + s.quantity, 0);

    // 4. Available = Tồn kho thực tế
    // Ưu tiên dùng số lượng nhanhStock đồng bộ từ Nhanh.vn (nếu có).
    // Nếu chưa đồng bộ, dùng công thức nội bộ = Tổng sản xuất xong - Đã bán lẻ.
    const available = prod.nhanhStock !== undefined ? prod.nhanhStock : (totalProduced - sold);

    return {
      sku: prod.sku,
      name: prod.name,
      inProduction,
      sold,
      available,
      isLowStock: available < 20,
    };
  });

  // Calculate totals
  const totalAvailable = inventoryData.reduce((sum, d) => sum + d.available, 0);
  const totalInProduction = inventoryData.reduce((sum, d) => sum + d.inProduction, 0);
  const totalSold = inventoryData.reduce((sum, d) => sum + d.sold, 0);

  return (
    <div className="page-container fade-in">
      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700 }}>Quản lý tồn kho chuyên sâu</h2>
          <p style={{ color: '#8191a9', fontSize: '13px' }}>Giám sát trạng thái tồn kho thực tế, số lượng đang sản xuất tại xưởng và cảnh báo nhập hàng</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={async () => {
              setIsSyncing(true);
              const count = await syncStockFromNhanh();
              setIsSyncing(false);
              alert(`Nhận tồn từ Nhanh.vn thành công! Cập nhật ${count} sản phẩm.`);
            }}
            disabled={isSyncing}
            className="btn btn-secondary"
            style={{ gap: '6px', display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={14} className={isSyncing ? 'spin-anim' : ''} />
            <span>Nhận tồn từ Nhanh.vn</span>
          </button>
          <button
            onClick={async () => {
              setIsSyncing(true);
              let successCount = 0;
              for (const prod of products) {
                const ok = await syncStockToNhanh(prod.sku);
                if (ok) successCount++;
              }
              setIsSyncing(false);
              alert(`Đã đẩy tồn kho xưởng lên Nhanh.vn cho ${successCount}/${products.length} sản phẩm thành công.`);
            }}
            disabled={isSyncing}
            className="btn btn-primary"
            style={{ gap: '6px', display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={14} className={isSyncing ? 'spin-anim' : ''} />
            <span>Đẩy tất cả tồn lên Nhanh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Tồn kho khả dụng</div>
          <div className="kpi-value mono" style={{ color: '#091426' }}>{formatNumber(totalAvailable)}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Boxes size={14} style={{ color: '#091426' }} />
            <span>Thành phẩm đã hoàn thành, sẵn sàng bán</span>
          </div>
        </div>

        <div className="kpi-card kpi-warning">
          <div className="kpi-label">Số lượng đang sản xuất</div>
          <div className="kpi-value mono" style={{ color: '#b45309' }}>{formatNumber(totalInProduction)}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <PackagePlus size={14} style={{ color: '#b45309' }} />
            <span>Nằm trong các công đoạn xưởng gia công</span>
          </div>
        </div>

        <div className="kpi-card kpi-success">
          <div className="kpi-label">Tổng sản phẩm đã bán</div>
          <div className="kpi-value mono" style={{ color: '#006c49' }}>{formatNumber(totalSold)}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShoppingBag size={14} style={{ color: '#006c49' }} />
            <span>Đã xuất kho qua các kênh bán hàng</span>
          </div>
        </div>
      </div>

      {/* Inventory Table card */}
      <div className="card">
        <div className="card-header">
          <h3>Chi tiết số lượng tồn kho theo SKU</h3>
          <span style={{ fontSize: '12px', color: '#8191a9', fontWeight: 600 }}>Cảnh báo mức tồn thấp: &lt; 20 SP</span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mã SKU</th>
                <th>Tên Sản Phẩm</th>
                <th style={{ textAlign: 'right' }}>Đang sản xuất</th>
                <th style={{ textAlign: 'right' }}>Khả dụng (Available)</th>
                <th style={{ textAlign: 'right' }}>Đã xuất bán</th>
                <th>Trạng thái tồn</th>
                <th>Đồng bộ Nhanh</th>
              </tr>
            </thead>
            <tbody>
              {inventoryData.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#8191a9', padding: '24px' }}>
                    Chưa có sản phẩm nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                inventoryData.map((data) => (
                  <tr key={data.sku}>
                    <td className="mono" style={{ fontWeight: 600 }}>{data.sku}</td>
                    <td style={{ fontWeight: 500 }}>{data.name}</td>
                    <td className="mono" style={{ textAlign: 'right', color: data.inProduction > 0 ? '#b45309' : '#75777d', fontWeight: data.inProduction > 0 ? 600 : 400 }}>
                      {formatNumber(data.inProduction)}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: data.isLowStock ? '#ba1a1a' : '#091426' }}>
                      {formatNumber(data.available)}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', color: '#75777d' }}>
                      {formatNumber(data.sold)}
                    </td>
                    <td>
                      {data.isLowStock ? (
                        <span className="badge badge-error" style={{ gap: '4px' }}>
                          <AlertTriangle size={10} />
                          Tồn kho thấp
                        </span>
                      ) : (
                        <span className="badge badge-success" style={{ gap: '4px' }}>
                          <CheckCircle2 size={10} />
                          Đủ hàng
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={async () => {
                          const ok = await syncStockToNhanh(data.sku);
                          if (ok) {
                            alert(`Đã đồng bộ đẩy số tồn kho của SKU ${data.sku} lên Nhanh.vn thành công (Số lượng khả dụng: ${data.available} cái).`);
                          } else {
                            alert(`Lỗi khi đẩy tồn kho SKU ${data.sku}`);
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                      >
                        Đẩy tồn
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global CSS spinner for mock sync button */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
};

const styles = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
};
