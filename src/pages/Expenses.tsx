import React, { useState, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import type { ExpenseCategory, ExcelImportResult } from '../types';
import { formatCurrency } from '../utils/formatters';
import { RefreshCw, Plus, Check, AlertCircle, FileSpreadsheet, FileDown, Upload, CheckCircle2 } from 'lucide-react';
import {
  exportExpensesToExcel,
  generateExpensesTemplate,
  exportSalesToExcel,
  generateSalesTemplate,
  importFromExcel
} from '../services/excelDataService';

export const Expenses: React.FC = () => {
  const {
    products, expenses, sales, addExpense, syncSalesFromNhanh, syncStockFromNhanh, connectionStatus,
    importAllData, productionBatches
  } = useApp();

  // Expense form states
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [expenseSuccess, setExpenseSuccess] = useState(false);

  // Sync states
  const [syncStatus, setSyncStatus] = useState<{ qty: number; success: boolean; extraInfo?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFromDate, setSyncFromDate] = useState('');
  const [syncToDate, setSyncToDate] = useState('');

  // Sales tab
  const [salesTab, setSalesTab] = useState<'orders' | 'products'>('orders');

  // Excel states
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState<ExcelImportResult | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);
  const [excelImportMode, setExcelImportMode] = useState<'append' | 'overwrite'>('append');
  const [showExcelConfirm, setShowExcelConfirm] = useState(false);
  const [excelTarget, setExcelTarget] = useState<'sales' | 'expenses'>('expenses');

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'sales' | 'expenses') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (excelFileInputRef.current) excelFileInputRef.current.value = '';
    setExcelTarget(target);
    setIsParsingExcel(true);
    setExcelError(null);
    setExcelPreview(null);
    setExcelSuccess(null);
    try {
      const result = await importFromExcel(file);
      setExcelPreview(result);
      setShowExcelConfirm(true);
    } catch (err) {
      setExcelError((err as Error).message);
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelPreview) return;
    
    let finalSales = sales;
    let finalExpenses = expenses;

    if (excelTarget === 'sales') {
      finalSales = excelImportMode === 'overwrite'
        ? excelPreview.sales
        : [
            ...sales,
            ...excelPreview.sales.filter(s => !sales.find(es => es.id === s.id))
          ];
    } else {
      finalExpenses = excelImportMode === 'overwrite'
        ? excelPreview.expenses
        : [
            ...expenses,
            ...excelPreview.expenses.filter(ex => !expenses.find(ee => ee.id === ex.id))
          ];
    }

    const jsonStr = JSON.stringify({
      version: '1.0',
      exportedAt: excelPreview.parsedAt,
      products,
      productionBatches,
      sales: finalSales,
      expenses: finalExpenses,
    });

    const result = await importAllData(jsonStr);
    if (result.success) {
      const mode = excelImportMode === 'overwrite' ? 'Ghi đè' : 'Thêm mới';
      const targetLabel = excelTarget === 'sales' ? 'đơn bán hàng' : 'chi phí';
      const count = excelTarget === 'sales' ? excelPreview.sales.length : excelPreview.expenses.length;
      setExcelSuccess(`✅ [${mode}] Import ${targetLabel} thành công: ${count} dòng.`);
      setShowExcelConfirm(false);
      setExcelPreview(null);
      setTimeout(() => window.location.reload(), 3000);
    } else {
      setExcelError(`Lỗi import: ${result.error}`);
      setShowExcelConfirm(false);
    }
  };


  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseSuccess(false);

    if (!amount || parseInt(amount) <= 0) return;

    addExpense({
      category,
      amount: parseInt(amount),
      notes: notes || 'Chi phí vận hành',
    });

    setAmount('');
    setNotes('');
    setExpenseSuccess(true);
    setTimeout(() => setExpenseSuccess(false), 3000);
  };

  /** Đồng bộ đơn hàng từ Nhanh.vn — tất cả các nguồn: Shopee, Tiktok, Lên ngoài */
  const handleSyncNhanh = async () => {
    setIsSyncing(true);
    setSyncStatus(null);

    try {
      const qty = await syncSalesFromNhanh(
        syncFromDate || undefined,
        syncToDate || undefined
      );
      const stockCount = await syncStockFromNhanh();
      setSyncStatus({
        qty,
        success: true,
        extraInfo: stockCount > 0
          ? `Đồng thời cập nhật tồn kho từ Nhanh.vn cho ${stockCount} sản phẩm.`
          : undefined,
      });
    } catch (err) {
      console.error(err);
      setSyncStatus({
        qty: 0,
        success: false,
        extraInfo: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const catNames: Record<ExpenseCategory, string> = {
    labor: 'Nhân công',
    rent: 'Mặt bằng',
    ads: 'Quảng cáo/Marketing',
    shipping: 'Vận chuyển',
    material: 'Nguyên phụ liệu',
    processing: 'Gia công',
    other: 'Khác',
  };

  /** Tên hiển thị cho nguồn đơn hàng */
  const sourceLabel = (source: string) => {
    switch (source) {
      case 'shopee': return 'Shopee';
      case 'tiktok': return 'TikTok';
      case 'offline': return 'Lên ngoài';
      case 'manual': return 'Nhập tay';
      case 'nhanh_vn': return 'Nhanh.vn';
      default: return source;
    }
  };

  const sourceBadgeClass = (source: string) => {
    switch (source) {
      case 'shopee': return 'badge-success';
      case 'tiktok': return 'badge-primary';
      case 'offline': return 'badge-warning';
      case 'manual': return 'badge-primary';
      default: return 'badge-primary';
    }
  };

  return (
    <div className="page-container fade-in">
      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700 }}>Chi phí phát sinh & Đồng bộ bán hàng</h2>
          <p style={{ color: '#8191a9', fontSize: '13px' }}>Nhập chi phí vận hành xưởng và đồng bộ đơn hàng từ Nhanh.vn (Shopee, TikTok, Lên ngoài)</p>
        </div>
      </div>

      <div style={styles.contentLayout}>
        {/* Left Side: Forms */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '300px' }}>
          {/* Expense logger */}
          <div className="card">
            <div className="card-header">
              <h3>Nhập chi phí vận hành</h3>
            </div>

            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Nhóm chi phí</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                  <option value="labor">Lương / Nhân công</option>
                  <option value="rent">Mặt bằng / Thuê xưởng</option>
                  <option value="ads">Quảng cáo / Marketing</option>
                  <option value="shipping">Vận chuyển / Logistics</option>
                  <option value="material">Nguyên phụ liệu (Chỉ tính dòng tiền thực)</option>
                  <option value="processing">Gia công (Chỉ tính dòng tiền thực)</option>
                  <option value="other">Chi phí khác</option>
                </select>
              </div>

              <div className="form-group">
                <label>Số tiền chi (VND)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ví dụ: 500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Ghi chú chi tiết</label>
                <textarea
                  placeholder="Mô tả mục đích chi..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ height: '80px', resize: 'none' }}
                />
              </div>

              {expenseSuccess && (
                <div style={styles.successAlert}>
                  <Check size={16} />
                  <span>Đã ghi nhận chi phí thành công!</span>
                </div>
              )}

              <button type="submit" className="btn btn-primary">
                <Plus size={16} />
                <span>Ghi nhận chi phí</span>
              </button>
            </form>

            <div style={{ margin: '20px 0', borderTop: '1px dashed #eceef0' }}></div>

            {/* ── Sleek Excel Card for Expenses ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#091426', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={16} color="#006c49" /> Cập nhật chi phí qua Excel
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={generateExpensesTemplate}
                  className="btn btn-secondary"
                  style={{ gap: '6px', fontSize: '12px', padding: '6px 8px' }}
                >
                  <FileDown size={12} /> Template
                </button>
                <button
                  type="button"
                  onClick={() => exportExpensesToExcel(expenses)}
                  className="btn btn-secondary"
                  style={{ gap: '6px', fontSize: '12px', padding: '6px 8px' }}
                >
                  <FileSpreadsheet size={12} /> Xuất Excel
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExcelTarget('expenses');
                  excelFileInputRef.current?.click();
                }}
                className="btn btn-primary"
                disabled={isParsingExcel}
                style={{ width: '100%', gap: '6px', fontSize: '12px', padding: '8px', backgroundColor: '#006c49', borderColor: '#006c49' }}
              >
                {isParsingExcel && excelTarget === 'expenses'
                  ? <><RefreshCw size={12} className="spin-anim" /><span>Đang đọc...</span></>
                  : <><Upload size={12} /><span>Import Excel Chi phí</span></>}
              </button>
            </div>
          </div>

          {/* Sync from Nhanh.vn */}
          <div className="card">
            <div className="card-header">
              <h3>Đồng bộ đơn hàng từ Nhanh.vn</h3>
              <span className={`badge ${connectionStatus === 'connected' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
                {connectionStatus === 'connected' ? 'Live' : 'Sandbox'}
              </span>
            </div>
            
            <p style={{ fontSize: '13px', color: '#45474c', lineHeight: 1.5 }}>
              Tải về đơn hàng mới nhất từ tất cả kênh bán hàng trên Nhanh.vn: <strong>Shopee</strong>, <strong>TikTok</strong>, <strong>Lên ngoài</strong>. Dữ liệu tự động phân loại theo nguồn.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0', borderTop: '1px dashed #eceef0', paddingTop: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#091426' }}>Khoảng thời gian đồng bộ:</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#8191a9', fontWeight: 500 }}>Từ ngày</label>
                  <input
                    type="date"
                    value={syncFromDate}
                    onChange={(e) => setSyncFromDate(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '13px',
                      border: '1px solid #eceef0',
                      borderRadius: '8px',
                      outline: 'none',
                      backgroundColor: '#f8f9fa',
                      color: '#091426',
                    }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#8191a9', fontWeight: 500 }}>Đến ngày</label>
                  <input
                    type="date"
                    value={syncToDate}
                    onChange={(e) => setSyncToDate(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '13px',
                      border: '1px solid #eceef0',
                      borderRadius: '8px',
                      outline: 'none',
                      backgroundColor: '#f8f9fa',
                      color: '#091426',
                    }}
                  />
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#8191a9', fontStyle: 'italic' }}>
                * Để trống để tự động quét 7 ngày gần nhất.
              </span>
            </div>

            <button
              onClick={handleSyncNhanh}
              className="btn btn-primary"
              disabled={isSyncing}
              style={{ width: '100%', gap: '8px', marginTop: '4px' }}
            >
              <RefreshCw size={14} className={isSyncing ? 'spin-anim' : ''} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ đơn hàng từ Nhanh.vn'}</span>
            </button>

            {syncStatus && (
              <div style={!syncStatus.success ? styles.syncErrorBox : (syncStatus.qty > 0 ? styles.syncSuccessBox : styles.syncEmptyBox)}>
                {!syncStatus.success ? (
                  <AlertCircle size={16} style={{ color: '#ba1a1a', flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <Check size={16} style={{ color: syncStatus.qty > 0 ? '#006c49' : '#b45309', flexShrink: 0, marginTop: '2px' }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>
                    {!syncStatus.success
                      ? 'Lỗi đồng bộ API Nhanh.vn!'
                      : syncStatus.qty > 0
                      ? `Đồng bộ thành công: Tải về ${syncStatus.qty} đơn hàng mới.`
                      : `Không có đơn hàng mới (hoặc tất cả đã được đồng bộ trước đó).`}
                  </span>
                  {syncStatus.extraInfo && (
                    <span style={{ fontSize: '12px', opacity: 0.85, fontWeight: 400 }}>
                      {syncStatus.extraInfo}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div style={{ margin: '20px 0', borderTop: '1px dashed #eceef0' }}></div>

            {/* ── Sleek Excel Card for Sales ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#091426', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={16} color="#1a56db" /> Cập nhật đơn hàng qua Excel
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={generateSalesTemplate}
                  className="btn btn-secondary"
                  style={{ gap: '6px', fontSize: '12px', padding: '6px 8px' }}
                >
                  <FileDown size={12} /> Template
                </button>
                <button
                  type="button"
                  onClick={() => exportSalesToExcel(sales)}
                  className="btn btn-secondary"
                  style={{ gap: '6px', fontSize: '12px', padding: '6px 8px' }}
                >
                  <FileSpreadsheet size={12} /> Xuất Excel
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExcelTarget('sales');
                  excelFileInputRef.current?.click();
                }}
                className="btn btn-primary"
                disabled={isParsingExcel}
                style={{ width: '100%', gap: '6px', fontSize: '12px', padding: '8px', backgroundColor: '#1a56db', borderColor: '#1a56db' }}
              >
                {isParsingExcel && excelTarget === 'sales'
                  ? <><RefreshCw size={12} className="spin-anim" /><span>Đang đọc...</span></>
                  : <><Upload size={12} /><span>Import Excel Đơn hàng</span></>}
              </button>
            </div>

            {excelError && (
              <div style={{ ...styles.errorAlert, marginTop: '12px' }}>
                <AlertCircle size={14} />
                <span>{excelError}</span>
              </div>
            )}

            {excelSuccess && (
              <div style={{
                padding: '10px 12px',
                backgroundColor: '#e6f6ef',
                color: '#006c49',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '12px'
              }}>
                <CheckCircle2 size={14} />
                <span>{excelSuccess}</span>
              </div>
            )}

            <input
              ref={excelFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleExcelFileChange(e, excelTarget)}
              style={{ display: 'none' }}
            />

            {/* ── Excel Confirm Modal ── */}
            {showExcelConfirm && excelPreview && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(9, 20, 38, 0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 9999, padding: '16px'
              }}>
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: '24px',
                  maxWidth: '480px',
                  width: '100%',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  display: 'flex', flexDirection: 'column', gap: '16px'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#091426', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #eceef0', paddingBottom: '12px' }}>
                    <FileSpreadsheet size={20} color={excelTarget === 'sales' ? '#1a56db' : '#006c49'} />
                    Xác nhận import Excel {excelTarget === 'sales' ? 'đơn hàng' : 'chi phí'}
                  </div>
                  
                  <div style={{ fontSize: '13px', color: '#45474c' }}>
                    Đọc được: <strong style={{ color: '#006c49' }}>
                      {excelTarget === 'sales' ? `${excelPreview.sales.length} đơn hàng` : `${excelPreview.expenses.length} khoản chi phí`}
                    </strong> từ file Excel.
                  </div>

                  {excelPreview.warnings.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '10px', borderRadius: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                      {excelPreview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#334155' }}>Chọn chế độ import:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <label style={{
                        display: 'flex', gap: '8px', padding: '10px', border: `1px solid ${excelImportMode === 'overwrite' ? '#ba1a1a' : '#eceef0'}`,
                        borderRadius: '8px', cursor: 'pointer', background: excelImportMode === 'overwrite' ? '#ffdad633' : '#f8fafc'
                      }}>
                        <input type="radio" name="excelTargetMode" value="overwrite"
                          checked={excelImportMode === 'overwrite'}
                          onChange={() => setExcelImportMode('overwrite')} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#ba1a1a', fontSize: '12px' }}>Ghi đè</div>
                          <div style={{ fontSize: '10px', color: '#8191a9', marginTop: '2px' }}>Xóa dữ liệu cũ</div>
                        </div>
                      </label>
                      
                      <label style={{
                        display: 'flex', gap: '8px', padding: '10px', border: `1px solid ${excelImportMode === 'append' ? '#006c49' : '#eceef0'}`,
                        borderRadius: '8px', cursor: 'pointer', background: excelImportMode === 'append' ? '#e6f6ef33' : '#f8fafc'
                      }}>
                        <input type="radio" name="excelTargetMode" value="append"
                          checked={excelImportMode === 'append'}
                          onChange={() => setExcelImportMode('append')} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#006c49', fontSize: '12px' }}>Thêm mới</div>
                          <div style={{ fontSize: '10px', color: '#8191a9', marginTop: '2px' }}>Giữ cũ, thêm dòng mới</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button type="button" onClick={() => { setShowExcelConfirm(false); setExcelPreview(null); }} className="btn btn-secondary" style={{ flex: 1 }}>Hủy</button>
                    <button type="button" onClick={handleConfirmExcelImport} className="btn btn-primary" style={{ flex: 1, backgroundColor: '#091426' }}>Xác nhận</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Lists */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '320px' }}>
          {/* Sales History — Tabbed */}
          <div className="card">
            <div className="card-header">
              <h3>Lịch sử bán hàng</h3>
              <span className="badge badge-primary">{sales.length} Đơn hàng</span>
            </div>

            {/* ── Slide Tab Bar ── */}
            <div style={tabStyles.tabTrack}>
              <div
                style={{
                  ...tabStyles.tabSlider,
                  transform: salesTab === 'orders' ? 'translateX(0%)' : 'translateX(100%)',
                }}
              />
              <button
                style={{
                  ...tabStyles.tabBtn,
                  color: salesTab === 'orders' ? '#fff' : '#8191a9',
                  fontWeight: salesTab === 'orders' ? 700 : 500,
                }}
                onClick={() => setSalesTab('orders')}
              >
                📋 Đơn hàng
              </button>
              <button
                style={{
                  ...tabStyles.tabBtn,
                  color: salesTab === 'products' ? '#fff' : '#8191a9',
                  fontWeight: salesTab === 'products' ? 700 : 500,
                }}
                onClick={() => setSalesTab('products')}
              >
                📦 Sản phẩm bán
              </button>
            </div>

            {/* ── Tab: Đơn hàng ── */}
            {salesTab === 'orders' && (() => {
              // Group sales by orderId (fallback to id nếu chưa có orderId)
              const orderMap: Map<string, typeof sales> = new Map();
              sales.forEach((sale) => {
                const key = sale.orderId || sale.id;
                if (!orderMap.has(key)) orderMap.set(key, []);
                orderMap.get(key)!.push(sale);
              });

              const orderGroups = Array.from(orderMap.entries())
                .sort(([, a], [, b]) => b[0].saleDate.localeCompare(a[0].saleDate));

              const statusLabel = (s?: string) => {
                if (!s) return '—';
                const map: Record<string, string> = {
                  success: 'Hoàn thành', completed: 'Hoàn thành', done: 'Hoàn thành',
                  cancelled: 'Đã hủy', cancel: 'Đã hủy',
                  shipping: 'Đang giao', delivering: 'Đang giao',
                  pending: 'Chờ xử lý', new: 'Mới',
                  returned: 'Hoàn hàng',
                };
                return map[s.toLowerCase()] || s;
              };

              const statusColor = (s?: string) => {
                if (!s) return '#8191a9';
                const l = s.toLowerCase();
                if (['success','completed','done'].includes(l)) return '#006c49';
                if (['cancelled','cancel','returned'].includes(l)) return '#ba1a1a';
                if (['shipping','delivering'].includes(l)) return '#1a56db';
                return '#b45309';
              };

              return (
                <div className="table-container" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  <table style={{ tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                      <col style={{ width: '130px' }} />  {/* ID đơn */}
                      <col style={{ width: '100px' }} />  {/* SKU */}
                      <col />                             {/* Tên SP */}
                      <col style={{ width: '90px' }} />   {/* Giá sau CK */}
                      <col style={{ width: '50px' }} />   {/* SL */}
                      <col style={{ width: '100px' }} />  {/* Tổng đơn */}
                      <col style={{ width: '90px' }} />   {/* CP sàn */}
                      <col style={{ width: '90px' }} />   {/* Trạng thái */}
                    </colgroup>
                    <thead>
                      <tr>
                        <th>ID Đơn hàng</th>
                        <th>SKU</th>
                        <th>Tên sản phẩm</th>
                        <th style={{ textAlign: 'right' }}>Giá sau CK</th>
                        <th style={{ textAlign: 'center' }}>SL</th>
                        <th style={{ textAlign: 'right' }}>Tổng đơn</th>
                        <th style={{ textAlign: 'right' }}>CP sàn</th>
                        <th style={{ textAlign: 'center' }}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderGroups.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: '#8191a9', padding: '32px' }}>
                            Chưa có đơn hàng. Nhấn "Đồng bộ" để tải từ Nhanh.vn.
                          </td>
                        </tr>
                      ) : (
                        orderGroups.map(([orderId, items]) => {
                          const firstItem = items[0];
                          const totalVal = firstItem.totalOrderValue
                            ?? items.reduce((s, i) => s + (i.discountedPrice ?? i.unitPrice) * i.quantity, 0);
                          const fee = firstItem.platformFee ?? 0;
                          const status = firstItem.orderStatus;
                          const isMulti = items.length > 1;

                          return items.map((sale, idx) => {
                            const prod = products.find((p) => p.sku === sale.productSku);
                            const effectivePrice = sale.discountedPrice ?? sale.unitPrice;
                            const isFirst = idx === 0;

                            return (
                              <tr
                                key={sale.id}
                                style={{
                                  borderTop: isFirst ? '2px solid #e0e7f0' : undefined,
                                  background: isFirst && isMulti ? '#fafbff' : undefined,
                                }}
                              >
                                {/* ID đơn — chỉ hiển thị ở dòng đầu */}
                                <td className="mono" style={{ fontSize: '10px', color: '#45474c', verticalAlign: 'middle' }}>
                                  {isFirst ? (
                                    <div>
                                      <div style={{ fontWeight: 600, color: '#091426', fontSize: '11px' }}>{orderId}</div>
                                      <div style={{ color: '#8191a9', fontSize: '10px', marginTop: '2px' }}>{sale.saleDate}</div>
                                      <div style={{ marginTop: '3px' }}>
                                        <span className={`badge ${sourceBadgeClass(sale.source)}`} style={{ fontSize: '9px' }}>
                                          {sourceLabel(sale.source)}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ paddingLeft: '8px', borderLeft: '2px solid #e8edf4', color: '#c0c8d4', fontSize: '10px' }}>
                                      └ dòng {idx + 1}
                                    </div>
                                  )}
                                </td>

                                {/* SKU */}
                                <td className="mono" style={{ fontSize: '11px', color: '#1a56db', fontWeight: 600 }}>
                                  {sale.productSku}
                                </td>

                                {/* Tên sản phẩm */}
                                <td style={{ fontSize: '12px', fontWeight: 500 }}>
                                  {prod?.name || sale.productSku}
                                </td>

                                {/* Giá sau chiết khấu */}
                                <td className="mono" style={{ textAlign: 'right', fontSize: '12px' }}>
                                  {formatCurrency(effectivePrice)}
                                  {effectivePrice < sale.unitPrice && (
                                    <div style={{ fontSize: '10px', color: '#b45309', textDecoration: 'line-through' }}>
                                      {formatCurrency(sale.unitPrice)}
                                    </div>
                                  )}
                                </td>

                                {/* Số lượng */}
                                <td className="mono" style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
                                  {sale.quantity}
                                </td>

                                {/* Tổng giá trị đơn — chỉ hiện ở dòng đầu */}
                                <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: '#006c49', fontSize: '13px', verticalAlign: 'middle' }}>
                                  {isFirst ? (
                                    <div>
                                      {formatCurrency(totalVal)}
                                      {isMulti && (
                                        <div style={{ fontSize: '9px', color: '#8191a9', fontWeight: 400 }}>
                                          {items.length} sản phẩm
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </td>

                                {/* Chi phí sàn — chỉ hiện ở dòng đầu */}
                                <td className="mono" style={{ textAlign: 'right', fontSize: '12px', color: '#ba1a1a', verticalAlign: 'middle' }}>
                                  {isFirst ? (fee > 0 ? formatCurrency(fee) : <span style={{ color: '#c0c8d4' }}>—</span>) : null}
                                </td>

                                {/* Trạng thái — chỉ hiện ở dòng đầu */}
                                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                  {isFirst ? (
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: '20px',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      color: statusColor(status),
                                      background: statusColor(status) + '18',
                                      border: `1px solid ${statusColor(status)}33`,
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {statusLabel(status)}
                                    </span>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          });
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}


            {/* ── Tab: Sản phẩm bán ── */}
            {salesTab === 'products' && (() => {
              // Gom nhóm theo SKU
              const grouped: Record<string, { name: string; sku: string; totalQty: number; totalRevenue: number }> = {};
              sales.forEach((sale) => {
                const prod = products.find((p) => p.sku === sale.productSku);
                if (!grouped[sale.productSku]) {
                  grouped[sale.productSku] = {
                    sku: sale.productSku,
                    name: prod?.name || sale.productSku,
                    totalQty: 0,
                    totalRevenue: 0,
                  };
                }
                grouped[sale.productSku].totalQty += sale.quantity;
                grouped[sale.productSku].totalRevenue += sale.quantity * sale.unitPrice;
              });
              const rows = Object.values(grouped).sort((a, b) => b.totalQty - a.totalQty);
              const totalQtyAll = rows.reduce((s, r) => s + r.totalQty, 0);

              return (
                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th>SL bán</th>
                        <th>% tổng</th>
                        <th>Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: '#8191a9', padding: '24px' }}>
                            Chưa có dữ liệu sản phẩm bán.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => {
                          const pct = totalQtyAll > 0 ? (row.totalQty / totalQtyAll) * 100 : 0;
                          return (
                            <tr key={row.sku}>
                              <td>
                                <div style={{ fontWeight: 500, fontSize: '13px' }}>{row.name}</div>
                                <div className="mono" style={{ fontSize: '11px', color: '#8191a9' }}>{row.sku}</div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="mono" style={{ fontWeight: 700, fontSize: '15px', color: '#091426', minWidth: '36px' }}>
                                    {row.totalQty}
                                  </span>
                                  {/* Mini progress bar */}
                                  <div style={{ flex: 1, height: '6px', background: '#eceef0', borderRadius: '3px', minWidth: '60px' }}>
                                    <div style={{
                                      height: '100%',
                                      width: `${pct}%`,
                                      background: 'linear-gradient(90deg, #091426, #1a4a8a)',
                                      borderRadius: '3px',
                                      transition: 'width 0.4s ease',
                                    }} />
                                  </div>
                                </div>
                              </td>
                              <td className="mono" style={{ fontSize: '12px', color: '#45474c' }}>
                                {pct.toFixed(1)}%
                              </td>
                              <td className="mono" style={{ fontWeight: 600, color: '#006c49', fontSize: '13px' }}>
                                {formatCurrency(row.totalRevenue)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  {rows.length > 0 && (
                    <div style={{ padding: '10px 16px', background: '#f7f9fb', borderTop: '1px solid #eceef0', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#091426' }}>
                      <span>Tổng cộng</span>
                      <span className="mono">{totalQtyAll} sản phẩm</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>


          {/* Expenses History */}
          <div className="card">
            <div className="card-header">
              <h3>Lịch sử chi phí vận hành</h3>
              <span className="badge badge-error">{formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}</span>
            </div>

            <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Mã khoản</th>
                    <th>Loại chi phí</th>
                    <th>Số tiền chi</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#8191a9', padding: '24px' }}>
                        Chưa ghi nhận chi phí. Nhập chi phí ở form bên trái.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td className="mono" style={{ fontSize: '12px' }}>{exp.expenseDate}</td>
                        <td className="mono" style={{ fontSize: '11px', color: '#8191a9' }}>{exp.id}</td>
                        <td>
                          <span className="badge badge-primary">{catNames[exp.category]}</span>
                        </td>
                        <td className="mono" style={{ fontWeight: 600, color: '#ba1a1a' }}>{formatCurrency(exp.amount)}</td>
                        <td style={{ fontSize: '13px' }}>{exp.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Global CSS spinner */}
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
  contentLayout: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '24px',
    alignItems: 'flex-start',
  },
  successAlert: {
    padding: '10px 12px',
    backgroundColor: '#e6f6ef',
    color: '#006c49',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  syncSuccessBox: {
    padding: '12px',
    backgroundColor: '#e6f6ef',
    color: '#006c49',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    lineHeight: 1.4,
    border: '1px solid #6cf8bb',
    marginTop: '8px',
  },
  syncEmptyBox: {
    padding: '12px',
    backgroundColor: '#fef3c7',
    color: '#b45309',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    lineHeight: 1.4,
    border: '1px solid #fcd34d',
    marginTop: '8px',
  },
  syncErrorBox: {
    padding: '12px',
    backgroundColor: '#ffdad6',
    color: '#ba1a1a',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    lineHeight: 1.4,
    border: '1px solid #ffb4ab',
    marginTop: '8px',
  },
  errorAlert: {
    padding: '10px 12px',
    backgroundColor: '#ffdad6',
    color: '#ba1a1a',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

const tabStyles = {
  tabTrack: {
    position: 'relative' as const,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    background: '#f0f2f5',
    borderRadius: '10px',
    padding: '4px',
    margin: '0 0 16px 0',
    gap: 0,
  },
  tabSlider: {
    position: 'absolute' as const,
    top: '4px',
    left: '4px',
    width: 'calc(50% - 4px)',
    height: 'calc(100% - 8px)',
    background: 'linear-gradient(135deg, #091426, #1e3a5f)',
    borderRadius: '7px',
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 2px 8px rgba(9,20,38,0.25)',
    pointerEvents: 'none' as const,
  },
  tabBtn: {
    position: 'relative' as const,
    zIndex: 1,
    padding: '9px 8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '7px',
    transition: 'color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    letterSpacing: '0.01em',
  },
};
