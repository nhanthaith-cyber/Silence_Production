import React, { useMemo, useState } from 'react';
import { useApp } from '../hooks/useApp';
import { formatNumber } from '../utils/formatters';
import {
  TrendingUp, AlertTriangle, CheckCircle2, Package,
  Info, ClipboardCopy, Factory, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type AlertLevel = 'safe' | 'reorder' | 'critical';

interface ForecastRow {
  sku: string;
  name: string;
  dailyVelocity: number;         // units sold per day
  available: number;             // finished stock ready to ship
  inProduction: number;          // stock currently in batches
  totalStock: number;            // available + inProduction
  daysOfCover: number;           // totalStock / dailyVelocity  (Infinity if v=0)
  reorderPoint: number;          // velocity * leadTime + safetyStock
  proposedQty: number;           // amount to order
  alertLevel: AlertLevel;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const alertMeta: Record<AlertLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  safe: {
    label: 'Đủ hàng',
    color: '#006c49',
    bg: '#e6f6ef',
    icon: <CheckCircle2 size={13} />,
  },
  reorder: {
    label: 'Cần gọi hàng',
    color: '#b45309',
    bg: '#fef3c7',
    icon: <AlertTriangle size={13} />,
  },
  critical: {
    label: 'Khẩn cấp',
    color: '#ba1a1a',
    bg: '#ffdad6',
    icon: <AlertTriangle size={13} />,
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const Forecast: React.FC = () => {
  const { products, productionBatches, sales } = useApp();

  // ── Config state ──────────────────────────────────────────────────────────
  const [leadTime, setLeadTime] = useState(25);
  const [safetyStock, setSafetyStock] = useState(20);
  const [coverDays, setCoverDays] = useState(30);
  const [velocityDays, setVelocityDays] = useState(30);
  const [configOpen, setConfigOpen] = useState(false);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  // ── Forecast computation ──────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);

  const forecastRows = useMemo<ForecastRow[]>(() => {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - velocityDays);
    const cutoffISO = cutoff.toISOString().split('T')[0];

    return products.map((prod) => {
      // 1. Daily velocity from recent sales
      const recentQty = sales
        .filter((s) => s.productSku === prod.sku && s.saleDate >= cutoffISO)
        .reduce((sum, s) => sum + s.quantity, 0);
      const dailyVelocity = recentQty / velocityDays;

      // 2. Available stock = completed batches - sold
      const totalProduced = productionBatches
        .filter((b) => b.status === 'completed')
        .reduce((sum, b) => {
          return sum + b.items
            .filter((i) => i.productSku === prod.sku)
            .reduce((s, i) => s + i.quantity, 0);
        }, 0);
      // 2. Available stock = Tồn kho thực tế
      // Ưu tiên dùng số lượng nhanhStock đồng bộ từ Nhanh.vn (nếu có)
      const totalSold = sales
        .filter((s) => s.productSku === prod.sku)
        .reduce((sum, s) => sum + s.quantity, 0);
      const available = prod.nhanhStock !== undefined ? prod.nhanhStock : Math.max(0, totalProduced - totalSold);

      // 3. In-production stock = running batches
      const inProduction = productionBatches
        .filter((b) => b.status === 'running')
        .reduce((sum, b) => {
          return sum + b.items
            .filter((i) => i.productSku === prod.sku)
            .reduce((s, i) => s + i.quantity, 0);
        }, 0);

      const totalStock = available + inProduction;

      // 4. Days of cover
      const daysOfCover = dailyVelocity > 0 ? totalStock / dailyVelocity : Infinity;

      // 5. Reorder point
      const reorderPoint = dailyVelocity * leadTime + safetyStock;

      // 6. Alert level
      let alertLevel: AlertLevel;
      if (dailyVelocity === 0) {
        alertLevel = 'safe'; // no sales history → skip
      } else if (available <= dailyVelocity * 3) {
        alertLevel = 'critical';
      } else if (totalStock < reorderPoint) {
        alertLevel = 'reorder';
      } else {
        alertLevel = 'safe';
      }

      // 7. Proposed quantity
      const proposedQty =
        dailyVelocity > 0 && totalStock < reorderPoint
          ? Math.max(0, Math.ceil(dailyVelocity * coverDays + safetyStock - totalStock))
          : 0;

      return {
        sku: prod.sku,
        name: prod.name,
        dailyVelocity,
        available,
        inProduction,
        totalStock,
        daysOfCover,
        reorderPoint,
        proposedQty,
        alertLevel,
      };
    });
  }, [products, productionBatches, sales, leadTime, safetyStock, coverDays, velocityDays, now]);

  // ── Summary counts ────────────────────────────────────────────────────────
  const criticalCount = forecastRows.filter((r) => r.alertLevel === 'critical').length;
  const reorderCount = forecastRows.filter((r) => r.alertLevel === 'reorder').length;
  const safeCount = forecastRows.filter((r) => r.alertLevel === 'safe').length;
  const totalProposed = forecastRows.reduce((s, r) => s + r.proposedQty, 0);

  // Sort: critical → reorder → safe, then by proposed qty desc
  const sortedRows = [...forecastRows].sort((a, b) => {
    const order: Record<AlertLevel, number> = { critical: 0, reorder: 1, safe: 2 };
    if (order[a.alertLevel] !== order[b.alertLevel])
      return order[a.alertLevel] - order[b.alertLevel];
    return b.proposedQty - a.proposedQty;
  });

  // ── Copy helper ───────────────────────────────────────────────────────────
  const handleCopy = (row: ForecastRow) => {
    const text =
      `Dự kiến gọi hàng - ${row.sku}\n` +
      `Sản phẩm: ${row.name}\n` +
      `Số lượng đề xuất: ${row.proposedQty} cái\n` +
      `Tồn hiện tại: ${row.totalStock} cái (khả dụng: ${row.available}, đang SX: ${row.inProduction})\n` +
      `Tốc độ bán: ${row.dailyVelocity.toFixed(2)} cái/ngày\n` +
      `Ngày tạo: ${now.toLocaleDateString('vi-VN')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSku(row.sku);
      setTimeout(() => setCopiedSku(null), 2000);
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-container fade-in">
      {/* ── Page header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700 }}>
            Dự kiến gọi hàng
          </h2>
          <p style={{ color: '#8191a9', fontSize: '13px', marginTop: '2px' }}>
            Phân tích tốc độ bán và đề xuất số lượng cần sản xuất / đặt hàng để đảm bảo không đứt gãy chuỗi cung ứng
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={styles.updateBadge}>
            <RefreshCw size={11} />
            <span>Cập nhật: {now.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
          </div>
          <button
            id="btn-toggle-config"
            onClick={() => setConfigOpen((v) => !v)}
            className="btn btn-secondary"
            style={{ gap: '6px', fontSize: '13px' }}
          >
            <span>Tham số dự phóng</span>
            {configOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ── Config panel ── */}
      {configOpen && (
        <div className="card" style={{ marginBottom: '20px', animation: 'fadeIn 0.2s ease' }}>
          <div className="card-header">
            <h3>Cấu hình tham số dự phóng</h3>
            <span style={styles.infoChip}>
              <Info size={11} /> Thay đổi sẽ cập nhật bảng dự báo ngay lập tức
            </span>
          </div>
          <div style={styles.configGrid}>
            <ConfigInput
              id="cfg-lead-time"
              label="Thời gian sản xuất (Lead Time)"
              unit="ngày"
              value={leadTime}
              min={1} max={90}
              description="Số ngày từ lúc lên đơn đến khi nhận hàng. Mặc định: 25 ngày."
              onChange={(v) => setLeadTime(clamp(v, 1, 90))}
            />
            <ConfigInput
              id="cfg-safety-stock"
              label="Tồn kho an toàn (Safety Stock)"
              unit="cái"
              value={safetyStock}
              min={0} max={500}
              description="Lượng dự phòng tối thiểu để tránh hết hàng bất ngờ. Mặc định: 20."
              onChange={(v) => setSafetyStock(clamp(v, 0, 500))}
            />
            <ConfigInput
              id="cfg-cover-days"
              label="Số ngày phủ sóng (Cover Days)"
              unit="ngày"
              value={coverDays}
              min={7} max={180}
              description="Sau khi gọi hàng, tồn kho đủ bán trong bao nhiêu ngày. Mặc định: 30."
              onChange={(v) => setCoverDays(clamp(v, 7, 180))}
            />
            <ConfigInput
              id="cfg-velocity-days"
              label="Chu kỳ tính tốc độ bán"
              unit="ngày"
              value={velocityDays}
              min={7} max={90}
              description="Số ngày lịch sử dùng để tính tốc độ bán trung bình. Mặc định: 30."
              onChange={(v) => setVelocityDays(clamp(v, 7, 90))}
            />
          </div>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-label">Tổng sản phẩm theo dõi</div>
          <div className="kpi-value mono" style={{ color: '#091426' }}>{forecastRows.length}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Package size={13} style={{ color: '#091426' }} />
            <span>Mã SKU đang có trong hệ thống</span>
          </div>
        </div>

        <div className="kpi-card" style={{ borderTop: '3px solid #ba1a1a' }}>
          <div className="kpi-label" style={{ color: '#ba1a1a' }}>Khẩn cấp</div>
          <div className="kpi-value mono" style={{ color: '#ba1a1a' }}>{criticalCount}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} style={{ color: '#ba1a1a' }} />
            <span>SKU có nguy cơ hết hàng trong 3 ngày</span>
          </div>
        </div>

        <div className="kpi-card kpi-warning">
          <div className="kpi-label">Cần gọi hàng</div>
          <div className="kpi-value mono" style={{ color: '#b45309' }}>{reorderCount}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} style={{ color: '#b45309' }} />
            <span>SKU dưới mức điểm đặt hàng lại</span>
          </div>
        </div>

        <div className="kpi-card kpi-success">
          <div className="kpi-label">Đủ hàng</div>
          <div className="kpi-value mono" style={{ color: '#006c49' }}>{safeCount}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} style={{ color: '#006c49' }} />
            <span>SKU ở mức an toàn</span>
          </div>
        </div>
      </div>

      {/* ── Summary banner (if any reorders) ── */}
      {totalProposed > 0 && (
        <div style={styles.summaryBanner}>
          <TrendingUp size={16} style={{ flexShrink: 0 }} />
          <span>
            Cần lên kế hoạch sản xuất / gọi hàng tổng cộng{' '}
            <strong className="mono">{formatNumber(totalProposed)}</strong> cái
            cho <strong>{criticalCount + reorderCount}</strong> mã SKU trong {coverDays} ngày tới.
          </span>
        </div>
      )}

      {/* ── Forecast table ── */}
      <div className="card">
        <div className="card-header">
          <h3>Bảng dự kiến gọi hàng chi tiết</h3>
          <span style={{ fontSize: '12px', color: '#8191a9', fontWeight: 600 }}>
            Lead Time: {leadTime} ngày · Safety Stock: {safetyStock} · Cover Days: {coverDays}
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mã SKU</th>
                <th>Tên sản phẩm</th>
                <th style={{ textAlign: 'right' }}>Tốc độ bán</th>
                <th style={{ textAlign: 'right' }}>Khả dụng</th>
                <th style={{ textAlign: 'right' }}>Đang SX</th>
                <th style={{ textAlign: 'right' }}>Tổng tồn</th>
                <th style={{ textAlign: 'right' }}>Còn (~ngày)</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Đề xuất gọi</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: '#8191a9', padding: '40px 24px' }}>
                    Chưa có sản phẩm nào trong hệ thống. Vui lòng thêm sản phẩm vào danh mục trước.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const meta = alertMeta[row.alertLevel];
                  const hasSales = row.dailyVelocity > 0;
                  return (
                    <tr key={row.sku} style={row.alertLevel === 'critical' ? { backgroundColor: '#fff8f7' } : row.alertLevel === 'reorder' ? { backgroundColor: '#fffdf4' } : {}}>
                      <td>
                        <span className="mono" style={{ fontWeight: 700, fontSize: '12px', color: '#091426' }}>
                          {row.sku}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, fontSize: '13px' }}>{row.name}</td>
                      <td style={{ textAlign: 'right' }}>
                        {hasSales ? (
                          <span className="mono" style={{ fontSize: '12px', color: '#45474c' }}>
                            {row.dailyVelocity.toFixed(2)}
                            <span style={{ fontSize: '10px', color: '#8191a9', marginLeft: '3px' }}>c/ngày</span>
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#c4c6cc', fontStyle: 'italic' }}>Chưa có DL</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                          {formatNumber(row.available)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="mono" style={{ fontSize: '13px', color: row.inProduction > 0 ? '#b45309' : '#c4c6cc', fontWeight: row.inProduction > 0 ? 600 : 400 }}>
                          {formatNumber(row.inProduction)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: '#091426' }}>
                          {formatNumber(row.totalStock)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {hasSales ? (
                          <span className="mono" style={{
                            fontSize: '13px', fontWeight: 600,
                            color: row.daysOfCover < leadTime ? '#ba1a1a' : row.daysOfCover < coverDays ? '#b45309' : '#006c49',
                          }}>
                            {row.daysOfCover === Infinity ? '∞' : Math.floor(row.daysOfCover)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#c4c6cc' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                          color: meta.color, backgroundColor: meta.bg,
                        }}>
                          {meta.icon}
                          {!hasSales ? 'Chưa bán' : meta.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {row.proposedQty > 0 ? (
                          <span className="mono" style={{ fontSize: '14px', fontWeight: 700, color: '#ba1a1a' }}>
                            +{formatNumber(row.proposedQty)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#c4c6cc' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {row.proposedQty > 0 && (
                            <>
                              <button
                                id={`btn-copy-${row.sku}`}
                                onClick={() => handleCopy(row)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                                title="Copy thông tin gọi hàng"
                              >
                                {copiedSku === row.sku ? <CheckCircle2 size={11} /> : <ClipboardCopy size={11} />}
                                {copiedSku === row.sku ? 'Đã copy' : 'Copy'}
                              </button>
                              <button
                                id={`btn-production-${row.sku}`}
                                onClick={() => {/* navigate to production page */}}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px', gap: '4px', borderColor: '#006c49', color: '#006c49' }}
                                title="Tạo lệnh sản xuất"
                              >
                                <Factory size={11} />
                                SX
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={styles.legend}>
        <span style={styles.legendTitle}>Chú thích:</span>
        {Object.entries(alertMeta).map(([key, m]) => (
          <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: m.color, backgroundColor: m.bg, padding: '2px 8px', borderRadius: '4px' }}>
            {m.icon} {m.label}
          </span>
        ))}
        <span style={{ fontSize: '11px', color: '#8191a9' }}>
          · Điểm gọi hàng = Tốc độ bán × Lead Time + Safety Stock
          · Số lượng đề xuất = (Tốc độ bán × Cover Days) + Safety Stock − Tổng tồn
        </span>
      </div>
    </div>
  );
};

// ─── Sub-component: ConfigInput ────────────────────────────────────────────────

interface ConfigInputProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  description: string;
  onChange: (v: number) => void;
}

const ConfigInput: React.FC<ConfigInputProps> = ({ id, label, unit, value, min, max, description, onChange }) => (
  <div style={configStyles.item}>
    <div style={configStyles.labelRow}>
      <label htmlFor={id} style={configStyles.label}>{label}</label>
      <span className="mono" style={configStyles.valueDisplay}>{value} {unit}</span>
    </div>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={configStyles.slider}
    />
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={configStyles.numberInput}
    />
    <p style={configStyles.description}>{description}</p>
  </div>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  updateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    color: '#6b91b8',
    backgroundColor: 'rgba(6,14,26,0.04)',
    border: '1px solid rgba(6,14,26,0.08)',
    borderRadius: '20px',
    padding: '4px 10px',
  },
  infoChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#1a56db',
    backgroundColor: '#e8f0fe',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    padding: '4px 0',
  },
  summaryBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '16px',
  },
  legend: {
    marginTop: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  legendTitle: {
    fontSize: '11px',
    color: '#8191a9',
    fontWeight: 600,
  },
};

const configStyles = {
  item: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#45474c',
  },
  valueDisplay: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#091426',
    backgroundColor: '#f0f2f5',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  slider: {
    width: '100%',
    accentColor: '#006c49',
    cursor: 'pointer',
  },
  numberInput: {
    width: '80px',
    border: '1px solid #e0e3e5',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    fontFamily: 'var(--font-mono, monospace)',
    color: '#091426',
    backgroundColor: '#ffffff',
  },
  description: {
    fontSize: '11px',
    color: '#8191a9',
    margin: 0,
    lineHeight: '1.4',
  },
};
