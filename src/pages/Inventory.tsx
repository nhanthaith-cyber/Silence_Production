import React, { useState, useRef, useMemo } from 'react';
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




  interface InventoryItem {
    sku: string;
    name: string;
    inProduction: number;
    sold: number;
    totalDelivered: number;   // Tổng đã trả từ xưởng
    available: number;
    isLowStock: boolean;
    stockSource: 'nhanh' | 'delivered'; // Nguồn tính tồn
  }

  // State for search and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Calculate inventory metrics by product
  const inventoryData: InventoryItem[] = useMemo(() => {
    return products.map((prod) => {
      // 1. inProduction = Số lượng CÒN LẠI đang ở xưởng (chưa trả về)
      //    = quantity - deliveredQty (cho mỗi item của running batches)
      //    Nếu item chưa có deliveredQty → toàn bộ quantity vẫn đang ở xưởng
      const inProduction = productionBatches
        .filter((b) => b.status === 'running')
        .reduce((sum, b) => {
          const itemRemaining = b.items
            .filter((i) => i.productSku === prod.sku)
            .reduce((s, i) => {
              const delivered = i.deliveredQty ?? 0;
              return s + Math.max(0, i.quantity - delivered);
            }, 0);
          return sum + itemRemaining;
        }, 0);

      // 2. totalDelivered = Tổng hàng TỐT đã nhận từ xưởng (deliveredQty − defectQty)
      //    Backward compat: item chưa có deliveredQty → fallback về quantity của completed batch
      const totalDelivered = productionBatches.reduce((sum, b) => {
        const itemDelivered = b.items
          .filter((i) => i.productSku === prod.sku)
          .reduce((s, i) => {
            if (i.deliveredQty !== undefined) {
              const good = i.deliveredQty - (i.defectQty ?? 0);
              return s + Math.max(0, good);
            }
            // Nếu chưa có deliveredQty: chỉ tính khi batch đã completed
            if (b.status === 'completed') return s + i.quantity;
            return s;
          }, 0);
        return sum + itemDelivered;
      }, 0);

      // 3. Sold = Sales quantity
      const sold = sales
        .filter((s) => s.productSku === prod.sku)
        .reduce((sum, s) => sum + s.quantity, 0);

      // 4. Available = Tồn kho chuẩn
      // Chỉ dùng nhanhStock khi đã sync và có giá trị đáng tin cậy (không phải undefined/null)
      // Nếu chưa sync Nhanh.vn: Tồn = Tổng đã trả từ xưởng - Đã bán
      const useNhanh = prod.nhanhStock !== undefined && prod.nhanhStock !== null;
      const available = useNhanh ? prod.nhanhStock! : Math.max(0, totalDelivered - sold);

      return {
        sku: prod.sku,
        name: prod.name,
        inProduction,
        sold,
        totalDelivered,
        available,
        isLowStock: available < 20,
        stockSource: useNhanh ? 'nhanh' : 'delivered',
      };
    });
  }, [products, productionBatches, sales]);

  // Filter inventoryData based on search term
  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return inventoryData;
    return inventoryData.filter(
      (item: InventoryItem) => item.sku.toLowerCase().includes(term) || item.name.toLowerCase().includes(term)
    );
  }, [inventoryData, searchTerm]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

  // Calculate totals (always on total inventoryData)
  const totalAvailable = useMemo(() => inventoryData.reduce((sum: number, d: InventoryItem) => sum + d.available, 0), [inventoryData]);
  const totalInProduction = useMemo(() => inventoryData.reduce((sum: number, d: InventoryItem) => sum + d.inProduction, 0), [inventoryData]);
  const totalSold = useMemo(() => inventoryData.reduce((sum: number, d: InventoryItem) => sum + d.sold, 0), [inventoryData]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

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
          <div className="kpi-label">Còn lại tại xưởng</div>
          <div className="kpi-value mono" style={{ color: '#b45309' }}>{formatNumber(totalInProduction)}</div>
          <div className="kpi-desc" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <PackagePlus size={14} style={{ color: '#b45309' }} />
            <span>Đặt nhưng chưa nhận về (quantity − đã trả)</span>
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
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid #eceef0' }}>
          <h3 style={{ margin: 0 }}>Chi tiết số lượng tồn kho theo SKU</h3>
          <span style={{ fontSize: '12px', color: '#8191a9', fontWeight: 600 }}>Cảnh báo mức tồn thấp: &lt; 20 SP</span>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #eceef0', display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Tìm kiếm SKU:</span>
          <input
            type="text"
            placeholder="Nhập mã SKU hoặc tên sản phẩm để tìm..."
            value={searchTerm}
            onChange={handleSearchChange}
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              backgroundColor: '#ffffff',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#1e293b',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline'
              }}
            >
              Xóa lọc
            </button>
          )}
        </div>

        <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Mã SKU</th>
                <th>Tên Sản Phẩm</th>
                <th style={{ textAlign: 'right' }}>Đang sản xuất</th>
                <th style={{ textAlign: 'right' }}>Đã trả từ xưởng</th>
                <th style={{ textAlign: 'right' }}>Khả dụng</th>
                <th style={{ textAlign: 'right' }}>Đã xuất bán</th>
                <th>Tồn nguồn</th>
                <th>Trạng thái tồn</th>
                <th>Đồng bộ Nhanh</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: '#8191a9', padding: '24px' }}>
                    {searchTerm ? 'Không tìm thấy sản phẩm nào khớp với từ khóa tìm kiếm.' : 'Chưa có sản phẩm nào trong hệ thống.'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((data) => (
                  <tr key={data.sku}>
                    <td className="mono" style={{ fontWeight: 600 }}>{data.sku}</td>
                    <td style={{ fontWeight: 500 }}>{data.name}</td>
                    <td className="mono" style={{ textAlign: 'right', color: data.inProduction > 0 ? '#b45309' : '#75777d', fontWeight: data.inProduction > 0 ? 600 : 400 }}>
                      {formatNumber(data.inProduction)}
                    </td>
                    {/* Cột Đã trả từ xưởng */}
                    <td className="mono" style={{ textAlign: 'right', color: data.totalDelivered > 0 ? '#006c49' : '#75777d', fontWeight: data.totalDelivered > 0 ? 700 : 400 }}>
                      {data.totalDelivered > 0 ? formatNumber(data.totalDelivered) : '—'}
                    </td>
                    {/* Cột Khả dụng với badge nguồn */}
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: data.isLowStock ? '#ba1a1a' : '#091426' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        {formatNumber(data.available)}
                      </div>
                    </td>
                    <td className="mono" style={{ textAlign: 'right', color: '#75777d' }}>
                      {formatNumber(data.sold)}
                    </td>
                    {/* Cột nguồn tồn */}
                    <td>
                      {data.stockSource === 'nhanh' ? (
                        <span style={{ fontSize: '11px', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, border: '1px solid #bfdbfe' }}>
                          Nhanh.vn
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', backgroundColor: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                          Từ xưởng
                        </span>
                      )}
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            borderTop: '1px solid #eceef0',
            backgroundColor: '#f8fafc'
          }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} trên tổng số {filteredData.length} SKU
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px', minWidth: 'auto', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                Trước
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className="btn"
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    minWidth: '28px',
                    backgroundColor: currentPage === page ? '#091426' : '#ffffff',
                    color: currentPage === page ? '#ffffff' : '#091426',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    fontWeight: currentPage === page ? 700 : 500
                  }}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px', minWidth: 'auto', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                Sau
              </button>
            </div>
          </div>
        )}
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
