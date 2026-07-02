import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';
import { formatCurrency } from '../utils/formatters';
import { Plus, Trash2, Check, AlertCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export const Products: React.FC = () => {
  const { products, addProduct, bulkAddProducts, deleteProduct, productionBatches, sales, syncStockFromNhanh, syncStockToNhanh } = useApp();

  // Form states
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Excel import state
  const [importResult, setImportResult] = useState<{
    successCount: number;
    duplicateCount: number;
    invalidCount: number;
    duplicates: string[];
    invalid: string[];
  } | null>(null);

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess(false);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        if (rows.length <= 1) {
          setError('File Excel không có dữ liệu hoặc chỉ có dòng tiêu đề!');
          return;
        }

        // Parse header and find columns
        const headers = (rows[0] as unknown[]).map(h => h?.toString().trim().toLowerCase() || '');
        
        const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('mã') || h.includes('ma'));
        const nameIdx = headers.findIndex(h => h.includes('tên') || h.includes('ten') || h.includes('name'));
        const costIdx = headers.findIndex(h => h.includes('vốn') || h.includes('von') || h.includes('cost') || h.includes('giá sản xuất'));
        const priceIdx = headers.findIndex(h => h.includes('bán') || h.includes('ban') || h.includes('price') || h.includes('giá bán'));

        if (skuIdx === -1 || nameIdx === -1) {
          setError('Không tìm thấy cột "Mã SKU" hoặc "Tên sản phẩm" trong file Excel. Vui lòng kiểm tra tiêu đề dòng đầu tiên.');
          return;
        }

        const importedProducts: any[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const skuVal = row[skuIdx]?.toString().trim();
          const nameVal = row[nameIdx]?.toString().trim();
          
          const parseNum = (val: any) => {
            if (val === null || val === undefined) return 0;
            if (typeof val === 'number') return val;
            const clean = val.toString().replace(/[^\d]/g, '');
            return parseInt(clean) || 0;
          };
          
          const defaultCost = costIdx !== -1 ? parseNum(row[costIdx]) : 0;
          const defaultPrice = priceIdx !== -1 ? parseNum(row[priceIdx]) : 0;

          if (skuVal && nameVal) {
            importedProducts.push({
              sku: skuVal,
              name: nameVal,
              defaultCost,
              defaultPrice,
            });
          }
        }

        if (importedProducts.length === 0) {
          setError('Không tìm thấy sản phẩm nào hợp lệ để import!');
          return;
        }

        const result = bulkAddProducts(importedProducts);
        setImportResult(result);
      } catch (err) {
        console.error('Lỗi khi đọc file Excel:', err);
        setError('Đã xảy ra lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file!');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Mã SKU': 'TS-CLASSIC-01',
        'Tên Sản Phẩm': 'Áo thun Classic',
        'Giá Vốn Sản Xuất (VND)': 50000,
        'Giá Bán Đề Xuất (VND)': 150000,
      },
      {
        'Mã SKU': 'TS-PREMIUM-02',
        'Tên Sản Phẩm': 'Áo thun Premium',
        'Giá Vốn Sản Xuất (VND)': 75000,
        'Giá Bán Đề Xuất (VND)': 250000,
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template SKU');
    XLSX.writeFile(wb, 'silence_sku_template.xlsx');
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

          <div style={{ margin: '20px 0', borderTop: '1px dashed var(--outline-variant)' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Import danh sách SKU từ Excel
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', margin: 0, lineHeight: 1.4 }}>
              Nhập hàng loạt sản phẩm nhanh chóng. File Excel cần có tiêu đề cột chứa các từ khóa: <strong>SKU / Mã</strong>, <strong>Tên sản phẩm</strong>, <strong>Giá vốn</strong>, <strong>Giá bán</strong>.
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <label className="btn btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 12px', fontSize: '12px', margin: 0 }}>
                <FileSpreadsheet size={16} style={{ color: '#006c49' }} />
                Chọn file Excel
                <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} style={{ display: 'none' }} />
              </label>
              <button onClick={downloadTemplate} style={{ border: 'none', background: 'none', color: 'var(--primary)', textDecoration: 'underline', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
                Tải file mẫu
              </button>
            </div>

            {importResult && (
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--surface-container-low)',
                border: '1px solid var(--outline-variant)',
                borderRadius: 'var(--radius-default)',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                marginTop: '8px'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={16} style={{ color: 'var(--secondary)' }} />
                  Kết quả import Excel:
                </div>
                <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--on-surface-variant)' }}>
                  <div>• Đã thêm mới: <strong style={{ color: 'var(--secondary)' }}>{importResult.successCount}</strong> sản phẩm</div>
                  {importResult.duplicateCount > 0 && (
                    <div style={{ fontSize: '12px' }}>
                      • Trùng lặp (bỏ qua): <strong style={{ color: 'var(--warning)' }}>{importResult.duplicateCount}</strong> SKU
                      <div style={{ fontSize: '11px', color: '#8191a9', wordBreak: 'break-all' }}>
                        ({importResult.duplicates.slice(0, 8).join(', ')}{importResult.duplicates.length > 8 ? '...' : ''})
                      </div>
                    </div>
                  )}
                  {importResult.invalidCount > 0 && (
                    <div style={{ fontSize: '12px' }}>
                      • Không hợp lệ (bỏ qua): <strong style={{ color: 'var(--error)' }}>{importResult.invalidCount}</strong> dòng
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setImportResult(null)}
                  style={{
                    alignSelf: 'flex-end',
                    background: 'none',
                    border: 'none',
                    color: 'var(--on-surface-variant)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '2px 6px',
                    marginTop: '4px'
                  }}
                >
                  Đóng thông báo
                </button>
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
