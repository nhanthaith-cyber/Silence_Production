import React, { useState, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import { formatNumber } from '../utils/formatters';
import { Boxes, PackagePlus, ShoppingBag, AlertTriangle, CheckCircle2, RefreshCw, FileSpreadsheet, FileDown, Upload, AlertCircle } from 'lucide-react';
import { exportInventoryToExcel, importFromExcel } from '../services/excelDataService';
import type { ExcelImportResult } from '../types';

export const Inventory: React.FC = () => {
  const {
    products, productionBatches, sales, syncStockFromNhanh, syncStockToNhanh,
    importAllData, expenses
  } = useApp();
  const [isSyncing, setIsSyncing] = useState(false);

  // Excel states
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState<ExcelImportResult | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);
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
    
    // Update nhanhStock of products
    const finalProducts = products.map(prod => {
      const match = excelPreview.products.find(p => p.sku === prod.sku);
      if (match) {
        return {
          ...prod,
          nhanhStock: match.nhanhStock
        };
      }
      return prod;
    });

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
      setExcelSuccess(`✅ Cập nhật tồn kho thành công cho ${excelPreview.products.length} SKU.`);
      setShowExcelConfirm(false);
      setExcelPreview(null);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setExcelError(`Lỗi import: ${result.error}`);
      setShowExcelConfirm(false);
    }
  };




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

      {/* ── Sleek Excel Card ── */}
      <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileSpreadsheet size={20} color="#006c49" />
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#091426', margin: 0 }}>Cập nhật tồn kho offline</h4>
            <p style={{ fontSize: '12px', color: '#8191a9', margin: 0 }}>Xuất báo cáo tồn kho hiện tại hoặc tải file Excel lên để cập nhật tồn kho (nhanhStock) cho các SKU.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => exportInventoryToExcel(inventoryData)}
            className="btn btn-secondary"
            style={{ gap: '6px', fontSize: '13px' }}
          >
            <FileDown size={14} />
            <span>Xuất báo cáo tồn kho</span>
          </button>
          
          <button
            onClick={() => excelFileInputRef.current?.click()}
            className="btn btn-primary"
            disabled={isParsingExcel}
            style={{ gap: '6px', fontSize: '13px', backgroundColor: '#006c49', borderColor: '#006c49' }}
          >
            {isParsingExcel ? <RefreshCw size={14} className="spin-anim" /> : <Upload size={14} />}
            <span>Cập nhật tồn từ Excel</span>
          </button>
          
          <input
            ref={excelFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {excelError && (
        <div style={{
          padding: '10px',
          backgroundColor: '#ffdad6',
          color: '#ba1a1a',
          borderRadius: '4px',
          fontSize: '13px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px'
        }}>
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
          marginBottom: '20px'
        }}>
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
              <FileSpreadsheet size={20} color="#006c49" /> Xác nhận cập nhật tồn kho
            </div>
            
            <div style={{ fontSize: '13px', color: '#45474c' }}>
              Hệ thống sẽ cập nhật số lượng tồn kho khả dụng cho <strong style={{ color: '#006c49' }}>{excelPreview.products.length} SKU</strong> từ file Excel.
            </div>

            {excelPreview.warnings.length > 0 && (
              <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '10px', borderRadius: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                {excelPreview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="button" onClick={() => { setShowExcelConfirm(false); setExcelPreview(null); }} className="btn btn-secondary" style={{ flex: 1 }}>Hủy</button>
              <button type="button" onClick={handleConfirmExcelImport} className="btn btn-primary" style={{ flex: 1, backgroundColor: '#091426' }}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

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
