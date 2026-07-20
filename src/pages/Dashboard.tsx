import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { formatCurrency } from '../utils/formatters';
import { getTodayISO } from '../utils/formatters';
import type { ActualRevenueSource } from '../types';
import type { ActualRevenueImportResult } from '../services/excelDataService';
import {
  TrendingUp, PackageCheck, CalendarDays, BarChart3, Wallet,
  Plus, Trash2, CheckCircle2, Upload, FileDown, FileSpreadsheet, AlertCircle, X, RefreshCw
} from 'lucide-react';
import {
  exportActualRevenuesToExcel,
  generateActualRevenueTemplate,
  importActualRevenuesFromExcel,
} from '../services/excelDataService';

/** Helper: get ISO date string N days ago */
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};
const todayISO = () => new Date().toISOString().split('T')[0];

type QuickRange = 'today' | '7d' | '30d' | 'all' | 'custom';
type DashboardView = 'revenue' | 'actual';

export const Dashboard: React.FC = () => {
  const {
    products, productionBatches, sales, expenses,
    actualRevenues, addActualRevenue, deleteActualRevenue
  } = useApp();

  // --- Tab view state ---
  const [activeView, setActiveView] = useState<DashboardView>('revenue');

  // --- Date range filter state ---
  const [quickRange, setQuickRange] = useState<QuickRange>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // --- Actual Revenue form state ---
  const [arAmount, setArAmount] = useState('');
  const [arSource, setArSource] = useState<ActualRevenueSource>('shopee');
  const [arDate, setArDate] = useState(getTodayISO());
  const [arNotes, setArNotes] = useState('');
  const [arSuccess, setArSuccess] = useState(false);

  // --- Excel import state ---
  const excelFileRef = useRef<HTMLInputElement>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState<ActualRevenueImportResult | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string | null>(null);
  const [excelImportMode, setExcelImportMode] = useState<'append' | 'overwrite'>('append');
  const [showExcelConfirm, setShowExcelConfirm] = useState(false);

  /** Computed effective date range */
  const effectiveRange = useMemo(() => {
    switch (quickRange) {
      case 'today': return { from: todayISO(), to: todayISO() };
      case '7d':    return { from: daysAgo(6), to: todayISO() };
      case '30d':   return { from: daysAgo(29), to: todayISO() };
      case 'custom': return { from: fromDate, to: toDate };
      case 'all':
      default:      return { from: '', to: '' };
    }
  }, [quickRange, fromDate, toDate]);

  const handleQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    if (range !== 'custom') {
      setFromDate('');
      setToDate('');
    }
  };

  const handleCustomFrom = (val: string) => { setFromDate(val); setQuickRange('custom'); };
  const handleCustomTo = (val: string) => { setToDate(val); setQuickRange('custom'); };

  /** Filter sales & expenses by effective date range */
  const filteredSales = useMemo(() => {
    const { from, to } = effectiveRange;
    if (!from && !to) return sales;
    return sales.filter(s => {
      const d = s.saleDate;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [sales, effectiveRange]);

  const filteredExpenses = useMemo(() => {
    const { from, to } = effectiveRange;
    if (!from && !to) return expenses;
    return expenses.filter(e => {
      const d = e.expenseDate;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [expenses, effectiveRange]);

  const filteredActualRevenues = useMemo(() => {
    const { from, to } = effectiveRange;
    if (!from && !to) return actualRevenues;
    return actualRevenues.filter(r => {
      const d = r.receivedDate;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [actualRevenues, effectiveRange]);

  /** Label for the active range shown under the filter */
  const rangeSummary = useMemo(() => {
    switch (quickRange) {
      case 'today': return `Hôm nay (${todayISO()})`;
      case '7d':    return `7 ngày gần nhất (${daysAgo(6)} → ${todayISO()})`;
      case '30d':   return `30 ngày gần nhất (${daysAgo(29)} → ${todayISO()})`;
      case 'custom': {
        const f = fromDate || '...';
        const t = toDate || '...';
        return `Tùy chọn: ${f} → ${t}`;
      }
      case 'all':
      default: return 'Toàn bộ thời gian';
    }
  }, [quickRange, fromDate, toDate]);

  // ============================
  // Revenue-based calculations (existing)
  // ============================
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
  const totalCOGS = filteredSales.reduce((sum, s) => {
    const prod = products.find((p) => p.sku === s.productSku);
    const costPerUnit = prod ? prod.defaultCost : 0;
    return sum + s.quantity * costPerUnit;
  }, 0);
  
  // Tab Doanh thu: Không cộng phí Gia công (processing) và Nguyên phụ liệu (material) vào OPEX
  // vì COGS (giá vốn sản xuất) đã bao gồm 2 khoản này.
  const totalOpExpenses = filteredExpenses
    .filter(e => e.category !== 'processing' && e.category !== 'material')
    .reduce((sum, e) => sum + e.amount, 0);
    
  const totalPlatformFee = filteredSales.reduce((sum, s) => sum + (s.platformFee || 0), 0);
  const totalCost = totalCOGS + totalOpExpenses + totalPlatformFee;
  const netProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const revenueBySource = {
    shopee: filteredSales.filter(s => s.source === 'shopee').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
    tiktok: filteredSales.filter(s => s.source === 'tiktok').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
    offline: filteredSales.filter(s => s.source === 'offline').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
    manual: filteredSales.filter(s => s.source === 'manual').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
    nhanh_vn: filteredSales.filter(s => s.source === 'nhanh_vn').reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
  };

  // Chi phí thực tế đã chi ra (dùng để hiển thị trong P&L doanh thu để đối chiếu nhưng không cộng vào tổng)
  const actualOpExpensesInCurPeriod = {
    material: filteredExpenses.filter(e => e.category === 'material').reduce((sum, e) => sum + e.amount, 0),
    processing: filteredExpenses.filter(e => e.category === 'processing').reduce((sum, e) => sum + e.amount, 0),
  };

  const costByCategory = {
    production: totalCOGS,
    platformFee: totalPlatformFee,
    labor: filteredExpenses.filter(e => e.category === 'labor').reduce((sum, e) => sum + e.amount, 0),
    rent: filteredExpenses.filter(e => e.category === 'rent').reduce((sum, e) => sum + e.amount, 0),
    ads: filteredExpenses.filter(e => e.category === 'ads').reduce((sum, e) => sum + e.amount, 0),
    shipping: filteredExpenses.filter(e => e.category === 'shipping').reduce((sum, e) => sum + e.amount, 0),
    material: 0, // Đặt bằng 0 trong tab Doanh thu vì đã gộp trong COGS
    processing: 0, // Đặt bằng 0 trong tab Doanh thu vì đã gộp trong COGS
    other: filteredExpenses.filter(e => e.category === 'other').reduce((sum, e) => sum + e.amount, 0),
  };

  // ============================
  // Actual Revenue (Cashflow) calculations
  // ============================
  const totalActualRevenue = filteredActualRevenues.reduce((sum, r) => sum + r.amount, 0);
  
  // Tab Tiền thu thực tế: Tính tất cả chi phí bao gồm cả Gia công và Nguyên vật liệu chi ra thực tế
  const totalOpExpensesActual = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const actualNetProfit = totalActualRevenue - totalOpExpensesActual;
  const actualProfitMargin = totalActualRevenue > 0 ? (actualNetProfit / totalActualRevenue) * 100 : 0;

  const actualRevenueBySource: Record<string, number> = {
    shopee: filteredActualRevenues.filter(r => r.source === 'shopee').reduce((sum, r) => sum + r.amount, 0),
    tiktok: filteredActualRevenues.filter(r => r.source === 'tiktok').reduce((sum, r) => sum + r.amount, 0),
    offline: filteredActualRevenues.filter(r => r.source === 'offline').reduce((sum, r) => sum + r.amount, 0),
    bank_transfer: filteredActualRevenues.filter(r => r.source === 'bank_transfer').reduce((sum, r) => sum + r.amount, 0),
    cash: filteredActualRevenues.filter(r => r.source === 'cash').reduce((sum, r) => sum + r.amount, 0),
    other: filteredActualRevenues.filter(r => r.source === 'other').reduce((sum, r) => sum + r.amount, 0),
  };

  const expenseByCategory = {
    labor: filteredExpenses.filter(e => e.category === 'labor').reduce((sum, e) => sum + e.amount, 0),
    rent: filteredExpenses.filter(e => e.category === 'rent').reduce((sum, e) => sum + e.amount, 0),
    ads: filteredExpenses.filter(e => e.category === 'ads').reduce((sum, e) => sum + e.amount, 0),
    shipping: filteredExpenses.filter(e => e.category === 'shipping').reduce((sum, e) => sum + e.amount, 0),
    material: filteredExpenses.filter(e => e.category === 'material').reduce((sum, e) => sum + e.amount, 0),
    processing: filteredExpenses.filter(e => e.category === 'processing').reduce((sum, e) => sum + e.amount, 0),
    other: filteredExpenses.filter(e => e.category === 'other').reduce((sum, e) => sum + e.amount, 0),
  };

  // ============================
  // Production & Activities (shared)
  // ============================
  const stageNames: Record<string, string> = {
    ordered: 'Đã đặt hàng',
    paid: 'Đã thanh toán',
    shipping: 'Đang vận chuyển',
    producing: 'Đang sản xuất',
    delivered: 'Đã nhập kho',
  };

  const activeBatches = productionBatches.filter((b) => b.status === 'running');
  const recentActivities = [
    ...filteredSales.map((s) => ({
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

  // ============================
  // Handle add actual revenue
  // ============================
  const handleAddActualRevenue = () => {
    const amt = Number(arAmount);
    if (!amt || amt <= 0 || !arDate) return;
    addActualRevenue({
      amount: amt,
      source: arSource,
      receivedDate: arDate,
      notes: arNotes.trim(),
    });
    setArAmount('');
    setArNotes('');
    setArSuccess(true);
    setTimeout(() => setArSuccess(false), 2000);
  };

  // Source display helpers
  const actualSourceNames: Record<string, string> = {
    shopee: 'Shopee', tiktok: 'TikTok', offline: 'Offline',
    bank_transfer: 'Chuyển khoản', cash: 'Tiền mặt', other: 'Khác',
  };
  const actualSourceColors: Record<string, string> = {
    shopee: '#ff5722', tiktok: '#000000', offline: '#091426',
    bank_transfer: '#1976d2', cash: '#006c49', other: '#9e9e9e',
  };

  // ============================
  // Handle Excel import for actual revenue
  // ============================
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (excelFileRef.current) excelFileRef.current.value = '';
    setIsParsingExcel(true);
    setExcelError(null);
    setExcelPreview(null);
    setExcelSuccessMsg(null);
    try {
      const result = await importActualRevenuesFromExcel(file);
      setExcelPreview(result);
      setShowExcelConfirm(true);
    } catch (err) {
      setExcelError((err as Error).message);
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleConfirmExcelImport = () => {
    if (!excelPreview) return;

    let finalRevenues: typeof actualRevenues;
    if (excelImportMode === 'overwrite') {
      finalRevenues = excelPreview.revenues;
    } else {
      // Append: skip duplicates by id
      const existingIds = new Set(actualRevenues.map(r => r.id));
      const newItems = excelPreview.revenues.filter(r => !existingIds.has(r.id));
      finalRevenues = [...actualRevenues, ...newItems];
    }

    // Save directly to state + localStorage (same as addActualRevenue pattern)
    // We need to use the context's state setter, but we don't have direct access.
    // Instead, use addActualRevenue for each new item, or batch update via the pattern used in the app.
    // Since the app uses importAllData for batch operations, let's do it the simple way:
    // clear existing and re-add, or just use localStorage directly and reload.
    
    // Simplest approach consistent with how Expenses page does it:
    // Write to localStorage and reload.
    try {
      localStorage.setItem('silence_actual_revenues', JSON.stringify(finalRevenues));
      const mode = excelImportMode === 'overwrite' ? 'Ghi đè' : 'Thêm mới';
      setExcelSuccessMsg(`✅ [${mode}] Import thành công: ${excelPreview.revenues.length} khoản thu.`);
      setShowExcelConfirm(false);
      setExcelPreview(null);
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      setExcelError(`Lỗi lưu dữ liệu: ${(err as Error).message}`);
      setShowExcelConfirm(false);
    }
  };

  const handleCancelExcelImport = () => {
    setShowExcelConfirm(false);
    setExcelPreview(null);
    setExcelError(null);
  };

  return (
    <div className="page-container fade-in">
      {/* === Tab Switcher === */}
      <div style={styles.tabBar}>
        <button
          onClick={() => setActiveView('revenue')}
          style={{
            ...styles.tabBtn,
            ...(activeView === 'revenue' ? styles.tabBtnActive : {}),
          }}
        >
          <BarChart3 size={16} />
          <span>Theo Doanh thu</span>
        </button>
        <button
          onClick={() => setActiveView('actual')}
          style={{
            ...styles.tabBtn,
            ...(activeView === 'actual' ? styles.tabBtnActiveGreen : {}),
          }}
        >
          <Wallet size={16} />
          <span>Theo Tiền thu thực tế</span>
        </button>
      </div>

      {/* === Date Range Filter Bar === */}
      <div style={styles.dateFilterBar}>
        <div style={styles.dateFilterLeft}>
          <CalendarDays size={16} style={{ color: '#45474c', flexShrink: 0 }} />
          <div style={styles.quickBtns}>
            {[
              { key: 'today' as QuickRange, label: 'Hôm nay' },
              { key: '7d' as QuickRange, label: '7 ngày' },
              { key: '30d' as QuickRange, label: '30 ngày' },
              { key: 'all' as QuickRange, label: 'Tất cả' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleQuickRange(key)}
                style={{
                  ...styles.quickBtn,
                  ...(quickRange === key ? styles.quickBtnActive : {}),
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={styles.dateInputs}>
            <input
              type="date"
              value={quickRange === 'custom' ? fromDate : effectiveRange.from}
              onChange={e => handleCustomFrom(e.target.value)}
              style={styles.dateInput}
              title="Từ ngày"
            />
            <span style={{ color: '#8191a9', fontSize: '12px' }}>→</span>
            <input
              type="date"
              value={quickRange === 'custom' ? toDate : effectiveRange.to}
              onChange={e => handleCustomTo(e.target.value)}
              style={styles.dateInput}
              title="Đến ngày"
            />
          </div>
        </div>
        <div style={styles.dateFilterSummary}>
          <span>{rangeSummary}</span>
          <span style={{ marginLeft: '8px', fontWeight: 600 }}>
            {activeView === 'revenue'
              ? `${filteredSales.length} đơn · ${filteredExpenses.length} chi phí`
              : `${filteredActualRevenues.length} khoản thu · ${filteredExpenses.length} chi phí`
            }
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: THEO DOANH THU (existing Dashboard) */}
      {/* ========================================================= */}
      {activeView === 'revenue' && (
        <>
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
                <span>Giá vốn: {formatCurrency(totalCOGS)} + CP sàn: {formatCurrency(totalPlatformFee)} + CP VH: {formatCurrency(totalOpExpenses)}</span>
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
                    <span>• Chi phí sàn (Shopee, TikTok...)</span>
                    <span className="mono">{formatCurrency(costByCategory.platformFee)}</span>
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
                    <span>• Chi phí gia công <span style={{ fontSize: '11px', color: '#8191a9' }}>(Đã gộp trong COGS)</span></span>
                    <span className="mono" style={{ color: '#8191a9' }}>{formatCurrency(actualOpExpensesInCurPeriod.processing)}</span>
                  </div>
                  <div style={styles.plRow}>
                    <span>• Chi phí nguyên phụ liệu <span style={{ fontSize: '11px', color: '#8191a9' }}>(Đã gộp trong COGS)</span></span>
                    <span className="mono" style={{ color: '#8191a9' }}>{formatCurrency(actualOpExpensesInCurPeriod.material)}</span>
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
                            shopee: '#ff5722', tiktok: '#000000', offline: '#091426',
                            nhanh_vn: '#0084ff', manual: '#8191a9',
                          };
                          return (
                            <div
                              key={key}
                              style={{
                                width: `${pct}%`, backgroundColor: colors[key] || '#cccccc',
                                height: '100%', transition: 'width 0.3s ease',
                              }}
                              title={`${key}: ${pct.toFixed(1)}% (${formatCurrency(val)})`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {totalRevenue > 0 && (
                      <div style={styles.visualLegendGrid}>
                        {Object.entries(revenueBySource).map(([key, val]) => {
                          if (val === 0) return null;
                          const pct = (val / totalRevenue) * 100;
                          const colors: Record<string, string> = {
                            shopee: '#ff5722', tiktok: '#000000', offline: '#091426',
                            nhanh_vn: '#0084ff', manual: '#8191a9',
                          };
                          const names: Record<string, string> = {
                            shopee: 'Shopee', tiktok: 'TikTok', offline: 'Offline',
                            nhanh_vn: 'Nhanh', manual: 'Tay',
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
                            production: '#ba1a1a', platformFee: '#ff9800', labor: '#1976d2',
                            rent: '#9c27b0', ads: '#e91e63', shipping: '#ffeb3b',
                            material: '#4caf50', other: '#9e9e9e',
                          };
                          return (
                            <div
                              key={key}
                              style={{
                                width: `${pct}%`, backgroundColor: colors[key] || '#cccccc',
                                height: '100%', transition: 'width 0.3s ease',
                              }}
                              title={`${key}: ${pct.toFixed(1)}% (${formatCurrency(val)})`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {totalCost > 0 && (
                      <div style={styles.visualLegendGrid}>
                        {Object.entries(costByCategory).map(([key, val]) => {
                          if (val === 0) return null;
                          const pct = (val / totalCost) * 100;
                          const colors: Record<string, string> = {
                            production: '#ba1a1a', platformFee: '#ff9800', labor: '#1976d2',
                            rent: '#9c27b0', ads: '#e91e63', shipping: '#ffeb3b',
                            material: '#4caf50', other: '#9e9e9e',
                          };
                          const names: Record<string, string> = {
                            production: 'Giá vốn', platformFee: 'CP sàn', labor: 'Công',
                            rent: 'Mặt bằng', ads: 'QC', shipping: 'Ship',
                            material: 'Vật liệu', other: 'Khác',
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
                        ordered: '20%', paid: '40%', shipping: '60%', producing: '80%', delivered: '100%',
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
        </>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: THEO TIỀN THU THỰC TẾ (Cashflow) */}
      {/* ========================================================= */}
      {activeView === 'actual' && (
        <>
          {/* KPI Cards Grid — Cashflow */}
          <div className="kpi-grid">
            <div className="kpi-card" style={{ borderTop: '3px solid #006c49' }}>
              <div className="kpi-label">💰 Tiền thu thực tế</div>
              <div className="kpi-value mono" style={{ color: '#006c49' }}>{formatCurrency(totalActualRevenue)}</div>
              <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Wallet size={14} style={{ color: '#006c49' }} />
                <span>Tiền thật nhận từ sàn/kênh bán</span>
              </div>
            </div>

            <div className="kpi-card" style={{ borderTop: '3px solid #ba1a1a' }}>
              <div className="kpi-label">Chi phí vận hành</div>
              <div className="kpi-value mono" style={{ color: '#ba1a1a' }}>{formatCurrency(totalOpExpensesActual)}</div>
              <div className="kpi-desc">
                <span>Tổng chi phí nhập tay ({filteredExpenses.length} khoản)</span>
              </div>
            </div>

            <div className="kpi-card" style={{ borderTop: `3px solid ${actualNetProfit >= 0 ? '#006c49' : '#ba1a1a'}` }}>
              <div className="kpi-label">Lãi / Lỗ thực tế</div>
              <div className="kpi-value mono" style={{ color: actualNetProfit >= 0 ? '#006c49' : '#ba1a1a' }}>
                {formatCurrency(actualNetProfit)}
              </div>
              <div className="kpi-desc">
                <span>= Tiền thu − Chi phí vận hành</span>
              </div>
            </div>

            <div className="kpi-card" style={{ borderTop: '3px solid #b45309' }}>
              <div className="kpi-label">Tỷ suất lãi thực tế</div>
              <div className="kpi-value mono" style={{ color: '#b45309' }}>
                {actualProfitMargin.toFixed(1)}%
              </div>
              <div className="kpi-desc">
                <span>Biên lãi trên tiền thu</span>
              </div>
            </div>
          </div>

          <div style={styles.dashboardGrid}>
            {/* Left: P&L Cashflow + Visual */}
            <div className="card" style={{ flex: 2, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card-header">
                <h3>💰 Lãi lỗ theo Tiền thu thực tế</h3>
                <span style={{ fontSize: '12px', color: '#8191a9', fontWeight: 600 }}>Đơn vị: VND</span>
              </div>

              <div style={styles.plContainer}>
                {/* Left: P&L Table */}
                <div style={styles.plTable}>
                  <div style={styles.plSectionHeader}>I. TIỀN THU THỰC TẾ</div>
                  <div style={styles.plTotalRow}>
                    <span>Tổng tiền thu</span>
                    <span className="mono font-semibold" style={{ color: '#006c49' }}>{formatCurrency(totalActualRevenue)}</span>
                  </div>
                  {Object.entries(actualRevenueBySource).map(([key, val]) => (
                    <div key={key} style={styles.plRow}>
                      <span>• {actualSourceNames[key] || key}</span>
                      <span className="mono">{formatCurrency(val)}</span>
                    </div>
                  ))}

                  <div style={{ ...styles.plSectionHeader, marginTop: '16px' }}>II. CHI PHÍ VẬN HÀNH</div>
                  <div style={styles.plTotalRow}>
                    <span>Tổng chi phí</span>
                    <span className="mono font-semibold" style={{ color: '#ba1a1a' }}>{formatCurrency(totalOpExpensesActual)}</span>
                  </div>
                  {Object.entries(expenseByCategory).map(([key, val]) => {
                    const names: Record<string, string> = {
                      labor: 'Nhân công', rent: 'Mặt bằng', ads: 'Quảng cáo',
                      shipping: 'Vận chuyển', material: 'Nguyên phụ liệu',
                      processing: 'Gia công', other: 'Khác',
                    };
                    return (
                      <div key={key} style={styles.plRow}>
                        <span>• {names[key] || key}</span>
                        <span className="mono">{formatCurrency(val)}</span>
                      </div>
                    );
                  })}

                  <div style={{ ...styles.plSectionHeader, marginTop: '16px', borderTop: '2px solid #eceef0', paddingTop: '12px' }}>III. KẾT QUẢ DÒNG TIỀN</div>
                  <div style={styles.plResultRow}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>Lãi / Lỗ thực tế</span>
                    <span className="mono" style={{ fontSize: '18px', fontWeight: 700, color: actualNetProfit >= 0 ? '#006c49' : '#ba1a1a' }}>
                      {formatCurrency(actualNetProfit)}
                    </span>
                  </div>
                  <div style={styles.plRow}>
                    <span>Tỷ suất lãi thực tế</span>
                    <span className="mono font-semibold" style={{ color: '#b45309' }}>{actualProfitMargin.toFixed(2)}%</span>
                  </div>
                </div>

                {/* Right: Visual bars */}
                <div style={styles.plVisuals}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#45474c', marginBottom: '12px' }}>Cấu trúc dòng tiền</h4>

                  {/* Actual revenue bar */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={styles.visualBarLabel}>
                      <span>Tiền thu theo nguồn</span>
                      <span className="mono">{formatCurrency(totalActualRevenue)}</span>
                    </div>
                    {totalActualRevenue === 0 ? (
                      <div style={styles.emptyBar}>Chưa có tiền thu</div>
                    ) : (
                      <div style={styles.visualBarContainer}>
                        {Object.entries(actualRevenueBySource).map(([key, val]) => {
                          if (val === 0) return null;
                          const pct = (val / totalActualRevenue) * 100;
                          return (
                            <div
                              key={key}
                              style={{
                                width: `${pct}%`, backgroundColor: actualSourceColors[key] || '#ccc',
                                height: '100%', transition: 'width 0.3s ease',
                              }}
                              title={`${actualSourceNames[key]}: ${pct.toFixed(1)}% (${formatCurrency(val)})`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {totalActualRevenue > 0 && (
                      <div style={styles.visualLegendGrid}>
                        {Object.entries(actualRevenueBySource).map(([key, val]) => {
                          if (val === 0) return null;
                          const pct = (val / totalActualRevenue) * 100;
                          return (
                            <div key={key} style={styles.miniLegendItem}>
                              <span style={{ ...styles.legendDot, backgroundColor: actualSourceColors[key] || '#ccc' }} />
                              <span style={{ fontSize: '11px', color: '#45474c' }}>
                                {actualSourceNames[key]} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Expense bar */}
                  <div>
                    <div style={styles.visualBarLabel}>
                      <span>Chi phí vận hành</span>
                      <span className="mono">{formatCurrency(totalOpExpensesActual)}</span>
                    </div>
                    {totalOpExpensesActual === 0 ? (
                      <div style={styles.emptyBar}>Chưa có chi phí</div>
                    ) : (
                      <div style={styles.visualBarContainer}>
                        {Object.entries(expenseByCategory).map(([key, val]) => {
                          if (val === 0) return null;
                          const pct = (val / totalOpExpensesActual) * 100;
                          const colors: Record<string, string> = {
                            labor: '#1976d2', rent: '#9c27b0', ads: '#e91e63',
                            shipping: '#ffeb3b', material: '#4caf50', processing: '#e65100', other: '#9e9e9e',
                          };
                          const names: Record<string, string> = {
                            labor: 'Nhân công', rent: 'Mặt bằng', ads: 'Quảng cáo',
                            shipping: 'Vận chuyển', material: 'Nguyên phụ liệu', processing: 'Gia công', other: 'Khác',
                          };
                          return (
                            <div
                              key={key}
                              style={{
                                width: `${pct}%`, backgroundColor: colors[key] || '#ccc',
                                height: '100%', transition: 'width 0.3s ease',
                              }}
                              title={`${names[key] || key}: ${pct.toFixed(1)}% (${formatCurrency(val)})`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {totalOpExpensesActual > 0 && (
                      <div style={styles.visualLegendGrid}>
                        {Object.entries(expenseByCategory).map(([key, val]) => {
                          if (val === 0) return null;
                          const pct = (val / totalOpExpensesActual) * 100;
                          const colors: Record<string, string> = {
                            labor: '#1976d2', rent: '#9c27b0', ads: '#e91e63',
                            shipping: '#ffeb3b', material: '#4caf50', processing: '#e65100', other: '#9e9e9e',
                          };
                          const names: Record<string, string> = {
                            labor: 'Công', rent: 'Mặt bằng', ads: 'QC',
                            shipping: 'Ship', material: 'Vật liệu', processing: 'Gia công', other: 'Khác',
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

            {/* Right: Add form + History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minWidth: '300px' }}>
              {/* Add Actual Revenue Form */}
              <div className="card" style={{ gap: '14px' }}>
                <div className="card-header">
                  <h3>Nhập tiền thu thực tế</h3>
                  <Plus size={16} style={{ color: '#006c49' }} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Ngày nhận tiền</label>
                  <input
                    type="date"
                    value={arDate}
                    onChange={e => setArDate(e.target.value)}
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Nguồn thu</label>
                  <select
                    value={arSource}
                    onChange={e => setArSource(e.target.value as ActualRevenueSource)}
                    style={styles.formInput}
                  >
                    <option value="shopee">Shopee</option>
                    <option value="tiktok">TikTok</option>
                    <option value="offline">Offline (Lên ngoài)</option>
                    <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                    <option value="cash">Tiền mặt</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Số tiền (VND)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={arAmount}
                    onChange={e => setArAmount(e.target.value)}
                    style={{ ...styles.formInput, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Ghi chú</label>
                  <input
                    type="text"
                    placeholder="VD: Shopee thanh toán đợt 1 tháng 7"
                    value={arNotes}
                    onChange={e => setArNotes(e.target.value)}
                    style={styles.formInput}
                  />
                </div>

                <button
                  onClick={handleAddActualRevenue}
                  disabled={!arAmount || Number(arAmount) <= 0 || !arDate}
                  style={{
                    ...styles.submitBtn,
                    opacity: (!arAmount || Number(arAmount) <= 0 || !arDate) ? 0.5 : 1,
                  }}
                >
                  <Plus size={16} />
                  <span>Ghi nhận tiền thu</span>
                </button>

                {arSuccess && (
                  <div style={styles.successMsg}>
                    <CheckCircle2 size={14} />
                    <span>Đã ghi nhận thành công!</span>
                  </div>
                )}

                {/* Divider */}
                <div style={{ borderTop: '1px solid #e2e5e9', margin: '4px 0' }} />

                {/* Excel Import Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#45474c' }}>📊 Nhập từ file Excel</div>
                  
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Import button */}
                    <button
                      onClick={() => excelFileRef.current?.click()}
                      disabled={isParsingExcel}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 12px', fontSize: '12px', fontWeight: 600,
                        border: '1px solid #006c49', borderRadius: '6px',
                        backgroundColor: '#ecfdf5', color: '#006c49',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                        opacity: isParsingExcel ? 0.6 : 1,
                      }}
                    >
                      {isParsingExcel
                        ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /><span>Đang đọc...</span></>
                        : <><Upload size={13} /><span>Import Excel (.xlsx)</span></>}
                    </button>
                    <input
                      ref={excelFileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={handleExcelFileChange}
                    />

                    {/* Template download */}
                    <button
                      onClick={generateActualRevenueTemplate}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 12px', fontSize: '12px', fontWeight: 600,
                        border: '1px solid #d1d5db', borderRadius: '6px',
                        backgroundColor: '#fff', color: '#45474c',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                      title="Tải file Excel mẫu"
                    >
                      <FileDown size={13} />
                      <span>Tải mẫu</span>
                    </button>

                    {/* Export current data */}
                    {actualRevenues.length > 0 && (
                      <button
                        onClick={() => exportActualRevenuesToExcel(actualRevenues)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '7px 12px', fontSize: '12px', fontWeight: 600,
                          border: '1px solid #d1d5db', borderRadius: '6px',
                          backgroundColor: '#fff', color: '#45474c',
                          cursor: 'pointer', transition: 'all 0.15s ease',
                        }}
                        title="Xuất dữ liệu tiền thu ra Excel"
                      >
                        <FileSpreadsheet size={13} />
                        <span>Xuất Excel</span>
                      </button>
                    )}
                  </div>

                  {/* Excel error */}
                  {excelError && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '12px', color: '#ba1a1a', fontWeight: 600,
                      padding: '8px 10px', backgroundColor: '#fef2f2',
                      borderRadius: '6px', border: '1px solid #fecaca',
                    }}>
                      <AlertCircle size={14} />
                      <span>{excelError}</span>
                    </div>
                  )}

                  {/* Excel success */}
                  {excelSuccessMsg && (
                    <div style={styles.successMsg}>
                      <CheckCircle2 size={14} />
                      <span>{excelSuccessMsg}</span>
                    </div>
                  )}
                </div>

                {/* Excel Preview / Confirm Modal */}
                {showExcelConfirm && excelPreview && (
                  <div style={{
                    padding: '14px', backgroundColor: '#f8fafc',
                    border: '1px solid #e2e5e9', borderRadius: '8px',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#091426' }}>
                        📋 Xem trước dữ liệu import
                      </span>
                      <button
                        onClick={handleCancelExcelImport}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8191a9' }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div style={{ fontSize: '13px', color: '#45474c' }}>
                      Tìm thấy <strong style={{ color: '#006c49' }}>{excelPreview.revenues.length}</strong> khoản thu hợp lệ
                      {excelPreview.revenues.length > 0 && (
                        <span className="mono" style={{ marginLeft: '8px', color: '#006c49', fontWeight: 600 }}>
                          ({formatCurrency(excelPreview.revenues.reduce((s, r) => s + r.amount, 0))})
                        </span>
                      )}
                    </div>

                    {/* Preview table (first 5 rows) */}
                    {excelPreview.revenues.length > 0 && (
                      <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e2e5e9' }}>
                              <th style={{ textAlign: 'left', padding: '4px 6px', color: '#6b7280', fontWeight: 600 }}>Nguồn</th>
                              <th style={{ textAlign: 'right', padding: '4px 6px', color: '#6b7280', fontWeight: 600 }}>Số tiền</th>
                              <th style={{ textAlign: 'left', padding: '4px 6px', color: '#6b7280', fontWeight: 600 }}>Ngày</th>
                              <th style={{ textAlign: 'left', padding: '4px 6px', color: '#6b7280', fontWeight: 600 }}>Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody>
                            {excelPreview.revenues.slice(0, 5).map((r, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f3f5' }}>
                                <td style={{ padding: '4px 6px' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  }}>
                                    <span style={{
                                      width: '6px', height: '6px', borderRadius: '50%',
                                      backgroundColor: actualSourceColors[r.source] || '#9e9e9e',
                                      display: 'inline-block',
                                    }} />
                                    {actualSourceNames[r.source] || r.source}
                                  </span>
                                </td>
                                <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                                  {formatCurrency(r.amount)}
                                </td>
                                <td style={{ padding: '4px 6px', fontFamily: "'JetBrains Mono', monospace" }}>{r.receivedDate}</td>
                                <td style={{ padding: '4px 6px', color: '#6b7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {excelPreview.revenues.length > 5 && (
                          <div style={{ fontSize: '11px', color: '#8191a9', padding: '4px 6px' }}>
                            ... và {excelPreview.revenues.length - 5} dòng khác
                          </div>
                        )}
                      </div>
                    )}

                    {/* Warnings */}
                    {excelPreview.warnings.length > 0 && (
                      <div style={{
                        fontSize: '11px', color: '#b45309', padding: '6px 8px',
                        backgroundColor: '#fffbeb', borderRadius: '4px',
                        border: '1px solid #fde68a', maxHeight: '80px', overflowY: 'auto',
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '2px' }}>⚠️ Cảnh báo:</div>
                        {excelPreview.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                      </div>
                    )}

                    {/* Import mode toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: '#45474c' }}>Chế độ:</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="excelImportMode"
                          checked={excelImportMode === 'append'}
                          onChange={() => setExcelImportMode('append')}
                        />
                        <span>Thêm mới</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="excelImportMode"
                          checked={excelImportMode === 'overwrite'}
                          onChange={() => setExcelImportMode('overwrite')}
                        />
                        <span style={{ color: '#ba1a1a' }}>Ghi đè (xóa dữ liệu cũ)</span>
                      </label>
                    </div>

                    {/* Confirm / Cancel buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleConfirmExcelImport}
                        disabled={excelPreview.revenues.length === 0}
                        style={{
                          ...styles.submitBtn,
                          flex: 1,
                          opacity: excelPreview.revenues.length === 0 ? 0.5 : 1,
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>Xác nhận Import ({excelPreview.revenues.length} dòng)</span>
                      </button>
                      <button
                        onClick={handleCancelExcelImport}
                        style={{
                          padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                          border: '1px solid #d1d5db', borderRadius: '8px',
                          backgroundColor: '#fff', color: '#45474c', cursor: 'pointer',
                        }}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Actual Revenue History */}
              <div className="card" style={{ gap: '12px', flex: 1 }}>
                <div className="card-header">
                  <h3>Lịch sử tiền thu</h3>
                  <span className="badge badge-primary">{filteredActualRevenues.length} bản ghi</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                  {filteredActualRevenues.length === 0 ? (
                    <div style={styles.emptyActivities}>
                      Chưa có bản ghi tiền thu thực tế nào.
                    </div>
                  ) : (
                    filteredActualRevenues.slice(0, 20).map((r) => (
                      <div key={r.id} style={styles.historyItem}>
                        <div style={styles.historyLeft}>
                          <div style={{
                            ...styles.historySourceDot,
                            backgroundColor: actualSourceColors[r.source] || '#9e9e9e',
                          }} />
                          <div style={styles.historyInfo}>
                            <div style={styles.historyTop}>
                              <span style={styles.historySource}>{actualSourceNames[r.source] || r.source}</span>
                              <span className="mono" style={styles.historyAmount}>{formatCurrency(r.amount)}</span>
                            </div>
                            <div style={styles.historyBottom}>
                              <span className="mono">{r.receivedDate}</span>
                              {r.notes && <><span>·</span><span>{r.notes}</span></>}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteActualRevenue(r.id)}
                          style={styles.deleteBtn}
                          title="Xóa bản ghi"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  // Tab bar
  tabBar: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    backgroundColor: '#f1f3f5',
    borderRadius: '10px',
    marginBottom: '16px',
    border: '1px solid #e2e5e9',
  },
  tabBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  tabBtnActive: {
    backgroundColor: '#ffffff',
    color: '#091426',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  } as React.CSSProperties,
  tabBtnActiveGreen: {
    backgroundColor: '#006c49',
    color: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,108,73,0.3)',
  } as React.CSSProperties,
  // Date filter
  dateFilterBar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e5e9',
    borderRadius: '10px',
    marginBottom: '20px',
  },
  dateFilterLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  quickBtns: {
    display: 'flex',
    gap: '4px',
  },
  quickBtn: {
    padding: '5px 14px',
    fontSize: '12px',
    fontWeight: 600,
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    color: '#45474c',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as React.CSSProperties,
  quickBtnActive: {
    backgroundColor: '#091426',
    color: '#fff',
    borderColor: '#091426',
  } as React.CSSProperties,
  dateInputs: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  dateInput: {
    padding: '5px 10px',
    fontSize: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    color: '#091426',
    fontFamily: 'inherit',
    outline: 'none',
  } as React.CSSProperties,
  dateFilterSummary: {
    fontSize: '11px',
    color: '#8191a9',
    paddingLeft: '28px',
  },
  // Dashboard grid
  dashboardGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '24px',
    alignItems: 'stretch',
  },
  // P&L
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
  // Production
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
  // Activities
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
  // Form styles (for actual revenue)
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  formLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#45474c',
  },
  formInput: {
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    color: '#091426',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
  } as React.CSSProperties,
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#006c49',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as React.CSSProperties,
  successMsg: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#006c49',
    fontWeight: 600,
    padding: '6px 10px',
    backgroundColor: '#ecfdf5',
    borderRadius: '6px',
    border: '1px solid #a7f3d0',
  },
  // History items
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #eceef0',
    borderRadius: '6px',
    gap: '8px',
  },
  historyLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0,
  },
  historySourceDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  historyInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  historyTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historySource: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#091426',
  },
  historyAmount: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#006c49',
  },
  historyBottom: {
    display: 'flex',
    gap: '6px',
    fontSize: '11px',
    color: '#8191a9',
    overflow: 'hidden',
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: '#ba1a1a',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color 0.15s ease',
  } as React.CSSProperties,
};
