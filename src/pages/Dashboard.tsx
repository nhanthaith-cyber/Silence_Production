import React from 'react';
import { useApp } from '../hooks/useApp';
import { formatCurrency } from '../utils/formatters';
import { TrendingUp, PackageCheck } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { products, productionBatches, sales, expenses } = useApp();



  // 1. Calculate Revenue
  const totalRevenue = sales.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);

  // 2. Calculate COGS (Cost of Goods Sold - Giá vốn hàng bán)
  const totalCOGS = sales.reduce((sum, s) => {
    const prod = products.find((p) => p.sku === s.productSku);
    const costPerUnit = prod ? prod.defaultCost : 0;
    return sum + s.quantity * costPerUnit;
  }, 0);

  // 3. Calculate Operating Expenses (Chi phí vận hành)
  const totalOpExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // 4. Total Cost = COGS + Operating Expenses
  const totalCost = totalCOGS + totalOpExpenses;

  // 5. Net Profit
  const netProfit = totalRevenue - totalCost;

  // 6. Margin
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // 7. Calculate breakdown by revenue source
  const revenueBySource = {
    shopee: sales.filter(s => s.source === 'shopee').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
    tiktok: sales.filter(s => s.source === 'tiktok').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
    offline: sales.filter(s => s.source === 'offline').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
    manual: sales.filter(s => s.source === 'manual').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
    nhanh_vn: sales.filter(s => s.source === 'nhanh_vn').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
  };

  // 8. Calculate breakdown by cost category
  const costByCategory = {
    production: totalCOGS,
    labor: expenses.filter(e => e.category === 'labor').reduce((sum, e) => sum + e.amount, 0),
    rent: expenses.filter(e => e.category === 'rent').reduce((sum, e) => sum + e.amount, 0),
    ads: expenses.filter(e => e.category === 'ads').reduce((sum, e) => sum + e.amount, 0),
    shipping: expenses.filter(e => e.category === 'shipping').reduce((sum, e) => sum + e.amount, 0),
    material: expenses.filter(e => e.category === 'material').reduce((sum, e) => sum + e.amount, 0),
    other: expenses.filter(e => e.category === 'other').reduce((sum, e) => sum + e.amount, 0),
  };

  // 8. Production stages distribution
  const stageNames: Record<string, string> = {
    ordered: 'Đã đặt hàng',
    paid: 'Đã thanh toán',
    shipping: 'Đang vận chuyển',
    producing: 'Đang sản xuất',
    delivered: 'Đã nhập kho',
  };

  const activeBatches = productionBatches.filter((b) => b.status === 'running');
  const recentActivities = [
    ...sales.map((s) => ({
      type: 'sale',
      title: `Bán ${s.quantity} x ${products.find(p => p.sku === s.productSku)?.name || s.productSku}`,
      value: `+${formatCurrency(s.quantity * s.unitPrice)}`,
      date: s.saleDate,
      source: s.source === 'shopee' ? 'Shopee' : s.source === 'tiktok' ? 'TikTok' : s.source === 'offline' ? 'Lên ngoài' : s.source === 'manual' ? 'Nhập tay' : 'Nhanh.vn',
    })),
    ...productionBatches.map((b) => {
      const itemsDesc = b.items.map((i) => {
        const prod = products.find(p => p.sku === i.productSku);
        return `${prod?.name || i.productSku} (x${i.quantity})`;
      }).join(', ');
      const totalQty = b.items.reduce((sum, i) => sum + i.quantity, 0);
      return {
        type: 'production',
        title: `Lô sản xuất ${b.id} (${itemsDesc})`,
        value: `Công đoạn: ${stageNames[b.currentStage] || b.currentStage} (${totalQty} SP)`,
        date: b.createdAt,
        source: b.status === 'completed' ? 'Hoàn thành' : 'Đang chạy',
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="page-container fade-in">
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Doanh thu bán hàng</div>
          <div className="kpi-value mono" style={{ color: '#091426' }}>{formatCurrency(totalRevenue)}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={14} style={{ color: '#006c49' }} />
            <span>Từ các đơn bán lẻ & đối tác đồng bộ</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Tổng chi phí phát sinh</div>
          <div className="kpi-value mono" style={{ color: '#ba1a1a' }}>{formatCurrency(totalCost)}</div>
          <div className="kpi-desc">
            <span>Giá vốn SX: {formatCurrency(totalCOGS)} + Chi phí VH: {formatCurrency(totalOpExpenses)}</span>
          </div>
        </div>

        <div className="kpi-card kpi-success">
          <div className="kpi-label">Lợi nhuận ròng</div>
          <div className={`kpi-value mono ${netProfit >= 0 ? 'color-success' : 'color-danger'}`} style={{ color: netProfit >= 0 ? '#006c49' : '#ba1a1a' }}>
            {formatCurrency(netProfit)}
          </div>
          <div className="kpi-desc">
            <span>Doanh thu trừ tổng chi phí thực tế</span>
          </div>
        </div>

        <div className="kpi-card kpi-warning">
          <div className="kpi-label">Tỷ suất lợi nhuận</div>
          <div className="kpi-value mono" style={{ color: '#b45309' }}>
            {profitMargin.toFixed(1)}%
          </div>
          <div className="kpi-desc">
            <span>Biên lợi nhuận ròng trên doanh thu</span>
          </div>
        </div>
      </div>

      {/* Core Panels Grid */}
      <div style={styles.dashboardGrid}>
        {/* Left Side: P&L Report & Breakdown */}
        <div className="card" style={{ flex: 2, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card-header">
            <h3>Lãi lỗ hiện tại tổng (P&L)</h3>
            <span style={{ fontSize: '12px', color: '#8191a9', fontWeight: 600 }}>Đơn vị: VND</span>
          </div>

          <div style={styles.plContainer}>
            {/* Left: Table */}
            <div style={styles.plTable}>
              <div style={styles.plSectionHeader}>I. TỔNG DOANH THU</div>
              <div style={styles.plTotalRow}>
                <span>Tổng cộng doanh thu</span>
                <span className="mono font-semibold" style={{ color: '#091426' }}>{formatCurrency(totalRevenue)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Kênh Shopee</span>
                <span className="mono">{formatCurrency(revenueBySource.shopee)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Kênh TikTok</span>
                <span className="mono">{formatCurrency(revenueBySource.tiktok)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Offline (Lên ngoài)</span>
                <span className="mono">{formatCurrency(revenueBySource.offline)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Đồng bộ Nhanh.vn</span>
                <span className="mono">{formatCurrency(revenueBySource.nhanh_vn)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Nhập thủ công</span>
                <span className="mono">{formatCurrency(revenueBySource.manual)}</span>
              </div>

              <div style={{ ...styles.plSectionHeader, marginTop: '16px' }}>II. TỔNG CHI PHÍ</div>
              <div style={styles.plTotalRow}>
                <span>Tổng cộng chi phí</span>
                <span className="mono font-semibold" style={{ color: '#ba1a1a' }}>{formatCurrency(totalCost)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Giá vốn sản xuất (COGS)</span>
                <span className="mono">{formatCurrency(costByCategory.production)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Chi phí nhân công</span>
                <span className="mono">{formatCurrency(costByCategory.labor)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Chi phí mặt bằng</span>
                <span className="mono">{formatCurrency(costByCategory.rent)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Chi phí quảng cáo</span>
                <span className="mono">{formatCurrency(costByCategory.ads)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Chi phí vận chuyển</span>
                <span className="mono">{formatCurrency(costByCategory.shipping)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Chi phí nguyên vật liệu</span>
                <span className="mono">{formatCurrency(costByCategory.material)}</span>
              </div>
              <div style={styles.plRow}>
                <span>• Chi phí khác</span>
                <span className="mono">{formatCurrency(costByCategory.other)}</span>
              </div>

              <div style={{ ...styles.plSectionHeader, marginTop: '16px', borderTop: '2px solid #eceef0', paddingTop: '12px' }}>III. KẾT QUẢ KINH DOANH</div>
              <div style={styles.plResultRow}>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>Lợi nhuận ròng</span>
                <span className="mono" style={{ fontSize: '18px', fontWeight: 700, color: netProfit >= 0 ? '#006c49' : '#ba1a1a' }}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
              <div style={styles.plRow}>
                <span>Biên lợi nhuận ròng</span>
                <span className="mono font-semibold" style={{ color: '#b45309' }}>{profitMargin.toFixed(2)}%</span>
              </div>
            </div>

            {/* Right: Visual bars */}
            <div style={styles.plVisuals}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#45474c', marginBottom: '12px' }}>Cấu trúc tài chính</h4>
              
              {/* Revenue breakdown bar */}
              <div style={{ marginBottom: '20px' }}>
                <div style={styles.visualBarLabel}>
                  <span>Cơ cấu doanh thu</span>
                  <span className="mono">{formatCurrency(totalRevenue)}</span>
                </div>
                {totalRevenue === 0 ? (
                  <div style={styles.emptyBar}>Chưa có doanh thu</div>
                ) : (
                  <div style={styles.visualBarContainer}>
                    {Object.entries(revenueBySource).map(([key, val]) => {
                      if (val === 0) return null;
                      const pct = (val / totalRevenue) * 100;
                      const colors: Record<string, string> = {
                        shopee: '#ff5722',
                        tiktok: '#000000',
                        offline: '#091426',
                        nhanh_vn: '#0084ff',
                        manual: '#8191a9',
                      };
                      const names: Record<string, string> = {
                        shopee: 'Shopee',
                        tiktok: 'TikTok',
                        offline: 'Offline',
                        nhanh_vn: 'Nhanh.vn',
                        manual: 'Nhập tay',
                      };
                      return (
                        <div
                          key={key}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: colors[key] || '#cccccc',
                            height: '100%',
                            transition: 'width 0.3s ease',
                          }}
                          title={`${names[key]}: ${pct.toFixed(1)}% (${formatCurrency(val)})`}
                        />
                      );
                    })}
                  </div>
                )}
                {/* Revenue Legend */}
                {totalRevenue > 0 && (
                  <div style={styles.visualLegendGrid}>
                    {Object.entries(revenueBySource).map(([key, val]) => {
                      if (val === 0) return null;
                      const pct = (val / totalRevenue) * 100;
                      const colors: Record<string, string> = {
                        shopee: '#ff5722',
                        tiktok: '#000000',
                        offline: '#091426',
                        nhanh_vn: '#0084ff',
                        manual: '#8191a9',
                      };
                      const names: Record<string, string> = {
                        shopee: 'Shopee',
                        tiktok: 'TikTok',
                        offline: 'Offline',
                        nhanh_vn: 'Nhanh',
                        manual: 'Tay',
                      };
                      return (
                        <div key={key} style={styles.miniLegendItem}>
                          <span style={{ ...styles.legendDot, backgroundColor: colors[key] }} />
                          <span style={{ fontSize: '11px', color: '#45474c' }}>
                            {names[key]} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Expense breakdown bar */}
              <div>
                <div style={styles.visualBarLabel}>
                  <span>Cơ cấu chi phí</span>
                  <span className="mono">{formatCurrency(totalCost)}</span>
                </div>
                {totalCost === 0 ? (
                  <div style={styles.emptyBar}>Chưa có chi phí</div>
                ) : (
                  <div style={styles.visualBarContainer}>
                    {Object.entries(costByCategory).map(([key, val]) => {
                      if (val === 0) return null;
                      const pct = (val / totalCost) * 100;
                      const colors: Record<string, string> = {
                        production: '#ba1a1a', // COGS (Red)
                        labor: '#1976d2',
                        rent: '#9c27b0',
                        ads: '#e91e63',
                        shipping: '#ffeb3b',
                        material: '#4caf50',
                        other: '#9e9e9e',
                      };
                      const names: Record<string, string> = {
                        production: 'Giá vốn SX',
                        labor: 'Nhân công',
                        rent: 'Mặt bằng',
                        ads: 'Quảng cáo',
                        shipping: 'Vận chuyển',
                        material: 'Nguyên vật liệu',
                        other: 'Khác',
                      };
                      return (
                        <div
                          key={key}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: colors[key] || '#cccccc',
                            height: '100%',
                            transition: 'width 0.3s ease',
                          }}
                          title={`${names[key]}: ${pct.toFixed(1)}% (${formatCurrency(val)})`}
                        />
                      );
                    })}
                  </div>
                )}
                {/* Expense Legend */}
                {totalCost > 0 && (
                  <div style={styles.visualLegendGrid}>
                    {Object.entries(costByCategory).map(([key, val]) => {
                      if (val === 0) return null;
                      const pct = (val / totalCost) * 100;
                      const colors: Record<string, string> = {
                        production: '#ba1a1a',
                        labor: '#1976d2',
                        rent: '#9c27b0',
                        ads: '#e91e63',
                        shipping: '#ffeb3b',
                        material: '#4caf50',
                        other: '#9e9e9e',
                      };
                      const names: Record<string, string> = {
                        production: 'Giá vốn',
                        labor: 'Công',
                        rent: 'Mặt bằng',
                        ads: 'QC',
                        shipping: 'Ship',
                        material: 'Vật liệu',
                        other: 'Khác',
                      };
                      return (
                        <div key={key} style={styles.miniLegendItem}>
                          <span style={{ ...styles.legendDot, backgroundColor: colors[key] }} />
                          <span style={{ fontSize: '11px', color: '#45474c' }}>
                            {names[key]} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Production & Activities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minWidth: '300px' }}>
          {/* Active Production Info */}
          <div className="card" style={{ gap: '12px' }}>
            <div className="card-header">
              <h3>Sản xuất đang chạy</h3>
              <span className="badge badge-primary">{activeBatches.length} Lô</span>
            </div>

            {activeBatches.length === 0 ? (
              <div style={styles.noActiveBatches}>
                <PackageCheck size={24} style={{ color: '#8191a9', marginBottom: '8px' }} />
                <span>Không có lô hàng nào đang gia công.</span>
              </div>
            ) : (
              <div style={styles.activeBatchesList}>
                {activeBatches.slice(0, 3).map((batch) => {
                  const stageWidths: Record<string, string> = {
                    ordered: '20%',
                    paid: '40%',
                    shipping: '60%',
                    producing: '80%',
                    delivered: '100%',
                  };
                  const itemsDesc = batch.items.map((i) => {
                    const prod = products.find(p => p.sku === i.productSku);
                    return `${prod?.name || i.productSku} (x${i.quantity})`;
                  }).join(', ');
                  const totalQty = batch.items.reduce((sum, i) => sum + i.quantity, 0);

                  return (
                    <div key={batch.id} style={styles.batchCompactCard}>
                      <div style={styles.batchCompactHeader}>
                        <span className="mono" style={styles.batchCompactId}>{batch.id}</span>
                        <span className="badge badge-warning">{stageNames[batch.currentStage] || batch.currentStage}</span>
                      </div>
                      <div style={styles.batchCompactTitle} title={itemsDesc}>
                        {itemsDesc.length > 50 ? `${itemsDesc.slice(0, 50)}...` : itemsDesc} ({totalQty} sản phẩm)
                      </div>
                      <div style={styles.progressBarBg}>
                        <div style={{ ...styles.progressBarFill, width: stageWidths[batch.currentStage] || '0%' }}></div>
                      </div>
                      <div style={styles.batchCompactFooter}>
                        <span>Hạn hoàn thành:</span>
                        <span className="mono">{batch.targetDate}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Operations */}
          <div className="card" style={{ gap: '12px', flex: 1 }}>
            <div className="card-header">
              <h3>Nhật ký hoạt động</h3>
            </div>

            <div style={styles.activitiesList}>
              {recentActivities.length === 0 ? (
                <div style={styles.emptyActivities}>Chưa có ghi nhận hoạt động nào.</div>
              ) : (
                recentActivities.map((act, index) => (
                  <div key={index} style={styles.activityItem}>
                    <div style={styles.activityDot}></div>
                    <div style={styles.activityContent}>
                      <div style={styles.activityHeader}>
                        <span style={styles.activityTitle}>{act.title}</span>
                        <span style={styles.activityVal} className="mono">{act.value}</span>
                      </div>
                      <div style={styles.activityFooter}>
                        <span>{act.date}</span>
                        <span>•</span>
                        <span>{act.source}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  dashboardGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '24px',
    alignItems: 'stretch',
  },
  plContainer: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '24px',
    flexWrap: 'wrap' as const,
    marginTop: '10px',
    width: '100%',
  },
  plTable: {
    flex: 1.2,
    minWidth: '280px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  plSectionHeader: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#091426',
    borderBottom: '1px solid #eceef0',
    paddingBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  plTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    fontWeight: 600,
    padding: '4px 0',
  },
  plRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#45474c',
    paddingLeft: '10px',
  },
  plResultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
  },
  plVisuals: {
    flex: 0.8,
    minWidth: '220px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #eceef0',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  visualBarLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    fontWeight: 600,
    color: '#45474c',
    marginBottom: '6px',
  },
  visualBarContainer: {
    height: '16px',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    backgroundColor: '#eceef0',
    marginBottom: '8px',
  },
  emptyBar: {
    height: '16px',
    borderRadius: '8px',
    backgroundColor: '#eceef0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    color: '#8191a9',
    marginBottom: '8px',
  },
  visualLegendGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px 12px',
    marginTop: '6px',
  },
  miniLegendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '2px',
    display: 'inline-block',
  },
  noActiveBatches: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    color: '#8191a9',
    fontSize: '13px',
    border: '1px dashed #c5c6cd',
    borderRadius: '6px',
    textAlign: 'center' as const,
  },
  activeBatchesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  batchCompactCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #eceef0',
    borderRadius: '6px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  batchCompactHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchCompactId: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#091426',
  },
  batchCompactTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#45474c',
  },
  progressBarBg: {
    height: '4px',
    backgroundColor: '#e6e8ea',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#006c49',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  batchCompactFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#8191a9',
    fontWeight: 500,
  },
  activitiesList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  emptyActivities: {
    color: '#8191a9',
    fontSize: '13px',
    textAlign: 'center' as const,
    padding: '16px 0',
  },
  activityItem: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  activityDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#091426',
    marginTop: '6px',
  },
  activityContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  activityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#191c1e',
  },
  activityVal: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#091426',
  },
  activityFooter: {
    display: 'flex',
    gap: '8px',
    fontSize: '11px',
    color: '#8191a9',
    marginTop: '2px',
  },
};
