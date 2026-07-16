import React, { useMemo, useState } from 'react';
import { useApp } from '../hooks/useApp';
import { formatNumber, formatCurrency } from '../utils/formatters';
import {
  TrendingUp, AlertTriangle, CheckCircle2,
  Info, ClipboardCopy, ChevronDown, ChevronUp, RefreshCw, FileSpreadsheet,
  DollarSign, Percent, Sparkles, Filter, Settings, Sliders, AlertCircle, HelpCircle
} from 'lucide-react';
import { exportForecastToExcel } from '../services/excelDataService';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area, Line
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type AlertLevel = 'safe' | 'reorder' | 'critical';
type AbcCategory = 'A' | 'B' | 'C';

interface ForecastRow {
  sku: string;
  name: string;
  dailyVelocity: number;         // units sold per day
  available: number;             // finished stock ready to ship
  inProduction: number;          // stock currently in batches
  totalStock: number;            // available + inProduction
  daysOfCover: number;           // totalStock / dailyVelocity  (Infinity if v=0)
  reorderPoint: number;          // velocity * leadTime + safetyStock
  rawProposedQty: number;        // amount to order before MOQ
  proposedQty: number;           // amount to order after MOQ (if enabled)
  alertLevel: AlertLevel;
  abcCategory: AbcCategory;
  moq: number;
  unitCost: number;
  unitPrice: number;
  costToOrder: number;           // proposedQty * unitCost
  expectedRevenue: number;       // proposedQty * unitPrice
  expectedProfit: number;        // expectedRevenue - costToOrder
  actualQty: number;             // quantity allocated (manual override or smart allocation)
  actualCost: number;            // actualQty * unitCost
  actualRevenue: number;         // actualQty * unitPrice
  actualProfit: number;          // actualRevenue - actualCost
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const abcMeta: Record<AbcCategory, { label: string; color: string; bg: string; desc: string }> = {
  A: {
    label: 'Nhóm A (Best-Seller)',
    color: '#ba1a1a',
    bg: '#ffdad6',
    desc: 'Đóng góp 70% doanh thu. Cần cực kỳ ưu tiên, tránh đứt hàng.',
  },
  B: {
    label: 'Nhóm B (Trung bình)',
    color: '#1a56db',
    bg: '#e8f0fe',
    desc: 'Đóng góp 20% doanh thu kế tiếp. Duy trì ở mức ổn định.',
  },
  C: {
    label: 'Nhóm C (Bán chậm)',
    color: '#4b5563',
    bg: '#f3f4f6',
    desc: 'Đóng góp 10% doanh thu cuối. Xoay vòng vốn chậm, hạn chế đọng vốn.',
  },
};

const COLORS_ABC = { A: '#ea580c', B: '#3b82f6', C: '#9ca3af' };

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

