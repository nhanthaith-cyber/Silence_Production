import React, { useState, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { formatCurrency } from '../utils/formatters';
import { Plus, Trash2, Check, AlertCircle, FileSpreadsheet, FileDown, Upload, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  exportProductsToExcel,
  generateProductsTemplate,
  importFromExcel
} from '../services/excelDataService';
import type { ExcelImportResult } from '../types';

export const Products: React.FC = () => {
  const { products, addProduct, deleteProduct, productionBatches, sales, syncStockFromNhanh, syncStockToNhanh, importAllData, expenses } = useApp();

  // Form states
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Excel states
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState<ExcelImportResult | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);
  const [excelImportMode, setExcelImportMode] = useState<'append' | 'overwrite'>('append');
  const [showExcelConfirm, setShowExcelConfirm] = useState(false);

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (excelFileInputRef.current) excelFileInputRef.current.value = '';
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

  const handleConfirmExcelImport = () => {
    if (!excelPreview) return;
    
    // Merge or Overwrite products
    const finalProducts = excelImportMode === 'overwrite'
      ? excelPreview.products
      : [
          ...products,
          ...excelPreview.products.filter(p => !products.find(ep => ep.sku === p.sku))
        ];

    // For other entities, keep them intact
    const jsonStr = JSON.stringify({
      version: '1.0',
      exportedAt: excelPreview.parsedAt,
      products: finalProducts,
      productionBatches,
      sales,
      expenses,
    });

    const result = importAllData(jsonStr);
    if (result.success) {
      const mode = excelImportMode === 'overwrite' ? 'Ghi đè' : 'Thêm mới';
      setExcelSuccess(`✅ [${mode}] Import sản phẩm thành công: ${excelPreview.products.length} sản phẩm.`);
      setShowExcelConfirm(false);
      setExcelPreview(null);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setExcelError(`Lỗi import: ${result.error}`);
      setShowExcelConfirm(false);
    }
  };


  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!sku) {
      setError('Mã SKU không được để trống!');
      return;
    }
    if (!name) {
      setError('Tên sản phẩm không được để trống!');
      return;
    }
    if (!cost || parseInt(cost) <= 0) {
      setError('Chi phí sản xuất định mức phải lớn hơn 0!');
      return;
    }
    if (!price || parseInt(price) <= 0) {
      setError('Giá bán đề xuất phải lớn hơn 0!');
      return;
    }

    const res = addProduct({
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      defaultCost: parseInt(cost),
      defaultPrice: parseInt(price),
    });

    if (!res.success) {
      setError(res.error || 'Đã xảy ra lỗi!');
    } else {
      setSuccess(true);
      setSku('');
      setName('');
      setCost('');
      setPrice('');
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handleDelete = (skuToDelete: string) => {
    // Check if product is referenced in production or sales
    const isUsedInProduction = productionBatches.some((b) => b.items.some((item) => item.productSku === skuToDelete));
    const isUsedInSales = sales.some((s) => s.productSku === skuToDelete);

    if (isUsedInProduction || isUsedInSales) {
      alert('Không thể xóa sản phẩm này vì đã tồn tại các lô sản xuất hoặc đơn hàng liên quan!');
      return;
    }

    if (confirm(`Bạn chắc chắn muốn xóa sản phẩm SKU: ${skuToDelete}?`)) {
      deleteProduct(skuToDelete);
    }
  };



  return (
    <div className="page-container fade-in">
      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700 }}>Danh mục sản phẩm</h2>
          <p style={{ color: '#8191a9', fontSize: '13px' }}>Định nghĩa danh sách sản phẩm, chi phí định mức đầu vào và giá bán mục tiêu</p>
        </div>
      </div>

      <div style={styles.contentLayout}>
        {/* Left Form */}
        <div className="card" style={{ flex: 1, minWidth: '280px', height: 'fit-content' }}>
          <div className="card-header">
            <h3>Thêm sản phẩm mới</h3>
          </div>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Mã định danh (SKU)</label>
              <input
                type="text"
                placeholder="Ví dụ: TS-CLASSIC-01"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                style={{ textTransform: 'uppercase' }}
                required
              />
            </div>

            <div className="form-group">
              <label>Tên sản phẩm</label>
              <input
                type="text"
                placeholder="Ví dụ: Áo thun Classic"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Giá vốn sản xuất dự kiến (VND)</label>
              <input
                type="number"
                min="1"
                placeholder="Ví dụ: 50000"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Giá bán mục tiêu (VND)</label>
              <input
                type="number"
                min="1"
                placeholder="Ví dụ: 150000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={styles.errorAlert}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div style={styles.successAlert}>
                <Check size={16} />
                <span>Thêm sản phẩm thành công!</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary">
              <Plus size={16} />
              <span>Thêm vào danh mục</span>
            </button>
          </form>

          <div style={{ margin: '20px 0', borderTop: '1px dashed #eceef0' }}></div>

          {/* ── Sleek Excel Card ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#091426', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={16} color="#006c49" /> Cập nhật qua Excel
            </h4>
            <p style={{ fontSize: '12px', color: '#8191a9', margin: 0, lineHeight: 1.4 }}>
              Xuất sản phẩm hiện tại, hoặc import sản phẩm hàng loạt bằng file Excel.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={generateProductsTemplate}
                className="btn btn-secondary"
                style={{ width: '100%', gap: '8px', justifyContent: 'center', fontSize: '12px', padding: '8px 12px' }}
              >
                <FileDown size={14} />
                <span>Tải template Excel mẫu</span>
              </button>

              <button
                type="button"
                onClick={() => exportProductsToExcel(products)}
                className="btn btn-secondary"
                style={{ width: '100%', gap: '8px', justifyContent: 'center', fontSize: '12px', padding: '8px 12px' }}
              >
                <FileSpreadsheet size={14} />
                <span>Xuất danh sách ra Excel</span>
              </button>

              <button
                type="button"
                onClick={() => excelFileInputRef.current?.click()}
                className="btn btn-primary"
                disabled={isParsingExcel}
                style={{ width: '100%', gap: '8px', justifyContent: 'center', fontSize: '12px', padding: '8px 12px', backgroundColor: '#1a56db', borderColor: '#1a56db' }}
              >
                {isParsingExcel
                  ? <><RefreshCw size={14} className="spin-anim" /><span>Đang đọc file...</span></>
                  : <><Upload size={14} /><span>Import từ file Excel (.xlsx)</span></>}
              </button>
              <input
                ref={excelFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {excelError && (
              <div style={styles.errorAlert}>
                <AlertCircle size={14} />
                <span>{excelError}</span>
              </div>
            )}

            {excelSuccess && (
              <div style={styles.successAlert}>
                <CheckCircle2 size={14} />
                <span>{excelSuccess}</span>
              </div>
            )}

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
                    <FileSpreadsheet size={20} color="#1a56db" /> Xác nhận import Excel sản phẩm
                  </div>
                  
                  <div style={{ fontSize: '13px', color: '#45474c' }}>
                    Đọc được: <strong style={{ color: '#006c49' }}>{excelPreview.products.length} sản phẩm</strong> từ file Excel.
                  </div>

                  {excelPreview.warnings.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '10px', borderRadius: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                      {excelPreview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#334155' }}>Chọn chế độ import sản phẩm:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <label style={{
                        display: 'flex', gap: '8px', padding: '10px', border: `1px solid ${excelImportMode === 'overwrite' ? '#ba1a1a' : '#eceef0'}`,
                        borderRadius: '8px', cursor: 'pointer', background: excelImportMode === 'overwrite' ? '#ffdad633' : '#f8fafc'
                      }}>
                        <input type="radio" name="excelProductMode" value="overwrite"
                          checked={excelImportMode === 'overwrite'}
                          onChange={() => setExcelImportMode('overwrite')} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#ba1a1a', fontSize: '12px' }}>Ghi đè</div>
                          <div style={{ fontSize: '10px', color: '#8191a9', marginTop: '2px' }}>Xóa sản phẩm cũ</div>
                        </div>
                      </label>
                      
                      <label style={{
                        display: 'flex', gap: '8px', padding: '10px', border: `1px solid ${excelImportMode === 'append' ? '#006c49' : '#eceef0'}`,
                        borderRadius: '8px', cursor: 'pointer', background: excelImportMode === 'append' ? '#e6f6ef33' : '#f8fafc'
                      }}>
                        <input type="radio" name="excelProductMode" value="append"
                          checked={excelImportMode === 'append'}
                          onChange={() => setExcelImportMode('append')} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#006c49', fontSize: '12px' }}>Thêm mới</div>
                          <div style={{ fontSize: '10px', color: '#8191a9', marginTop: '2px' }}>Chỉ thêm SKU mới</div>
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

        {/* Right Table */}
        <div className="card" style={{ flex: 2, minWidth: '320px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Danh sách sản phẩm hiện tại</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={async () => {
                  const count = await syncStockFromNhanh();
                  alert(`Đã nhận dữ liệu giá bán và kiểm tra SKU từ Nhanh.vn thành công! Cập nhật ${count} sản phẩm.`);
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Nhận giá từ Nhanh.vn
              </button>
              <span className="badge badge-primary">{products.length} Sản phẩm</span>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mã SKU</th>
                  <th>Tên Sản Phẩm</th>
                  <th>Giá Vốn SX</th>
                  <th>Giá Bán Target</th>
                  <th>Tồn khả dụng (Xưởng)</th>
                  <th>Biên LN</th>
                  <th>Đồng bộ Nhanh</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#8191a9', padding: '24px' }}>
                      Chưa có sản phẩm nào trong danh mục.
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => {
                    const potentialProfit = prod.defaultPrice - prod.defaultCost;
                    const margin = prod.defaultPrice > 0 ? (potentialProfit / prod.defaultPrice) * 100 : 0;

                    // Tính tồn kho khả dụng = Tổng số lượng của lô đã xong (ready) - Tổng số lượng đã bán
                    const totalReady = productionBatches
                      .filter(b => b.status === 'completed')
                      .reduce((sum, b) => {
                        const itemQty = b.items.filter(i => i.productSku === prod.sku).reduce((s, i) => s + i.quantity, 0);
                        return sum + itemQty;
                      }, 0);
                    const totalSold = sales
                      .filter(s => s.productSku === prod.sku)
                      .reduce((sum, s) => sum + s.quantity, 0);
                    const availableStock = Math.max(0, totalReady - totalSold);

                    return (
                      <tr key={prod.sku}>
                        <td className="mono" style={{ fontWeight: 600 }}>{prod.sku}</td>
                        <td style={{ fontWeight: 500 }}>{prod.name}</td>
                        <td className="mono">{formatCurrency(prod.defaultCost)}</td>
                        <td className="mono">{formatCurrency(prod.defaultPrice)}</td>
                        <td className="mono" style={{ fontWeight: 600, color: availableStock > 0 ? '#006c49' : '#8191a9' }}>
                          {availableStock} cái
                        </td>
                        <td className="mono" style={{ fontWeight: 600, color: '#006c49' }}>
                          +{margin.toFixed(1)}%
                        </td>
                        <td>
                          <button
                            onClick={async () => {
                              const ok = await syncStockToNhanh(prod.sku);
                              if (ok) {
                                alert(`Đã đẩy tồn kho của sản phẩm ${prod.sku} lên Nhanh.vn thành công (Số lượng khả dụng: ${availableStock} cái).`);
                              } else {
                                alert(`Lỗi khi đẩy tồn kho của sản phẩm ${prod.sku}`);
                              }
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                          >
                            Đẩy tồn lên Nhanh
                          </button>
                        </td>
                        <td>
                          <button
                            onClick={() => handleDelete(prod.sku)}
                            style={styles.deleteBtn}
                            title="Xóa khỏi danh mục"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
  contentLayout: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '24px',
    alignItems: 'flex-start',
  },
  errorAlert: {
    padding: '10px 12px',
    backgroundColor: '#ffdad6',
    color: '#ba1a1a',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#8191a9',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '4px',
    transition: 'all 0.15s ease',
  },
};
