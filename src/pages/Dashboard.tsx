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

  // 7. Calculate stats by product for chart
  const productStats = products.map((prod) => {
    const prodSales = sales.filter((s) => s.productSku === prod.sku);
    const revenue = prodSales.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
    const cogs = prodSales.reduce((sum, s) => sum + s.quantity * prod.defaultCost, 0);
    const profit = revenue - cogs;
    const qtySold = prodSales.reduce((sum, s) => sum + s.quantity, 0);

    return {
      sku: prod.sku,
      name: prod.name,
      revenue,
      cogs,
      profit,
      qtySold,
    };
  });

  // 8. Production stages distribution
  const stageNames: Record<string, string> = {
    cutting: 'Cắt / Nguyên liệu',
    sewing: 'Gia công / May',
    finishing: 'Hoàn thiện',
    qc: 'Kiểm phẩm (QC)',
    ready: 'Đóng gói & Nhập kho',
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
    ...productionBatches.map((b) => ({
      type: 'production',
      title: `Lô sản xuất ${b.id} (${products.find(p => p.sku === b.productSku)?.name || b.productSku})`,
      value: `Công đoạn: ${stageNames[b.currentStage]} (${b.quantity} SP)`,
      date: b.createdAt,
      source: b.status === 'completed' ? 'Hoàn thành' : 'Đang chạy',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="page-container fade-in">
      {/* Top Title Section */}
      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700 }}>Bảng điều khiển tài chính & sản xuất</h2>
          <p style={{ color: '#8191a9', fontSize: '13px' }}>Tổng quan báo cáo lãi lỗ kinh doanh và dòng chảy sản xuất dệt may</p>
        </div>
      </div>

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
        {/* Left Side: Chart */}
        <div className="card" style={{ flex: 2, minWidth: '320px' }}>
          <div className="card-header">
            <h3>Hiệu quả tài chính theo sản phẩm</h3>
            <span style={{ fontSize: '12px', color: '#8191a9', fontWeight: 600 }}>Đơn vị: VND</span>
          </div>

          <div style={styles.chartWrapper}>
            {productStats.length === 0 ? (
              <div style={styles.emptyState}>Chưa có sản phẩm nào trong hệ thống!</div>
            ) : (
              <div style={styles.chartContainer}>
                {productStats.map((stat) => {
                  const maxVal = Math.max(...productStats.map(s => Math.max(s.revenue, s.cogs, s.profit)), 100000);
                  const revHeight = (stat.revenue / maxVal) * 100;
                  const cogsHeight = (stat.cogs / maxVal) * 100;
                  const profitHeight = (Math.max(0, stat.profit) / maxVal) * 100;

                  return (
                    <div key={stat.sku} style={styles.chartBarGroup}>
                      <div style={styles.barVisualsContainer}>
                        {/* Revenue Bar (Navy) */}
                        <div style={styles.barWrapper}>
                          <div style={{ ...styles.bar, height: `${revHeight}%`, backgroundColor: '#091426' }} title={`Doanh thu: ${formatCurrency(stat.revenue)}`}>
                            {stat.revenue > 0 && <span style={styles.barLabel}>{formatCurrency(stat.revenue)}</span>}
                          </div>
                        </div>

                        {/* Cost Bar (Red) */}
                        <div style={styles.barWrapper}>
                          <div style={{ ...styles.bar, height: `${cogsHeight}%`, backgroundColor: '#ba1a1a' }} title={`Giá vốn SX: ${formatCurrency(stat.cogs)}`}>
                            {stat.cogs > 0 && <span style={styles.barLabel}>{formatCurrency(stat.cogs)}</span>}
                          </div>
                        </div>

                        {/* Profit Bar (Sage Green) */}
                        <div style={styles.barWrapper}>
                          <div style={{ ...styles.bar, height: `${profitHeight}%`, backgroundColor: '#006c49' }} title={`Lợi nhuận gộp: ${formatCurrency(stat.profit)}`}>
                            {stat.profit > 0 && <span style={styles.barLabel}>{formatCurrency(stat.profit)}</span>}
                          </div>
                        </div>
                      </div>

                      <div style={styles.barGroupInfo}>
                        <span style={styles.barProductSKU} className="mono">{stat.sku}</span>
                        <span style={styles.barProductName} title={stat.name}>{stat.name}</span>
                        <span style={styles.barProductSold} className="mono">Đã bán: {stat.qtySold} SP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={styles.chartLegend}>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#091426' }}></span>
              <span>Doanh thu</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#ba1a1a' }}></span>
              <span>Giá vốn sản xuất</span>
            </div>
            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#006c49' }}></span>
              <span>Lợi nhuận gộp</span>
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
                  const prod = products.find(p => p.sku === batch.productSku);
                  const stageWidths: Record<string, string> = {
                    cutting: '20%',
                    sewing: '40%',
                    finishing: '60%',
                    qc: '80%',
                  };

                  return (
                    <div key={batch.id} style={styles.batchCompactCard}>
                      <div style={styles.batchCompactHeader}>
                        <span className="mono" style={styles.batchCompactId}>{batch.id}</span>
                        <span className="badge badge-warning">{stageNames[batch.currentStage]}</span>
                      </div>
                      <div style={styles.batchCompactTitle}>
                        {prod?.name || batch.productSku} ({batch.quantity} sản phẩm)
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
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  dashboardGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '24px',
    alignItems: 'stretch',
  },
  chartWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '260px',
  },
  chartContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '24px',
    width: '100%',
    alignItems: 'end',
    height: '240px',
    paddingTop: '20px',
  },
  chartBarGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barVisualsContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'end',
    height: '140px',
    gap: '4px',
    borderBottom: '2px solid #e0e3e5',
    paddingBottom: '2px',
  },
  barWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    justifyContent: 'flex-end',
    width: '24px',
  },
  bar: {
    width: '100%',
    borderRadius: '2px 2px 0 0',
    position: 'relative' as const,
    transition: 'height 0.3s ease',
    cursor: 'pointer',
    minHeight: '2px',
  },
  barLabel: {
    display: 'none',
  },
  barGroupInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    marginTop: '12px',
    textAlign: 'center' as const,
  },
  barProductSKU: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#091426',
    backgroundColor: '#eceef0',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  barProductName: {
    fontSize: '12px',
    color: '#45474c',
    marginTop: '4px',
    fontWeight: 500,
    width: '100%',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  barProductSold: {
    fontSize: '10px',
    color: '#8191a9',
    marginTop: '2px',
  },
  chartLegend: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#45474c',
    marginTop: '8px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '2px',
    display: 'inline-block',
  },
  emptyState: {
    color: '#8191a9',
    fontSize: '14px',
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
