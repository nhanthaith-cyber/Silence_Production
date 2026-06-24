import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';
import type { ExpenseCategory } from '../types';
import { formatCurrency } from '../utils/formatters';
import { RefreshCw, Plus, Check } from 'lucide-react';

export const Expenses: React.FC = () => {
  const { products, expenses, sales, addExpense, syncSalesFromNhanh, syncStockFromNhanh, connectionStatus } = useApp();

  // Expense form states
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [expenseSuccess, setExpenseSuccess] = useState(false);

  // Sync states
  const [syncStatus, setSyncStatus] = useState<{ qty: number; success: boolean; extraInfo?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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
      const qty = await syncSalesFromNhanh();
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
      setSyncStatus({ qty: 0, success: false });
    } finally {
      setIsSyncing(false);
    }
  };

  const catNames: Record<ExpenseCategory, string> = {
    labor: 'Nhân công',
    rent: 'Mặt bằng',
    ads: 'Quảng cáo/Marketing',
    shipping: 'Vận chuyển',
    material: 'Nguyên vật liệu',
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
                  <option value="material">Nguyên vật liệu (Vải, phụ kiện...)</option>
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

            <button
              onClick={handleSyncNhanh}
              className="btn btn-primary"
              disabled={isSyncing}
              style={{ width: '100%', gap: '8px', marginTop: '8px' }}
            >
              <RefreshCw size={14} className={isSyncing ? 'spin-anim' : ''} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ đơn hàng từ Nhanh.vn'}</span>
            </button>

            {syncStatus && (
              <div style={syncStatus.qty > 0 ? styles.syncSuccessBox : styles.syncEmptyBox}>
                <Check size={16} style={{ color: syncStatus.qty > 0 ? '#006c49' : '#b45309', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>
                    {syncStatus.qty > 0
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
          </div>
        </div>

        {/* Right Side: Lists */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '320px' }}>
          {/* Sales History */}
          <div className="card">
            <div className="card-header">
              <h3>Lịch sử đơn bán hàng</h3>
              <span className="badge badge-primary">{sales.length} Đơn hàng</span>
            </div>

            <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Mã Đơn</th>
                    <th>Sản phẩm</th>
                    <th>SL</th>
                    <th>Giá Bán</th>
                    <th>Doanh thu</th>
                    <th>Nguồn</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#8191a9', padding: '24px' }}>
                        Chưa có đơn bán hàng. Nhấn "Đồng bộ" để tải đơn hàng từ Nhanh.vn.
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale) => {
                      const prod = products.find((p) => p.sku === sale.productSku);
                      return (
                        <tr key={sale.id}>
                          <td className="mono" style={{ fontSize: '12px' }}>{sale.id}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{prod?.name || sale.productSku}</div>
                            <div className="mono" style={{ fontSize: '11px', color: '#8191a9' }}>{sale.productSku}</div>
                          </td>
                          <td className="mono">{sale.quantity}</td>
                          <td className="mono">{formatCurrency(sale.unitPrice)}</td>
                          <td className="mono" style={{ fontWeight: 600 }}>{formatCurrency(sale.quantity * sale.unitPrice)}</td>
                          <td>
                            <span className={`badge ${sourceBadgeClass(sale.source)}`}>
                              {sourceLabel(sale.source)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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
};