  // ── New Financial & MOQ states ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'table' | 'analysis' | 'insights'>('table');
  const [useMoq, setUseMoq] = useState(true);
  const [maxBudget, setMaxBudget] = useState<number>(() => {
    const saved = localStorage.getItem('silence_production_forecast_max_budget');
    return saved ? Number(saved) : 50000000; // default 50 million VND
  });
  const [moqConfig, setMoqConfig] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('silence_production_forecast_moq');
    return saved ? JSON.parse(saved) : {};
  });
  const [manualOverrides, setManualOverrides] = useState<Record<string, number>>({});

  // Filters
  const [filterAlert, setFilterAlert] = useState<string>('all'); // all, critical_reorder, critical, reorder, safe
  const [filterAbc, setFilterAbc] = useState<string>('all'); // all, A, B, C
  const [searchTerm, setSearchTerm] = useState<string>('');

  const now = useMemo(() => new Date(), []);

  // Update budget in localStorage
  const handleUpdateBudget = (val: number) => {
    const budget = Math.max(0, val);
    setMaxBudget(budget);
    localStorage.setItem('silence_production_forecast_max_budget', String(budget));
  };

  // Update MOQ for SKU
  const handleUpdateMoq = (sku: string, val: number) => {
    const moqVal = Math.max(0, val);
    const updated = { ...moqConfig, [sku]: moqVal };
    setMoqConfig(updated);
    localStorage.setItem('silence_production_forecast_moq', JSON.stringify(updated));
  };

  // Update Actual Order Qty
  const handleUpdateActualQty = (sku: string, val: number) => {
    setManualOverrides((prev) => ({
      ...prev,
      [sku]: Math.max(0, val),
    }));
  };

  // ── Forecast & Financial & ABC computation ────────────────────────────────
  const forecastRows = useMemo<ForecastRow[]>(() => {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - velocityDays);
    const cutoffISO = cutoff.toISOString().split('T')[0];

    // 1. Calculate historical revenue per SKU to classify ABC
    const skuRevenues = products.map((prod) => {
      const revenue = sales
        .filter((s) => s.productSku === prod.sku && s.saleDate >= cutoffISO)
        .reduce((sum, s) => sum + s.quantity * (s.discountedPrice ?? s.unitPrice), 0);
      return { sku: prod.sku, revenue };
    });

    const totalPeriodRevenue = skuRevenues.reduce((sum, item) => sum + item.revenue, 0);
    const sortedRevenues = [...skuRevenues].sort((a, b) => b.revenue - a.revenue);

    const abcMap: Record<string, AbcCategory> = {};
    let runningRevenueSum = 0;

    sortedRevenues.forEach((item) => {
      runningRevenueSum += item.revenue;
      const ratio = totalPeriodRevenue > 0 ? runningRevenueSum / totalPeriodRevenue : 1;
      if (item.revenue === 0) {
        abcMap[item.sku] = 'C'; // No sales -> C
      } else if (ratio <= 0.70) {
        abcMap[item.sku] = 'A';
      } else if (ratio <= 0.90) {
        abcMap[item.sku] = 'B';
      } else {
        abcMap[item.sku] = 'C';
      }
    });

    // 2. Build rows
    return products.map((prod) => {
      // 1. Daily velocity from recent sales
      const recentQty = sales
        .filter((s) => s.productSku === prod.sku && s.saleDate >= cutoffISO)
        .reduce((sum, s) => sum + s.quantity, 0);
      const dailyVelocity = recentQty / velocityDays;

      // 2. Available stock
      const totalProduced = productionBatches
        .filter((b) => b.status === 'completed')
        .reduce((sum, b) => {
          return sum + b.items
            .filter((i) => i.productSku === prod.sku)
            .reduce((s, i) => s + i.quantity, 0);
        }, 0);
      const totalSold = sales
        .filter((s) => s.productSku === prod.sku)
        .reduce((sum, s) => sum + s.quantity, 0);
      const available = prod.nhanhStock !== undefined ? prod.nhanhStock : Math.max(0, totalProduced - totalSold);

      // 3. In-production stock
      const inProduction = productionBatches
        .filter((b) => b.status === 'running')
        .reduce((sum, b) => {
          return sum + b.items
            .filter((i) => i.productSku === prod.sku)
            .reduce((s, i) => s + i.quantity, 0);
        }, 0);

      const totalStock = available + inProduction;
      const daysOfCover = dailyVelocity > 0 ? totalStock / dailyVelocity : Infinity;
      const reorderPoint = dailyVelocity * leadTime + safetyStock;

      // Alert level
      let alertLevel: AlertLevel;
      if (dailyVelocity === 0) {
        alertLevel = 'safe';
      } else if (available <= dailyVelocity * 3) {
        alertLevel = 'critical';
      } else if (totalStock < reorderPoint) {
        alertLevel = 'reorder';
      } else {
        alertLevel = 'safe';
      }

      // Proposed Qty (Raw)
      const rawProposedQty =
        dailyVelocity > 0 && totalStock < reorderPoint
          ? Math.max(0, Math.ceil(dailyVelocity * coverDays + safetyStock - totalStock))
          : 0;

      // MOQ
      const moq = moqConfig[prod.sku] !== undefined ? moqConfig[prod.sku] : 50; // default 50 if not set

      // Proposed Qty (After MOQ)
      let proposedQty = rawProposedQty;
      if (useMoq && rawProposedQty > 0 && rawProposedQty < moq) {
        proposedQty = moq;
      }

      // Financials
      const unitCost = prod.defaultCost;
      const unitPrice = prod.defaultPrice;
      const costToOrder = proposedQty * unitCost;
      const expectedRevenue = proposedQty * unitPrice;
      const expectedProfit = expectedRevenue - costToOrder;

      // Actual quantities (with manual overrides)
      const actualQty = manualOverrides[prod.sku] !== undefined ? manualOverrides[prod.sku] : proposedQty;
      const actualCost = actualQty * unitCost;
      const actualRevenue = actualQty * unitPrice;
      const actualProfit = actualRevenue - actualCost;

      return {
        sku: prod.sku,
        name: prod.name,
        dailyVelocity,
        available,
        inProduction,
        totalStock,
        daysOfCover,
        reorderPoint,
        rawProposedQty,
        proposedQty,
        alertLevel,
        abcCategory: abcMap[prod.sku] || 'C',
        moq,
        unitCost,
        unitPrice,
        costToOrder,
        expectedRevenue,
        expectedProfit,
        actualQty,
        actualCost,
        actualRevenue,
        actualProfit,
      };
    });
  }, [products, productionBatches, sales, leadTime, safetyStock, coverDays, velocityDays, now, moqConfig, useMoq, manualOverrides]);

  // ── Smart budget allocation algorithm ──────────────────────────────────────
  const handleApplySmartAllocation = () => {
    const result: Record<string, number> = {};
    // Initialize all to 0
    forecastRows.forEach(r => {
      result[r.sku] = 0;
    });

    // Filter items that actually need order (rawProposedQty > 0)
    const itemsToAlloc = forecastRows
      .filter((r) => r.rawProposedQty > 0)
      .map((r) => {
        // Base quantities to consider
        const moq = moqConfig[r.sku] !== undefined ? moqConfig[r.sku] : 50;
        let baseQty = r.rawProposedQty;
        if (useMoq && r.rawProposedQty < moq) {
          baseQty = moq;
        }

        return {
          sku: r.sku,
          baseQty,
          moq,
          unitCost: r.unitCost,
          unitPrice: r.unitPrice,
          margin: r.unitPrice > 0 ? (r.unitPrice - r.unitCost) / r.unitPrice : 0,
          alertLevel: r.alertLevel,
          abcCategory: r.abcCategory,
          dailyVelocity: r.dailyVelocity
        };
      });

    // Sort by priority:
    // 1. Alert Level: critical -> reorder
    // 2. ABC Category: A -> B -> C
    // 3. Margin: desc
    // 4. Daily Velocity: desc
    itemsToAlloc.sort((a, b) => {
      const alertOrder = { critical: 0, reorder: 1, safe: 2 };
      const alertA = alertOrder[a.alertLevel] ?? 2;
      const alertB = alertOrder[b.alertLevel] ?? 2;
      if (alertA !== alertB) return alertA - alertB;

      const abcOrder = { A: 0, B: 1, C: 2 };
      const abcA = abcOrder[a.abcCategory] ?? 2;
      const abcB = abcOrder[b.abcCategory] ?? 2;
      if (abcA !== abcB) return abcA - abcB;

      if (b.margin !== a.margin) return b.margin - a.margin;
      return b.dailyVelocity - a.dailyVelocity;
    });

    let remainingBudget = maxBudget;
    itemsToAlloc.forEach((item) => {
      const costToBuy = item.baseQty * item.unitCost;
      if (costToBuy <= remainingBudget) {
        result[item.sku] = item.baseQty;
        remainingBudget -= costToBuy;
      } else {
        // Budget not enough for full quantity
        if (useMoq) {
          const costForMoq = item.moq * item.unitCost;
          if (costForMoq <= remainingBudget) {
            // Allocate at least MOQ
            result[item.sku] = item.moq;
            remainingBudget -= costForMoq;
          } else {
            // Cannot even afford MOQ, skip
            result[item.sku] = 0;
          }
        } else {
          // No MOQ, buy as much as remaining budget allows
          const maxPossible = Math.floor(remainingBudget / item.unitCost);
          result[item.sku] = maxPossible;
          remainingBudget -= maxPossible * item.unitCost;
        }
      }
    });

    setManualOverrides(result);
  };

  const handleResetAllocation = () => {
    setManualOverrides({});
  };

  // ── Summary statistics ──────────────────────────────────────────────────
  const criticalCount = forecastRows.filter((r) => r.alertLevel === 'critical').length;
  const reorderCount = forecastRows.filter((r) => r.alertLevel === 'reorder').length;

  // Financial summaries
  const totalProposedCost = forecastRows.reduce((s, r) => s + r.costToOrder, 0);

  const totalActualCost = forecastRows.reduce((s, r) => s + r.actualCost, 0);
  const totalActualRevenue = forecastRows.reduce((s, r) => s + r.actualRevenue, 0);
  const totalActualProfit = forecastRows.reduce((s, r) => s + r.actualProfit, 0);
  const actualRoi = totalActualCost > 0 ? (totalActualProfit / totalActualCost) * 100 : 0;

  // Filtered rows for displaying in table
  const filteredRows = useMemo(() => {
    return forecastRows.filter((row) => {
      // 1. Search term
      const matchesSearch =
        row.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.name.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Alert level filter
      if (filterAlert === 'critical_reorder' && row.alertLevel === 'safe') return false;
      if (filterAlert !== 'all' && filterAlert !== 'critical_reorder' && row.alertLevel !== filterAlert) return false;

      // 3. ABC filter
      if (filterAbc !== 'all' && row.abcCategory !== filterAbc) return false;

      return true;
    }).sort((a, b) => {
      const order: Record<AlertLevel, number> = { critical: 0, reorder: 1, safe: 2 };
      if (order[a.alertLevel] !== order[b.alertLevel])
        return order[a.alertLevel] - order[b.alertLevel];
      return b.proposedQty - a.proposedQty;
    });
  }, [forecastRows, searchTerm, filterAlert, filterAbc]);

  // ── Copy helper ───────────────────────────────────────────────────────────
  const handleCopy = (row: ForecastRow) => {
    const text =
      `Dự kiến gọi hàng - ${row.sku}\n` +
      `Sản phẩm: ${row.name}\n` +
      `Nhóm phân loại: ABC - ${row.abcCategory}\n` +
      `Số lượng đề xuất: ${row.proposedQty} cái\n` +
      `Số lượng đặt thực tế: ${row.actualQty} cái (Chi phí: ${formatCurrency(row.actualCost)})\n` +
      `Tồn hiện tại: ${row.totalStock} cái (Khả dụng: ${row.available}, Đang SX: ${row.inProduction})\n` +
      `Tốc độ bán: ${row.dailyVelocity.toFixed(2)} cái/ngày\n` +
      `Ngày tạo: ${now.toLocaleDateString('vi-VN')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSku(row.sku);
      setTimeout(() => setCopiedSku(null), 2000);
    });
  };

  // Budget progress status & color
  const budgetRatio = maxBudget > 0 ? totalActualCost / maxBudget : 0;
  const budgetBarColor = budgetRatio > 1.0 ? '#ba1a1a' : budgetRatio > 0.8 ? '#f59e0b' : '#006c49';

  // ── Recharts Chart Data Preparations ──────────────────────────────────────
  const chartBudgetVsProfitData = useMemo(() => {
    return [...forecastRows]
      .filter(r => r.actualQty > 0)
      .sort((a, b) => b.actualProfit - a.actualProfit)
      .slice(0, 10)
      .map(r => ({
        name: r.sku,
        'Vốn bỏ ra': r.actualCost,
        'Lợi nhuận gộp': r.actualProfit,
      }));
  }, [forecastRows]);

  const chartAbcAllocationData = useMemo(() => {
    const abcSums = { A: 0, B: 0, C: 0 };
    forecastRows.forEach(r => {
      abcSums[r.abcCategory] += r.actualCost;
    });
    return [
      { name: 'Nhóm A (Best-Seller)', value: abcSums.A },
      { name: 'Nhóm B (Trung bình)', value: abcSums.B },
      { name: 'Nhóm C (Bán chậm)', value: abcSums.C },
    ].filter(item => item.value > 0);
  }, [forecastRows]);

  const chartParetoData = useMemo(() => {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - velocityDays);
    const cutoffISO = cutoff.toISOString().split('T')[0];

    const skuRevenues = products.map((prod) => {
      const revenue = sales
        .filter((s) => s.productSku === prod.sku && s.saleDate >= cutoffISO)
        .reduce((sum, s) => sum + s.quantity * (s.discountedPrice ?? s.unitPrice), 0);
      return { sku: prod.sku, name: prod.name, revenue };
    });

    const totalRev = skuRevenues.reduce((sum, item) => sum + item.revenue, 0);
    const sorted = [...skuRevenues].sort((a, b) => b.revenue - a.revenue);

    let accum = 0;
    return sorted.map(item => {
      accum += item.revenue;
      return {
        sku: item.sku,
        'Doanh thu': item.revenue,
        'Tích lũy %': totalRev > 0 ? Math.round((accum / totalRev) * 100) : 100
      };
    });
  }, [products, sales, velocityDays, now]);

  // ── AI Smart Insights generators ──────────────────────────────────────────
  const salesInsights = useMemo(() => {
    const insights: string[] = [];

    // 1. Check critical Best-Sellers (Group A) without enough capital
    const criticalGroupA = forecastRows.filter(r => r.abcCategory === 'A' && r.alertLevel === 'critical');
    criticalGroupA.forEach(r => {
      if (r.actualQty < r.proposedQty) {
        insights.push(`🔴 **ĐỨT GÃY DOANH THU:** Sản phẩm bán chạy nhất **${r.name} (${r.sku})** đang ở mức **Khẩn cấp** (chỉ còn bán được ~${r.daysOfCover === Infinity ? 0 : Math.floor(r.daysOfCover)} ngày) nhưng chưa được phân bổ đủ vốn đặt hàng đề xuất. Cần thêm ít nhất **${formatCurrency((r.proposedQty - r.actualQty) * r.unitCost)}** để mua đủ lượng hàng cần thiết.`);
      } else {
        insights.push(`🔥 **ƯU TIÊN HÀNG ĐẦU:** Sản phẩm bán chạy nhất **${r.name} (${r.sku})** đang sắp hết hàng. Hãy đảm bảo lệnh sản xuất **${r.actualQty} cái** (vốn **${formatCurrency(r.actualCost)}**) được triển khai ngay lập tức để bảo vệ nguồn doanh thu chính.`);
      }
    });

    // 2. Overstock detection for capital recovery (Group C with high days of cover)
    const overstockedC = forecastRows.filter(r => r.abcCategory === 'C' && r.totalStock > 0 && r.daysOfCover > 90 && r.daysOfCover !== Infinity);
    overstockedC.forEach(r => {
      const excessCost = Math.floor((r.totalStock - (r.dailyVelocity * 60)) * r.unitCost);
      if (excessCost > 1000000) { // only show if tied-up capital > 1 million VND
        insights.push(`💡 **XẢ HÀNG THU HỒI VỐN:** SKU bán chậm **${r.name} (${r.sku})** đang có tồn kho đủ bán trong **${Math.floor(r.daysOfCover)} ngày** (quá dư thừa). Ước tính có khoảng **${formatCurrency(excessCost)}** vốn đang bị đọng ở đây. Đề xuất chạy chương trình **giảm giá 15% - 20%** hoặc đóng gói **combo quà tặng** kèm sản phẩm nhóm A để nhanh chóng giải phóng tồn kho này thành tiền mặt.`);
      }
    });

    // 3. Efficiency Evaluation
    if (totalActualCost > 0) {
      const abcSums = { A: 0, B: 0, C: 0 };
      forecastRows.forEach(r => {
        abcSums[r.abcCategory] += r.actualCost;
      });
      const ratioAB = ((abcSums.A + abcSums.B) / totalActualCost) * 100;
      if (ratioAB >= 80) {
        insights.push(`✅ **ĐÁNH GIÁ DÒNG VỐN:** Bạn đang phân bổ **${ratioAB.toFixed(1)}%** tổng ngân sách vào các sản phẩm bán chạy Nhóm A & B. Đây là chiến lược phân bổ vốn cực kỳ hiệu quả giúp tối ưu hóa tốc độ quay vòng tiền mặt trong thời điểm thiếu vốn.`);
      } else {
        insights.push(`⚠ **ĐÁNH GIÁ DÒNG VỐN:** Bạn đang đổ **${(100 - ratioAB).toFixed(1)}%** vốn vào nhóm C bán chậm. Xem xét giảm số lượng đặt thực tế của các mã nhóm C để dồn ngân sách cho các SKU nhóm A và B nhằm tránh đọng vốn.`);
      }
    }

    return insights;
  }, [forecastRows, totalActualCost]);

  return (
    <div className="page-container fade-in">
      {/* ── Page Header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Dự kiến gọi hàng & Tối ưu hóa vốn
            <span style={{ fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#ba1a1a', color: '#ffffff', textTransform: 'none' }}>
              Bản nâng cấp Tài chính & MOQ
            </span>
          </h2>
          <p style={{ color: '#8191a9', fontSize: '13px', marginTop: '2px' }}>
            Phân tích nhóm ABC, tích hợp MOQ, tính toán dòng vốn bỏ ra và tự động phân bổ ngân sách khả dụng khi thiếu tiền mặt.
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
            <Settings size={14} />
            <span>Cấu hình dự phóng</span>
            {configOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => exportForecastToExcel(filteredRows)}
            className="btn btn-primary"
            style={{ gap: '6px', fontSize: '13px', backgroundColor: '#006c49', borderColor: '#006c49' }}
          >
            <FileSpreadsheet size={14} />
            <span>Xuất báo cáo Excel</span>
          </button>
        </div>
      </div>

      {/* ── Config Panel ── */}
      {configOpen && (
        <div className="card animate-fade-in" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="card-header">
            <h3>Cấu hình tham số dự báo & tài chính</h3>
            <span style={styles.infoChip}>
              <Info size={11} /> Thay đổi sẽ cập nhật bảng và biểu đồ ngay lập tức
            </span>
          </div>
          <div style={styles.configGrid}>
            <div style={styles.configColumn}>
              <h4 style={styles.configSubTitle}>Thông số dự báo</h4>
              <ConfigInput
                id="cfg-lead-time"
                label="Thời gian sản xuất (Lead Time)"
                unit="ngày"
                value={leadTime}
                min={1} max={90}
                description="Số ngày sản xuất và giao hàng. Mặc định: 25 ngày."
                onChange={(v) => setLeadTime(clamp(v, 1, 90))}
              />
              <ConfigInput
                id="cfg-safety-stock"
                label="Tồn kho an toàn (Safety Stock)"
                unit="cái"
                value={safetyStock}
                min={0} max={500}
                description="Hàng dự phòng tối thiểu để tránh hết hàng đột ngột. Mặc định: 20."
                onChange={(v) => setSafetyStock(clamp(v, 0, 500))}
              />
            </div>
            <div style={styles.configColumn}>
              <h4 style={styles.configSubTitle}>Thông số bao phủ & Doanh thu</h4>
              <ConfigInput
                id="cfg-cover-days"
                label="Số ngày phủ sóng (Cover Days)"
                unit="ngày"
                value={coverDays}
                min={7} max={180}
                description="Tồn kho mong muốn đủ bán sau đặt hàng. Mặc định: 30."
                onChange={(v) => setCoverDays(clamp(v, 7, 180))}
              />
              <ConfigInput
                id="cfg-velocity-days"
                label="Chu kỳ tính tốc độ bán"
                unit="ngày"
                value={velocityDays}
                min={7} max={90}
                description="Số ngày lịch sử dùng để tính doanh thu & tốc độ bán. Mặc định: 30."
                onChange={(v) => setVelocityDays(clamp(v, 7, 90))}
              />
            </div>
            <div style={styles.configColumn}>
              <h4 style={styles.configSubTitle}>Quản lý dòng tiền & MOQ</h4>
              <div style={configStyles.item}>
                <div style={configStyles.labelRow}>
                  <label htmlFor="cfg-max-budget" style={configStyles.label}>Ngân sách vốn đặt hàng</label>
                  <span className="mono" style={configStyles.valueDisplay}>{formatCurrency(maxBudget)}</span>
                </div>
                <input
                  id="cfg-max-budget"
                  type="number"
                  step="5000000"
                  value={maxBudget}
                  onChange={(e) => handleUpdateBudget(Number(e.target.value))}
                  style={{ ...configStyles.numberInput, width: '100%' }}
                />
                <p style={configStyles.description}>Vốn khả dụng hiện có để lấy hàng. Dùng để tính toán phân bổ.</p>
              </div>

              <div style={{ ...configStyles.item, marginTop: '14px', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input
                  id="cfg-use-moq"
                  type="checkbox"
                  checked={useMoq}
                  onChange={(e) => setUseMoq(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <div>
                  <label htmlFor="cfg-use-moq" style={{ ...configStyles.label, cursor: 'pointer' }}>Tự động áp dụng MOQ</label>
                  <p style={{ ...configStyles.description, marginTop: '2px' }}>Tự động nâng đề xuất đặt hàng lên MOQ của xưởng.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Budget Status Bar ── */}
      <div className="card" style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#45474c' }}>Trạng thái sử dụng ngân sách:</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: budgetBarColor }}>
              {formatCurrency(totalActualCost)} / {formatCurrency(maxBudget)} ({ (budgetRatio * 100).toFixed(1) }%)
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleApplySmartAllocation}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', borderColor: '#006c49', color: '#006c49', gap: '4px' }}
              title="Phân bổ ngân sách tối ưu cho các sản phẩm khẩn cấp & bán chạy nhất"
            >
              <Sparkles size={13} />
              <span>Phân bổ vốn tối ưu</span>
            </button>
            <button
              onClick={handleResetAllocation}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
            >
              <span>Reset</span>
            </button>
          </div>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, budgetRatio * 100)}%`, height: '100%', backgroundColor: budgetBarColor, transition: 'width 0.3s ease' }}></div>
        </div>
        {budgetRatio > 1.0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ba1a1a', fontSize: '12px', fontWeight: 500, marginTop: '2px' }}>
            <AlertCircle size={14} />
            <span>Ngân sách đặt hàng thực tế đang vượt quá vốn khả dụng là {formatCurrency(totalActualCost - maxBudget)}! Hãy giảm lượng đặt hoặc bấm nút Phân bổ vốn tối ưu.</span>
          </div>
        )}
      </div>

      {/* ── Quick KPI Cards ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Tổng vốn đặt hàng</div>
          <div className="kpi-value mono" style={{ fontSize: '20px' }}>{formatCurrency(totalActualCost)}</div>
          <div className="kpi-desc" style={{ color: '#4b5563' }}>
            Vốn đề xuất thô: <strong className="mono">{formatCurrency(totalProposedCost)}</strong>
          </div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-label" style={{ color: '#006c49' }}>Doanh thu dự kiến</div>
          <div className="kpi-value mono" style={{ color: '#006c49', fontSize: '20px' }}>{formatCurrency(totalActualRevenue)}</div>
          <div className="kpi-desc">Do sản phẩm mang lại khi bán hết</div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-label" style={{ color: '#006c49' }}>Lợi nhuận gộp dự tính</div>
          <div className="kpi-value mono" style={{ color: '#006c49', fontSize: '20px' }}>{formatCurrency(totalActualProfit)}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Percent size={13} style={{ color: '#006c49' }} />
            <span>Tỷ suất lợi nhuận trên vốn (ROI): <strong>{actualRoi.toFixed(1)}%</strong></span>
          </div>
        </div>
        <div className="kpi-card kpi-warning">
          <div className="kpi-label">Trạng thái SKU</div>
          <div className="kpi-value mono" style={{ color: '#b45309', fontSize: '20px' }}>{criticalCount} / {reorderCount}</div>
          <div className="kpi-desc">
            🔴 {criticalCount} Khẩn cấp · 🟡 {reorderCount} Cần đặt
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div style={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('table')}
          style={activeTab === 'table' ? styles.activeTabBtn : styles.inactiveTabBtn}
        >
          <Sliders size={14} />
          Bảng dự báo chi tiết
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          style={activeTab === 'analysis' ? styles.activeTabBtn : styles.inactiveTabBtn}
        >
          <DollarSign size={14} />
          Tối ưu hóa vốn & Phân tích
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          style={activeTab === 'insights' ? styles.activeTabBtn : styles.inactiveTabBtn}
        >
          <Sparkles size={14} />
          Khuyến nghị & Chiến lược bán
        </button>
      </div>

      {/* ── Tab 1: Detailed Table ── */}
      {activeTab === 'table' && (
        <div className="card fade-in">
          {/* Filters & Control bar */}
          <div style={styles.filterBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={styles.filterItem}>
                <Filter size={13} />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Bộ lọc:</span>
              </div>

              <select
                value={filterAlert}
                onChange={(e) => setFilterAlert(e.target.value)}
                style={styles.selectFilter}
              >
                <option value="all">Tất cả trạng thái tồn</option>
                <option value="critical_reorder">🔴 Cần đặt & Khẩn cấp</option>
                <option value="critical">🔴 Khẩn cấp (dưới 3 ngày)</option>
                <option value="reorder">🟡 Cần gọi hàng (dưới ROP)</option>
                <option value="safe">🟢 Đủ hàng (an toàn)</option>
              </select>

              <select
                value={filterAbc}
                onChange={(e) => setFilterAbc(e.target.value)}
                style={styles.selectFilter}
              >
                <option value="all">Tất cả nhóm ABC (Doanh thu)</option>
                <option value="A">Nhóm A (Best-Seller)</option>
                <option value="B">Nhóm B (Trung bình)</option>
                <option value="C">Nhóm C (Bán chậm)</option>
              </select>
            </div>

            <div style={{ width: '240px' }}>
              <input
                type="text"
                placeholder="Tìm SKU hoặc tên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '95px' }}>Mã SKU</th>
                  <th>Tên sản phẩm</th>
                  <th style={{ textAlign: 'center' }}>Nhóm ABC</th>
                  <th style={{ textAlign: 'right' }}>Tốc độ bán</th>
                  <th style={{ textAlign: 'right' }}>Tổng tồn</th>
                  <th style={{ textAlign: 'right' }}>Còn (~ngày)</th>
                  <th style={{ textAlign: 'right', minWidth: '80px' }}>MOQ xưởng</th>
                  <th style={{ textAlign: 'right' }}>Đề xuất</th>
                  <th style={{ textAlign: 'center', minWidth: '100px', backgroundColor: '#e6f6ef' }}>Đặt thực tế</th>
                  <th style={{ textAlign: 'right' }}>Vốn dự tính</th>
                  <th style={{ textAlign: 'right' }}>Lợi nhuận</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', color: '#8191a9', padding: '40px 24px' }}>
                      Không có sản phẩm nào khớp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const abc = abcMeta[row.abcCategory];
                    const hasSales = row.dailyVelocity > 0;

                    return (
                      <tr
                        key={row.sku}
                        style={
                          row.alertLevel === 'critical'
                            ? { backgroundColor: '#fff8f7' }
                            : row.alertLevel === 'reorder'
                            ? { backgroundColor: '#fffdf4' }
                            : {}
                        }
                      >
                        <td>
                          <span className="mono" style={{ fontWeight: 700, fontSize: '12px', color: '#091426' }}>
                            {row.sku}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '13px' }}>{row.name}</div>
                          <div style={{ fontSize: '11px', color: '#8191a9', marginTop: '2px' }}>
                            Giá vốn: {formatNumber(row.unitCost)} · Bán: {formatNumber(row.unitPrice)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            title={abc.desc}
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: abc.color,
                              backgroundColor: abc.bg,
                              border: `1px solid ${abc.color}33`,
                            }}
                          >
                            {row.abcCategory}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {hasSales ? (
                            <span className="mono" style={{ fontSize: '12px', color: '#45474c' }}>
                              {row.dailyVelocity.toFixed(2)}
                              <span style={{ fontSize: '10px', color: '#8191a9', marginLeft: '2px' }}>c/n</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#c4c6cc', fontStyle: 'italic' }}>Chưa bán</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: '13px', fontWeight: 600 }} title={`Khả dụng: ${row.available}, Đang SX: ${row.inProduction}`}>
                            {formatNumber(row.totalStock)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {hasSales ? (
                            <span
                              className="mono"
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: row.daysOfCover < leadTime ? '#ba1a1a' : row.daysOfCover < coverDays ? '#b45309' : '#006c49',
                              }}
                            >
                              {row.daysOfCover === Infinity ? '∞' : Math.floor(row.daysOfCover)}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#c4c6cc' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={row.moq}
                            onChange={(e) => handleUpdateMoq(row.sku, Number(e.target.value))}
                            style={styles.moqInput}
                            title="Sửa MOQ cho SKU này (tự động lưu)"
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.proposedQty > 0 ? (
                            <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: '#ba1a1a' }}>
                              +{formatNumber(row.proposedQty)}
                              {row.proposedQty !== row.rawProposedQty && (
                                <span style={{ fontSize: '9px', display: 'block', color: '#b45309', fontWeight: 500 }}>
                                  (Gốc: +{row.rawProposedQty})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#c4c6cc' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', backgroundColor: '#e6f6ef99' }}>
                          <input
                            type="number"
                            min="0"
                            value={row.actualQty}
                            onChange={(e) => handleUpdateActualQty(row.sku, Number(e.target.value))}
                            style={styles.actualQtyInput}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: '12px', color: row.actualCost > 0 ? '#111827' : '#9ca3af' }}>
                            {row.actualCost > 0 ? formatNumber(row.actualCost) : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: '12px', color: row.actualProfit > 0 ? '#006c49' : '#9ca3af', fontWeight: row.actualProfit > 0 ? 600 : 400 }}>
                            {row.actualProfit > 0 ? `+${formatNumber(row.actualProfit)}` : '—'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              id={`btn-copy-${row.sku}`}
                              onClick={() => handleCopy(row)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                              title="Copy thông tin"
                            >
                              {copiedSku === row.sku ? <CheckCircle2 size={11} /> : <ClipboardCopy size={11} />}
                              {copiedSku === row.sku ? 'Đã copy' : 'Copy'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={styles.legend}>
            <span style={styles.legendTitle}>Ghi chú:</span>
            {Object.entries(alertMeta).map(([key, m]) => (
              <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: m.color, backgroundColor: m.bg, padding: '2px 8px', borderRadius: '4px' }}>
                {m.icon} {m.label}
              </span>
            ))}
            <span style={{ fontSize: '11px', color: '#8191a9' }}>
              · Đề xuất đặt = (Tốc độ bán × Cover Days) + Safety Stock − Tổng tồn.
              · Đặt thực tế: Có thể điều chỉnh thủ công hoặc phân bổ tự động bằng nút Tối ưu hóa vốn.
            </span>
          </div>
        </div>
      )}

      {/* ── Tab 2: Capital & Financial Analysis ── */}
      {activeTab === 'analysis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Financial Charts Row */}
          <div style={styles.chartsGrid}>
            <div className="card fade-in">
              <div className="card-header">
                <h3>Vốn bỏ ra vs Lợi nhuận mang lại (Top 10 sản phẩm hàng đầu)</h3>
                <span style={{ fontSize: '11px', color: '#8191a9' }}>Chỉ hiển thị các SKU được phân bổ đặt hàng</span>
              </div>
              <div style={{ width: '100%', height: '300px' }}>
                {chartBudgetVsProfitData.length === 0 ? (
                  <div style={styles.noChartData}>Chương trình chưa có dữ liệu. Vui lòng phân bổ số lượng đặt hàng thực tế lớn hơn 0.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartBudgetVsProfitData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Vốn bỏ ra" fill="#1e293b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Lợi nhuận gộp" fill="#006c49" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card fade-in">
              <div className="card-header">
                <h3>Phân bổ dòng vốn theo Nhóm sản phẩm (ABC)</h3>
                <span style={{ fontSize: '11px', color: '#8191a9' }}>Cơ cấu ngân sách thực tế</span>
              </div>
              <div style={{ width: '100%', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {chartAbcAllocationData.length === 0 ? (
                  <div style={styles.noChartData}>Chưa có dữ liệu vốn được phân bổ.</div>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <div style={{ flex: 1, height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartAbcAllocationData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {chartAbcAllocationData.map((entry, index) => {
                              const name = entry.name;
                              let color = '#9ca3af';
                              if (name.includes('A')) color = COLORS_ABC.A;
                              if (name.includes('B')) color = COLORS_ABC.B;
                              if (name.includes('C')) color = COLORS_ABC.C;
                              return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '20px' }}>
                      {chartAbcAllocationData.map((item, idx) => {
                        const name = item.name;
                        let color = '#9ca3af';
                        if (name.includes('A')) color = COLORS_ABC.A;
                        if (name.includes('B')) color = COLORS_ABC.B;
                        if (name.includes('C')) color = COLORS_ABC.C;
                        const pct = totalActualCost > 0 ? (item.value / totalActualCost) * 100 : 0;
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', backgroundColor: color, borderRadius: '2px' }}></div>
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>
                              {name.split(' ')[0]}: <span className="mono">{formatCurrency(item.value)}</span> ({pct.toFixed(1)}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Capital Analysis Details */}
          <div className="card fade-in">
            <div className="card-header">
              <h3>Bảng phân tích dòng vốn & Lợi nhuận từng sản phẩm</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã SKU</th>
                    <th>Tên sản phẩm</th>
                    <th>Nhóm ABC</th>
                    <th style={{ textAlign: 'right' }}>Giá vốn</th>
                    <th style={{ textAlign: 'right' }}>Giá bán target</th>
                    <th style={{ textAlign: 'right' }}>Lượng đặt</th>
                    <th style={{ textAlign: 'right' }}>Vốn đầu tư</th>
                    <th style={{ textAlign: 'right' }}>Doanh thu dự kiến</th>
                    <th style={{ textAlign: 'right' }}>Lợi nhuận gộp</th>
                    <th style={{ textAlign: 'right' }}>Tỷ suất lợi nhuận (ROI)</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastRows.filter(r => r.actualQty > 0).length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', color: '#8191a9', padding: '30px' }}>
                        Chưa có sản phẩm nào được lên số lượng đặt thực tế.
                      </td>
                    </tr>
                  ) : (
                    forecastRows.filter(r => r.actualQty > 0).map((row) => {
                      const roi = row.actualCost > 0 ? (row.actualProfit / row.actualCost) * 100 : 0;
                      return (
                        <tr key={row.sku}>
                          <td className="mono" style={{ fontWeight: 700 }}>{row.sku}</td>
                          <td style={{ fontSize: '13px' }}>{row.name}</td>
                          <td>
                            <span style={{
                              padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                              color: abcMeta[row.abcCategory].color, backgroundColor: abcMeta[row.abcCategory].bg
                            }}>
                              {row.abcCategory}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }} className="mono">{formatNumber(row.unitCost)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{formatNumber(row.unitPrice)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">{formatNumber(row.actualQty)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{formatNumber(row.actualCost)}</td>
                          <td style={{ textAlign: 'right' }} className="mono">{formatNumber(row.actualRevenue)}</td>
                          <td style={{ textAlign: 'right', color: '#006c49', fontWeight: 700 }} className="mono">+{formatNumber(row.actualProfit)}</td>
                          <td style={{ textAlign: 'right', color: '#006c49', fontWeight: 700 }} className="mono">+{roi.toFixed(1)}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Insights & Marketing Strategy ── */}
      {activeTab === 'insights' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={styles.chartsGrid}>
            {/* Pareto Chart for ABC analysis */}
            <div className="card fade-in" style={{ flex: 2 }}>
              <div className="card-header">
                <h3>Đường cong Pareto (Tích lũy Doanh thu bán hàng)</h3>
                <span style={{ fontSize: '11px', color: '#8191a9' }}>Xác định nhóm ABC dựa trên đóng góp doanh thu</span>
              </div>
              <div style={{ width: '100%', height: '300px' }}>
                {chartParetoData.length === 0 ? (
                  <div style={styles.noChartData}>Chưa có lịch sử bán hàng trong chu kỳ để phân tích.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartParetoData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <XAxis dataKey="sku" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value, name) => name === 'Tích lũy %' ? `${value}%` : formatCurrency(Number(value))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area yAxisId="left" type="monotone" dataKey="Doanh thu" fill="#e8f0fe" stroke="#1a56db" />
                      <Line yAxisId="right" type="monotone" dataKey="Tích lũy %" stroke="#ba1a1a" strokeWidth={2} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ABC Group Definition Card */}
            <div className="card fade-in" style={{ flex: 1 }}>
              <div className="card-header">
                <h3>Chi tiết phân nhóm ABC</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(abcMeta).map(([key, meta]) => {
                  const count = forecastRows.filter(r => r.abcCategory === key).length;
                  return (
                    <div key={key} style={{ padding: '12px', border: `1px solid ${meta.color}22`, borderRadius: '8px', backgroundColor: `${meta.color}05` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                          color: meta.color, backgroundColor: meta.bg
                        }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>{count} sản phẩm</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{meta.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI smart Insights lists */}
          <div className="card fade-in">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#1a56db" />
              <h3>Khuyến nghị Tối ưu Dòng vốn & Doanh số (AI Smart Insights)</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
              {salesInsights.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#8191a9', fontSize: '13px' }}>
                  Dữ liệu bán hàng ổn định, chưa phát hiện vấn đề đọng vốn hay đứt hàng nghiêm trọng.
                </div>
              ) : (
                salesInsights.map((insight, idx) => {
                  let borderLeftColor = '#eceef0';
                  let bgColor = '#f9fafb';
                  if (insight.includes('🔴')) { borderLeftColor = '#ba1a1a'; bgColor = '#fff8f7'; }
                  else if (insight.includes('💡')) { borderLeftColor = '#f59e0b'; bgColor = '#fffdf4'; }
                  else if (insight.includes('✅')) { borderLeftColor = '#006c49'; bgColor = '#e6f6ef33'; }
                  else if (insight.includes('🔥')) { borderLeftColor = '#ea580c'; bgColor = '#fff7ed'; }

                  // Simple formatter for markdown bold text
                  const formattedText = insight
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/🔴|💡|✅|🔥|⚠/g, '');

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '6px',
                        borderLeft: `4px solid ${borderLeftColor}`,
                        backgroundColor: bgColor,
                        fontSize: '13px',
                        lineHeight: '1.6',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start'
                      }}
                    >
                      {insight.includes('🔴') && <AlertCircle size={16} color="#ba1a1a" style={{ flexShrink: 0, marginTop: '3px' }} />}
                      {insight.includes('🔥') && <TrendingUp size={16} color="#ea580c" style={{ flexShrink: 0, marginTop: '3px' }} />}
                      {insight.includes('💡') && <HelpCircle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '3px' }} />}
                      {insight.includes('✅') && <CheckCircle2 size={16} color="#006c49" style={{ flexShrink: 0, marginTop: '3px' }} />}
                      {insight.includes('⚠') && <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '3px' }} />}
                      <span dangerouslySetInnerHTML={{ __html: formattedText }} style={{ color: '#1f2937' }} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
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
    marginBottom: '8px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '24px',
    padding: '4px 0',
  },
  configColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  configColumnTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#091426',
    borderBottom: '1px solid #eceef0',
    paddingBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  configSubTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#091426',
    borderBottom: '1px solid #eceef0',
    paddingBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
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
  tabsContainer: {
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '2px',
    marginTop: '10px',
  },
  activeTabBtn: {
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    fontWeight: 600,
    padding: '8px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#1a56db',
    borderBottom: '3px solid #1a56db',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  inactiveTabBtn: {
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    fontWeight: 500,
    padding: '8px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#4b5563',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '12px',
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: '12px',
    marginBottom: '4px',
  },
  filterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#4b5563',
  },
  selectFilter: {
    fontSize: '13px',
    padding: '6px 24px 6px 10px',
    borderRadius: '6px',
    borderColor: '#e5e7eb',
    width: 'auto',
    cursor: 'pointer',
    backgroundColor: '#ffffff',
  },
  moqInput: {
    width: '65px',
    padding: '4px 6px',
    fontSize: '12px',
    textAlign: 'right' as const,
    border: '1px dashed #c5c6cd',
    borderRadius: '4px',
    fontFamily: 'var(--font-mono, monospace)',
    backgroundColor: '#fafafa',
  },
  actualQtyInput: {
    width: '75px',
    padding: '4px 6px',
    fontSize: '13px',
    textAlign: 'right' as const,
    border: '1px solid #006c49',
    borderRadius: '4px',
    fontFamily: 'var(--font-mono, monospace)',
    fontWeight: 700,
    color: '#006c49',
    backgroundColor: '#ffffff',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '20px',
  },
  noChartData: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#8191a9',
    fontSize: '13px',
    textAlign: 'center' as const,
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
    fontSize: '11px',
    fontWeight: 700,
    color: '#45474c',
  },
  valueDisplay: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#091426',
    backgroundColor: '#f0f2f5',
    padding: '1px 6px',
    borderRadius: '4px',
  },
  slider: {
    width: '100%',
    accentColor: '#006c49',
    cursor: 'pointer',
    height: '6px',
  },
  numberInput: {
    width: '100px',
    border: '1px solid #e0e3e5',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    fontFamily: 'var(--font-mono, monospace)',
    color: '#091426',
    backgroundColor: '#ffffff',
  },
  description: {
    fontSize: '10px',
    color: '#8191a9',
    margin: 0,
    lineHeight: '1.4',
  },
};
