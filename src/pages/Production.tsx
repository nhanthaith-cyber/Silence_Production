import React, { useState, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import type { ProductionStage, ExcelImportResult, ProductionBatch } from '../types';
import {
  Factory, Plus, CheckCircle, ArrowRight, Trash2, FileSpreadsheet, FileDown, Upload,
  RefreshCw, AlertCircle, CheckCircle2, Eye, X, Edit3, Save, Package, PackageCheck, Clock
} from 'lucide-react';
import {
  exportBatchesToExcel,
  generateBatchesTemplate,
  importFromExcel
} from '../services/excelDataService';

// ══════════════════════════════════════════════
// Modal chi tiết lệnh sản xuất
// ══════════════════════════════════════════════
interface BatchDetailModalProps {
  batch: ProductionBatch;
  products: ReturnType<typeof useApp>['products'];
  stages: { key: ProductionStage; label: string }[];
  onClose: () => void;
  onEdit: () => void;
  onAdvanceStage: (id: string) => void;
}

const BatchDetailModal: React.FC<BatchDetailModalProps> = ({
  batch, products, stages, onClose, onEdit, onAdvanceStage
}) => {
  const currentStageIndex = stages.findIndex((s) => s.key === batch.currentStage);
  const isCompleted = batch.status === 'completed';

  const totalOrdered = batch.items.reduce((sum, i) => sum + i.quantity, 0);
  const totalDelivered = batch.items.reduce((sum, i) => sum + (i.deliveredQty ?? 0), 0);
  const totalDefect = batch.items.reduce((sum, i) => sum + (i.defectQty ?? 0), 0);
  const totalGood = totalDelivered - totalDefect;
  const totalRemaining = totalOrdered - totalDelivered;
  const maxDeliveryCount = batch.items.reduce((max, i) => Math.max(max, i.deliveryCount ?? 0), 0);

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div
        style={{ ...modalStyles.container, maxWidth: '680px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={modalStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: isCompleted ? '#e6f6ef' : '#fef3c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {isCompleted
                ? <PackageCheck size={20} color="#006c49" />
                : <Package size={20} color="#b45309" />}
            </div>
            <div>
              <div className="mono" style={{ fontWeight: 700, fontSize: '16px', color: '#091426' }}>
                {batch.id}
              </div>
              <div style={{ fontSize: '12px', color: '#8191a9', marginTop: '2px' }}>
                Tạo ngày {batch.createdAt} · Hạn: <span className="mono" style={{ fontWeight: 600, color: '#334155' }}>{batch.targetDate}</span>
                {maxDeliveryCount > 0 && (
                  <span style={{ marginLeft: '8px', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '1px 7px', borderRadius: '10px', fontWeight: 700, fontSize: '11px' }}>
                    🚚 {maxDeliveryCount} lần giao
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isCompleted && (
              <button
                onClick={onEdit}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', border: '1px solid #c5c6cd',
                  borderRadius: '8px', backgroundColor: '#f8fafc', color: '#334155',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Edit3 size={14} /> Chỉnh sửa
              </button>
            )}
            <button onClick={onClose} style={modalStyles.closeBtn}><X size={18} /></button>
          </div>
        </div>

        {/* Summary Cards — 5 ô */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
          <div style={modalStyles.summaryCard}>
            <div style={{ fontSize: '10px', color: '#8191a9', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Tổng đặt</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#091426' }}>{totalOrdered}</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>sản phẩm</div>
          </div>
          <div style={{ ...modalStyles.summaryCard, backgroundColor: '#e6f6ef', borderColor: '#b7e4cf' }}>
            <div style={{ fontSize: '10px', color: '#006c49', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Đã trả</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#006c49' }}>{totalDelivered}</div>
            <div style={{ fontSize: '10px', color: '#006c49' }}>từ xưởng</div>
          </div>
          <div style={{ ...modalStyles.summaryCard, backgroundColor: totalDefect > 0 ? '#fff1f2' : '#f8fafc', borderColor: totalDefect > 0 ? '#fecdd3' : '#e2e8f0' }}>
            <div style={{ fontSize: '10px', color: totalDefect > 0 ? '#be123c' : '#8191a9', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Lỗi</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: totalDefect > 0 ? '#be123c' : '#75777d' }}>{totalDefect}</div>
            <div style={{ fontSize: '10px', color: totalDefect > 0 ? '#be123c' : '#8191a9' }}>hàng lỗi</div>
          </div>
          <div style={{ ...modalStyles.summaryCard, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div style={{ fontSize: '10px', color: '#15803d', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Hàng tốt</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: '#15803d' }}>{totalGood}</div>
            <div style={{ fontSize: '10px', color: '#15803d' }}>nhập kho được</div>
          </div>
          <div style={{ ...modalStyles.summaryCard, backgroundColor: totalRemaining > 0 ? '#fff7ed' : '#f0fdf4', borderColor: totalRemaining > 0 ? '#fed7aa' : '#bbf7d0' }}>
            <div style={{ fontSize: '10px', color: totalRemaining > 0 ? '#c2410c' : '#15803d', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Còn lại</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, color: totalRemaining > 0 ? '#c2410c' : '#15803d' }}>{totalRemaining}</div>
            <div style={{ fontSize: '10px', color: totalRemaining > 0 ? '#c2410c' : '#15803d' }}>{totalRemaining > 0 ? 'chưa về' : 'đã về hết'}</div>
          </div>
        </div>

        {/* Items Table */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Chi tiết sản phẩm ({batch.items.length})
          </h4>
          <div style={{ border: '1px solid #eceef0', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={modalStyles.th}>Sản phẩm</th>
                  <th style={{ ...modalStyles.th, textAlign: 'right' as const }}>SL đặt</th>
                  <th style={{ ...modalStyles.th, textAlign: 'right' as const }}>Đã trả</th>
                  <th style={{ ...modalStyles.th, textAlign: 'right' as const, color: '#be123c' }}>Lỗi</th>
                  <th style={{ ...modalStyles.th, textAlign: 'right' as const, color: '#15803d' }}>Hàng tốt</th>
                  <th style={{ ...modalStyles.th, textAlign: 'right' as const }}>Còn lại</th>
                  <th style={{ ...modalStyles.th, textAlign: 'center' as const }}>Lần giao</th>
                  <th style={{ ...modalStyles.th, textAlign: 'center' as const }}>Tiến độ</th>
                </tr>
              </thead>
              <tbody>
                {batch.items.map((item, idx) => {
                  const prod = products.find((p) => p.sku === item.productSku);
                  const delivered = item.deliveredQty ?? 0;
                  const defect = item.defectQty ?? 0;
                  const good = delivered - defect;
                  const remaining = item.quantity - delivered;
                  const pct = item.quantity > 0 ? Math.min(100, Math.round((delivered / item.quantity) * 100)) : 0;
                  const dCount = item.deliveryCount ?? 0;
                  return (
                    <tr key={item.productSku} style={{ borderTop: idx === 0 ? 'none' : '1px solid #eceef0' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#091426' }}>{prod?.name || item.productSku}</div>
                        <div className="mono" style={{ fontSize: '11px', color: '#8191a9' }}>{item.productSku}</div>
                      </td>
                      <td className="mono" style={{ padding: '10px 16px', textAlign: 'right' as const, fontWeight: 700, fontSize: '13px', color: '#334155' }}>{item.quantity}</td>
                      <td className="mono" style={{ padding: '10px 16px', textAlign: 'right' as const, fontWeight: 700, fontSize: '13px', color: '#006c49' }}>{delivered}</td>
                      <td className="mono" style={{ padding: '10px 16px', textAlign: 'right' as const, fontWeight: 700, fontSize: '13px', color: defect > 0 ? '#be123c' : '#75777d' }}>{defect > 0 ? defect : '—'}</td>
                      <td className="mono" style={{ padding: '10px 16px', textAlign: 'right' as const, fontWeight: 700, fontSize: '13px', color: '#15803d' }}>{good}</td>
                      <td className="mono" style={{ padding: '10px 16px', textAlign: 'right' as const, fontWeight: 700, fontSize: '13px', color: remaining > 0 ? '#c2410c' : '#15803d' }}>{remaining}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' as const }}>
                        {dCount > 0 ? (
                          <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700 }}>🚚 {dCount}</span>
                        ) : (
                          <span style={{ color: '#c5c6cd', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' as const }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ flex: 1, backgroundColor: '#e2e8f0', borderRadius: '4px', height: '6px', overflow: 'hidden', minWidth: '50px' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 100 ? '#006c49' : '#f59e0b', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', minWidth: '30px' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Progress Steps */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tiến độ công đoạn
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f2f4f6', padding: '16px', borderRadius: '8px' }}>
            {stages.map((stg, index) => {
              const isStepCompleted = index < currentStageIndex;
              const isStepCurrent = index === currentStageIndex;
              return (
                <React.Fragment key={stg.key}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700,
                      backgroundColor: isStepCompleted ? '#e6f6ef' : isStepCurrent ? '#fef3c7' : '#e6e8ea',
                      color: isStepCompleted ? '#006c49' : isStepCurrent ? '#b45309' : '#75777d',
                    }}>
                      {isStepCompleted ? <CheckCircle size={14} /> : index + 1}
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, textAlign: 'center' as const, color: isStepCompleted ? '#006c49' : isStepCurrent ? '#b45309' : '#75777d' }}>
                      {stg.label.split('. ')[1]}
                    </span>
                    {isStepCurrent && (
                      <span style={{ fontSize: '9px', backgroundColor: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>HIỆN TẠI</span>
                    )}
                    {isCompleted && isStepCompleted && index === stages.length - 1 && (
                      <span style={{ fontSize: '9px', backgroundColor: '#e6f6ef', color: '#006c49', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>HOÀN TẤT</span>
                    )}
                  </div>
                  {index < stages.length - 1 && (
                    <div style={{ height: '2px', flex: 0.4, backgroundColor: isStepCompleted ? '#006c49' : '#c5c6cd', margin: '0 2px' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Action Footer */}
        {!isCompleted && (
          <div style={{ borderTop: '1px solid #eceef0', paddingTop: '16px', display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #c5c6cd', borderRadius: '8px', backgroundColor: '#f8fafc', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
              Đóng
            </button>
            <button
              onClick={() => { onAdvanceStage(batch.id); onClose(); }}
              style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: '#006c49', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <ArrowRight size={16} />
              Chuyển sang: {stages[currentStageIndex + 1]?.label.split('. ')[1] || 'Hoàn tất'}
            </button>
          </div>
        )}
        {isCompleted && (
          <div style={{ borderTop: '1px solid #eceef0', paddingTop: '16px' }}>
            <button onClick={onClose} style={{ width: '100%', padding: '10px', border: '1px solid #c5c6cd', borderRadius: '8px', backgroundColor: '#f8fafc', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════
// Modal chỉnh sửa lệnh sản xuất
// ══════════════════════════════════════════════
interface BatchEditModalProps {
  batch: ProductionBatch;
  products: ReturnType<typeof useApp>['products'];
  onClose: () => void;
  onSave: (batchId: string, data: { items: { productSku: string; quantity: number; deliveredQty: number; defectQty: number }[]; targetDate: string }) => void;
}

const BatchEditModal: React.FC<BatchEditModalProps> = ({ batch, products, onClose, onSave }) => {
  const [editItems, setEditItems] = useState(
    batch.items.map((item) => ({
      productSku: item.productSku,
      quantity: item.quantity,
      deliveredQty: item.deliveredQty ?? 0,
      defectQty: item.defectQty ?? 0,
    }))
  );
  const [editTargetDate, setEditTargetDate] = useState(batch.targetDate);
  const [errors, setErrors] = useState<string[]>([]);

  const handleItemChange = (idx: number, field: 'quantity' | 'deliveredQty' | 'defectQty', value: string) => {
    const num = parseInt(value) || 0;
    const updated = [...editItems];
    updated[idx] = { ...updated[idx], [field]: num };
    setEditItems(updated);
  };

  const handleSave = () => {
    const errs: string[] = [];
    editItems.forEach((item) => {
      if (item.quantity <= 0) errs.push(`SKU ${item.productSku}: Số lượng đặt phải > 0`);
      if (item.deliveredQty < 0) errs.push(`SKU ${item.productSku}: Số lượng đã trả không thể âm`);
      if (item.deliveredQty > item.quantity) errs.push(`SKU ${item.productSku}: Đã trả (${item.deliveredQty}) không thể vượt quá đặt (${item.quantity})`);
      if (item.defectQty < 0) errs.push(`SKU ${item.productSku}: Số lượng lỗi không thể âm`);
      if (item.defectQty > item.deliveredQty) errs.push(`SKU ${item.productSku}: Lỗi (${item.defectQty}) không thể vượt quá đã trả (${item.deliveredQty})`);
    });
    if (!editTargetDate) errs.push('Vui lòng chọn ngày hoàn thành');
    if (errs.length > 0) { setErrors(errs); return; }
    onSave(batch.id, { items: editItems, targetDate: editTargetDate });
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={{ ...modalStyles.container, maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={modalStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Edit3 size={18} color="#1a56db" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#091426' }}>Chỉnh sửa lệnh sản xuất</div>
              <div className="mono" style={{ fontSize: '12px', color: '#8191a9' }}>{batch.id}</div>
            </div>
          </div>
          <button onClick={onClose} style={modalStyles.closeBtn}><X size={18} /></button>
        </div>

        {/* Date */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Clock size={12} style={{ marginRight: '4px' }} /> Ngày hoàn thành dự kiến
          </label>
          <input
            type="date"
            value={editTargetDate}
            onChange={(e) => setEditTargetDate(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #c5c6cd', borderRadius: '8px', fontSize: '14px', fontFamily: 'JetBrains Mono, monospace' }}
          />
        </div>

        {/* Items */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Package size={12} style={{ marginRight: '4px' }} /> Danh sách sản phẩm
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Column Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px 70px', gap: '6px', padding: '8px 12px', backgroundColor: '#f1f5f9', borderRadius: '8px 8px 0 0', border: '1px solid #e2e8f0', borderBottom: 'none' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const }}>Sản phẩm</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, textAlign: 'center' as const }}>SL đặt</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#006c49', textTransform: 'uppercase' as const, textAlign: 'center' as const }}>Đã trả</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#be123c', textTransform: 'uppercase' as const, textAlign: 'center' as const }}>Lỗi</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' as const, textAlign: 'center' as const }}>Tốt</div>
            </div>
            {editItems.map((item, idx) => {
              const prod = products.find((p) => p.sku === item.productSku);
              const good = item.deliveredQty - item.defectQty;
              return (
                <div key={item.productSku} style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 90px 90px 70px', gap: '6px',
                  padding: '10px 12px', border: '1px solid #e2e8f0', borderTop: 'none',
                  backgroundColor: '#ffffff',
                  borderRadius: idx === editItems.length - 1 ? '0 0 8px 8px' : '0',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#091426' }}>{prod?.name || item.productSku}</span>
                    <span className="mono" style={{ fontSize: '11px', color: '#8191a9' }}>{item.productSku}</span>
                  </div>
                  <div>
                    <input
                      type="number" min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      style={{ width: '100%', padding: '6px 4px', border: '1px solid #c5c6cd', borderRadius: '6px', textAlign: 'center' as const, fontSize: '13px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </div>
                  <div>
                    <input
                      type="number" min="0" max={item.quantity}
                      value={item.deliveredQty}
                      onChange={(e) => handleItemChange(idx, 'deliveredQty', e.target.value)}
                      style={{ width: '100%', padding: '6px 4px', border: '1px solid #b7e4cf', borderRadius: '6px', textAlign: 'center' as const, fontSize: '13px', fontWeight: 700, color: '#006c49', fontFamily: 'JetBrains Mono, monospace', backgroundColor: '#f0fdf4' }}
                    />
                  </div>
                  <div>
                    <input
                      type="number" min="0" max={item.deliveredQty}
                      value={item.defectQty}
                      onChange={(e) => handleItemChange(idx, 'defectQty', e.target.value)}
                      style={{ width: '100%', padding: '6px 4px', border: '1px solid #fecdd3', borderRadius: '6px', textAlign: 'center' as const, fontSize: '13px', fontWeight: 700, color: '#be123c', fontFamily: 'JetBrains Mono, monospace', backgroundColor: '#fff1f2' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="mono" style={{ fontSize: '14px', fontWeight: 700, color: good >= 0 ? '#15803d' : '#be123c' }}>{good >= 0 ? good : '!'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{ padding: '10px 14px', backgroundColor: '#ffdad6', borderRadius: '8px', marginBottom: '16px' }}>
            {errors.map((err, i) => (
              <div key={i} style={{ fontSize: '12px', color: '#ba1a1a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={12} /> {err}
              </div>
            ))}
          </div>
        )}

        {/* Hint */}
        <div style={{ fontSize: '12px', color: '#64748b', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', lineHeight: 1.5 }}>
          💡 <strong>SL đặt</strong>: tổng đặt xưởng · <strong>Đã trả</strong>: xưởng giao về (tự tăng số lần giao) · <strong>Lỗi</strong>: hàng lỗi bị loại · <strong>Tốt</strong> = Đã trả − Lỗi → tính vào tồn kho.
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #c5c6cd', borderRadius: '8px', backgroundColor: '#f8fafc', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>
            Hủy
          </button>
          <button onClick={handleSave} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '8px', backgroundColor: '#091426', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Save size={15} /> Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════
// Modal styles
// ══════════════════════════════════════════════
const modalStyles = {
  overlay: {
    position: 'fixed' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(9, 20, 38, 0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: '16px',
    backdropFilter: 'blur(2px)',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    boxShadow: '0 20px 60px -10px rgba(9,20,38,0.2), 0 8px 20px -8px rgba(9,20,38,0.15)',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    animation: 'fadeInScale 0.18s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #eceef0',
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#8191a9', padding: '4px', borderRadius: '6px',
    display: 'flex', alignItems: 'center',
  },
  summaryCard: {
    padding: '14px 16px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
  },
  th: {
    padding: '10px 16px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textAlign: 'left' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderBottom: '1px solid #eceef0',
  },
};

// ══════════════════════════════════════════════
// Main Production Page
// ══════════════════════════════════════════════
export const Production: React.FC = () => {
  const {
    products, productionBatches, createProductionBatch, advanceBatchStage, deleteProductionBatch,
    updateProductionBatch, importAllData, sales, expenses
  } = useApp();

  // Form states
  const [formItems, setFormItems] = useState<{ productSku: string; quantity: string }[]>(
    [{ productSku: '', quantity: '' }]
  );
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState('');

  // Modal states
  const [detailBatch, setDetailBatch] = useState<ProductionBatch | null>(null);
  const [editBatch, setEditBatch] = useState<ProductionBatch | null>(null);

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
    const finalBatches = excelImportMode === 'overwrite'
      ? excelPreview.productionBatches
      : [
          ...productionBatches,
          ...excelPreview.productionBatches.filter(b => !productionBatches.find(eb => eb.id === b.id))
        ];

    const jsonStr = JSON.stringify({
      version: '1.0',
      exportedAt: excelPreview.parsedAt,
      products, productionBatches: finalBatches, sales, expenses,
    });

    const result = importAllData(jsonStr);
    if (result.success) {
      const mode = excelImportMode === 'overwrite' ? 'Ghi đè' : 'Thêm mới';
      setExcelSuccess(`✅ [${mode}] Import lô sản xuất thành công: ${excelPreview.productionBatches.length} lô.`);
      setShowExcelConfirm(false);
      setExcelPreview(null);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setExcelError(`Lỗi import: ${result.error}`);
      setShowExcelConfirm(false);
    }
  };

  const addFormItem = () => setFormItems([...formItems, { productSku: '', quantity: '' }]);
  const removeFormItem = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };
  const updateFormItem = (index: number, field: 'productSku' | 'quantity', value: string) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormItems(updated);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formItems.some((item) => !item.productSku)) {
      setError('Vui lòng chọn sản phẩm cho tất cả các dòng!'); return;
    }
    if (formItems.some((item) => !item.quantity || parseInt(item.quantity) <= 0)) {
      setError('Số lượng sản xuất phải lớn hơn 0!'); return;
    }
    const skus = formItems.map((item) => item.productSku);
    if (skus.some((sku, idx) => skus.indexOf(sku) !== idx)) {
      setError('Không thể chọn trùng sản phẩm (SKU) trong cùng một lệnh!'); return;
    }
    if (!targetDate) { setError('Vui lòng chọn ngày hoàn thành dự kiến!'); return; }

    createProductionBatch({
      items: formItems.map((item) => ({ productSku: item.productSku, quantity: parseInt(item.quantity) })),
      targetDate,
    });
    setFormItems([{ productSku: '', quantity: '' }]);
    setTargetDate('');
  };

  const handleSaveBatchEdit = (
    batchId: string,
    data: { items: { productSku: string; quantity: number; deliveredQty: number }[]; targetDate: string }
  ) => {
    updateProductionBatch(batchId, {
      items: data.items.map((i) => ({ productSku: i.productSku, quantity: i.quantity, deliveredQty: i.deliveredQty })),
      targetDate: data.targetDate,
    });
    setEditBatch(null);
    // Also update detailBatch to reflect changes
    const updated = productionBatches.find(b => b.id === batchId);
    if (updated) setDetailBatch({ ...updated, items: data.items, targetDate: data.targetDate });
  };

  const activeBatches = productionBatches.filter((b) => b.status === 'running');
  const completedBatches = productionBatches.filter((b) => b.status === 'completed');

  const stages: { key: ProductionStage; label: string }[] = [
    { key: 'ordered', label: '1. Đã đặt hàng' },
    { key: 'paid', label: '2. Đã thanh toán' },
    { key: 'shipping', label: '3. Đang vận chuyển' },
    { key: 'producing', label: '4. Đang sản xuất' },
    { key: 'delivered', label: '5. Đã nhập kho' },
  ];

  return (
    <div className="page-container fade-in">
      {/* CSS animation for modals */}
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700 }}>Quản lý tiến độ sản xuất</h2>
          <p style={{ color: '#8191a9', fontSize: '13px' }}>Tạo lệnh sản xuất mới (đa SKU) và theo dõi chi tiết tiến độ qua 5 bước</p>
        </div>
      </div>

      <div style={styles.contentLayout}>
        {/* Left Side: Create batch form */}
        <div className="card" style={{ flex: 1, minWidth: '280px', height: 'fit-content' }}>
          <div className="card-header">
            <h3>Lệnh sản xuất mới</h3>
          </div>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                Danh sách sản phẩm gia công
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formItems.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Sản phẩm {index + 1}</span>
                      <select
                        value={item.productSku}
                        onChange={(e) => updateFormItem(index, 'productSku', e.target.value)}
                        required
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Chọn sản phẩm --</option>
                        {products.map((p) => (
                          <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>SL</span>
                      <input
                        type="number" min="1" placeholder="SL"
                        value={item.quantity}
                        onChange={(e) => updateFormItem(index, 'quantity', e.target.value)}
                        required style={{ width: '100%' }}
                      />
                    </div>
                    {formItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFormItem(index)}
                        style={{
                          backgroundColor: '#fee2e2', color: '#ef4444', border: 'none',
                          borderRadius: '4px', padding: '8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', height: '38px',
                        }}
                        title="Xóa dòng sản phẩm"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button" onClick={addFormItem} className="btn"
                style={{
                  marginTop: '12px', backgroundColor: '#f1f5f9', color: '#475569',
                  border: '1px dashed #cbd5e1', width: '100%',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                  padding: '8px', fontSize: '13px',
                }}
              >
                <Plus size={14} />
                <span>Thêm sản phẩm</span>
              </button>
            </div>

            <div className="form-group">
              <label>Ngày hoàn thành dự kiến</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
            </div>

            {error && <div style={styles.errorAlert}>{error}</div>}

            <button type="submit" className="btn btn-primary">
              <Plus size={16} />
              <span>Tạo lệnh sản xuất</span>
            </button>
          </form>

          <div style={{ margin: '20px 0', borderTop: '1px dashed #eceef0' }}></div>

          {/* Excel Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#091426', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={16} color="#006c49" /> Cập nhật qua Excel
            </h4>
            <p style={{ fontSize: '12px', color: '#8191a9', margin: 0, lineHeight: 1.4 }}>
              Xuất danh sách lô sản xuất, hoặc import lệnh sản xuất hàng loạt bằng file Excel.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <button type="button" onClick={generateBatchesTemplate} className="btn btn-secondary" style={{ width: '100%', gap: '8px', justifyContent: 'center', fontSize: '12px', padding: '8px 12px' }}>
                <FileDown size={14} /><span>Tải template Excel mẫu</span>
              </button>
              <button type="button" onClick={() => exportBatchesToExcel(productionBatches)} className="btn btn-secondary" style={{ width: '100%', gap: '8px', justifyContent: 'center', fontSize: '12px', padding: '8px 12px' }}>
                <FileSpreadsheet size={14} /><span>Xuất danh sách ra Excel</span>
              </button>
              <button type="button" onClick={() => excelFileInputRef.current?.click()} className="btn btn-primary" disabled={isParsingExcel} style={{ width: '100%', gap: '8px', justifyContent: 'center', fontSize: '12px', padding: '8px 12px', backgroundColor: '#1a56db', borderColor: '#1a56db' }}>
                {isParsingExcel
                  ? <><RefreshCw size={14} className="spin-anim" /><span>Đang đọc file...</span></>
                  : <><Upload size={14} /><span>Import từ file Excel (.xlsx)</span></>}
              </button>
              <input ref={excelFileInputRef} type="file" accept=".xlsx,.xls" onChange={handleExcelFileChange} style={{ display: 'none' }} />
            </div>

            {excelError && (
              <div style={styles.errorAlert}>
                <AlertCircle size={14} /><span>{excelError}</span>
              </div>
            )}
            {excelSuccess && (
              <div style={{ padding: '10px 12px', backgroundColor: '#e6f6ef', color: '#006c49', borderRadius: '4px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} /><span>{excelSuccess}</span>
              </div>
            )}

            {/* Excel Confirm Modal */}
            {showExcelConfirm && excelPreview && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(9, 20, 38, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '100%', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#091426', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #eceef0', paddingBottom: '12px' }}>
                    <FileSpreadsheet size={20} color="#1a56db" /> Xác nhận import Excel lệnh SX
                  </div>
                  <div style={{ fontSize: '13px', color: '#45474c' }}>
                    Đọc được: <strong style={{ color: '#006c49' }}>{excelPreview.productionBatches.length} lệnh sản xuất</strong> từ file Excel.
                  </div>
                  {excelPreview.warnings.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '10px', borderRadius: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                      {excelPreview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#334155' }}>Chọn chế độ import:</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <label style={{ display: 'flex', gap: '8px', padding: '10px', border: `1px solid ${excelImportMode === 'overwrite' ? '#ba1a1a' : '#eceef0'}`, borderRadius: '8px', cursor: 'pointer', background: excelImportMode === 'overwrite' ? '#ffdad633' : '#f8fafc' }}>
                        <input type="radio" name="excelBatchMode" value="overwrite" checked={excelImportMode === 'overwrite'} onChange={() => setExcelImportMode('overwrite')} />
                        <div><div style={{ fontWeight: 600, color: '#ba1a1a', fontSize: '12px' }}>Ghi đè</div><div style={{ fontSize: '10px', color: '#8191a9', marginTop: '2px' }}>Xóa lệnh sản xuất cũ</div></div>
                      </label>
                      <label style={{ display: 'flex', gap: '8px', padding: '10px', border: `1px solid ${excelImportMode === 'append' ? '#006c49' : '#eceef0'}`, borderRadius: '8px', cursor: 'pointer', background: excelImportMode === 'append' ? '#e6f6ef33' : '#f8fafc' }}>
                        <input type="radio" name="excelBatchMode" value="append" checked={excelImportMode === 'append'} onChange={() => setExcelImportMode('append')} />
                        <div><div style={{ fontWeight: 600, color: '#006c49', fontSize: '12px' }}>Thêm mới</div><div style={{ fontSize: '10px', color: '#8191a9', marginTop: '2px' }}>Giữ lệnh cũ, thêm lệnh mới</div></div>
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

        {/* Right Side: Pipelines list */}
        <div style={{ flex: 2.5, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Active pipelines */}
          <div className="card">
            <div className="card-header">
              <h3>Các lô hàng đang gia công</h3>
              <span className="badge badge-warning">{activeBatches.length} Đang chạy</span>
            </div>

            {activeBatches.length === 0 ? (
              <div style={styles.emptyPipeline}>
                <Factory size={40} style={{ color: '#8191a9', marginBottom: '12px' }} />
                <h4>Không có lệnh sản xuất nào đang chạy</h4>
                <p>Nhập thông tin bên trái để tạo lệnh sản xuất đầu tiên.</p>
              </div>
            ) : (
              <div style={styles.pipelineContainer}>
                {activeBatches.map((batch) => {
                  const currentStageIndex = stages.findIndex((s) => s.key === batch.currentStage);
                  const totalDelivered = batch.items.reduce((sum, i) => sum + (i.deliveredQty ?? 0), 0);
                  const totalOrdered = batch.items.reduce((sum, i) => sum + i.quantity, 0);

                  return (
                    <div key={batch.id} style={styles.batchCard}>
                      <div style={styles.batchHeader}>
                        <div>
                          <span className="mono" style={styles.batchId}>{batch.id}</span>
                          <span style={styles.productName}> • Lô hàng ({batch.items.length} sản phẩm)</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {/* Eye button - View Detail */}
                          <button
                            onClick={() => setDetailBatch(batch)}
                            style={{ ...styles.deleteBtn, color: '#1a56db', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}
                            title="Xem chi tiết lệnh"
                          >
                            <Eye size={13} /> Chi tiết
                          </button>
                          <button
                            onClick={() => deleteProductionBatch(batch.id)}
                            style={styles.deleteBtn}
                            title="Hủy lệnh sản xuất"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div style={styles.batchItemsList}>
                        {batch.items.map((item) => {
                          const prod = products.find((p) => p.sku === item.productSku);
                          const delivered = item.deliveredQty ?? 0;
                          return (
                            <div key={item.productSku} style={styles.batchItemRow}>
                              <span>{prod?.name || item.productSku} (<span className="mono">{item.productSku}</span>)</span>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <strong className="mono">x{item.quantity}</strong>
                                {delivered > 0 && (
                                  <span style={{ fontSize: '11px', color: '#006c49', backgroundColor: '#e6f6ef', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                    ✓ {delivered} trả
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={styles.batchMeta}>
                        <div>Tổng đặt: <strong className="mono">{totalOrdered}</strong> cái</div>
                        <div>Đã trả: <strong className="mono" style={{ color: totalDelivered > 0 ? '#006c49' : '#8191a9' }}>{totalDelivered}</strong> cái</div>
                        <div>Hạn: <strong className="mono">{batch.targetDate}</strong></div>
                      </div>

                      {/* Visual Flow Steps */}
                      <div style={styles.flowSteps}>
                        {stages.map((stg, index) => {
                          const isCompleted = index < currentStageIndex;
                          const isCurrent = index === currentStageIndex;

                          let stepStyle = styles.stepPending;
                          let stepNumStyle = { ...styles.stepNum, backgroundColor: '#e6e8ea', color: '#75777d' };

                          if (isCompleted) {
                            stepStyle = styles.stepCompleted;
                            stepNumStyle = { ...styles.stepNum, backgroundColor: '#e6f6ef', color: '#006c49' };
                          } else if (isCurrent) {
                            stepStyle = styles.stepActive;
                            stepNumStyle = { ...styles.stepNum, backgroundColor: '#fef3c7', color: '#b45309' };
                          }

                          return (
                            <React.Fragment key={stg.key}>
                              <div style={{ ...styles.step, ...stepStyle }}>
                                <div style={stepNumStyle}>
                                  {isCompleted ? <CheckCircle size={14} /> : index + 1}
                                </div>
                                <span style={styles.stepLabel}>{stg.label.split('. ')[1]}</span>
                              </div>
                              {index < stages.length - 1 && (
                                <div style={isCompleted ? styles.stepConnectorCompleted : styles.stepConnectorPending}>
                                  <ArrowRight size={12} style={{ color: isCompleted ? '#006c49' : '#c5c6cd' }} />
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      {/* Transition Action Button */}
                      <div style={styles.actionRow}>
                        <button onClick={() => advanceBatchStage(batch.id)} className="btn btn-success" style={{ width: '100%' }}>
                          <span>Chuyển sang công đoạn:</span>
                          <strong style={{ textTransform: 'uppercase' }}>
                            {stages[currentStageIndex + 1]?.label.split('. ')[1] || 'Hoàn tất'}
                          </strong>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* History */}
          <div className="card">
            <div className="card-header">
              <h3>Lịch sử lô hàng đã hoàn thành</h3>
              <span className="badge badge-success">{completedBatches.length} Đã nhập kho</span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã Lô</th>
                    <th>Sản phẩm</th>
                    <th>SL đặt</th>
                    <th>Đã trả</th>
                    <th>Ngày khởi tạo</th>
                    <th>Hạn hoàn thành</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {completedBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: '#8191a9', padding: '24px' }}>
                        Chưa có lô hàng nào hoàn thành sản xuất.
                      </td>
                    </tr>
                  ) : (
                    completedBatches.map((batch) => {
                      const totalDelivered = batch.items.reduce((sum, i) => sum + (i.deliveredQty ?? 0), 0);
                      const totalOrdered = batch.items.reduce((sum, i) => sum + i.quantity, 0);
                      return (
                        <tr key={batch.id}>
                          <td className="mono" style={{ fontWeight: 600 }}>{batch.id}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {batch.items.map((item) => {
                                const prod = products.find((p) => p.sku === item.productSku);
                                return (
                                  <div key={item.productSku} style={{ fontSize: '13px' }}>
                                    {prod?.name || item.productSku} ({item.productSku})
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="mono">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {batch.items.map((item) => (
                                <div key={item.productSku} style={{ fontWeight: 600 }}>{item.quantity}</div>
                              ))}
                              {batch.items.length > 1 && (
                                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '2px', paddingTop: '2px', color: '#64748b' }}>
                                  Tổng: {totalOrdered}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="mono">
                            <span style={{ color: totalDelivered > 0 ? '#006c49' : '#8191a9', fontWeight: 700 }}>
                              {totalDelivered > 0 ? totalDelivered : '—'}
                            </span>
                          </td>
                          <td className="mono">{batch.createdAt}</td>
                          <td className="mono">{batch.targetDate}</td>
                          <td>
                            <span className="badge badge-success">Đã nhập kho</span>
                          </td>
                          <td>
                            <button
                              onClick={() => setDetailBatch(batch)}
                              style={{ background: 'none', border: '1px solid #bfdbfe', borderRadius: '6px', color: '#1a56db', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} /> Chi tiết
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

      {/* ── Detail Modal ── */}
      {detailBatch && (
        <BatchDetailModal
          batch={detailBatch}
          products={products}
          stages={stages}
          onClose={() => setDetailBatch(null)}
          onEdit={() => { setEditBatch(detailBatch); setDetailBatch(null); }}
          onAdvanceStage={advanceBatchStage}
        />
      )}

      {/* ── Edit Modal ── */}
      {editBatch && (
        <BatchEditModal
          batch={editBatch}
          products={products}
          onClose={() => setEditBatch(null)}
          onSave={handleSaveBatchEdit}
        />
      )}
    </div>
  );
};

const styles = {
  pageHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px',
  },
  contentLayout: {
    display: 'flex', flexWrap: 'wrap' as const, gap: '24px', alignItems: 'flex-start',
  },
  errorAlert: {
    padding: '10px', backgroundColor: '#ffdad6', color: '#ba1a1a',
    borderRadius: '4px', fontSize: '13px', fontWeight: 500,
  },
  emptyPipeline: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    padding: '40px 20px', color: '#8191a9', textAlign: 'center' as const,
    border: '1px dashed #c5c6cd', borderRadius: '8px',
  },
  pipelineContainer: { display: 'flex', flexDirection: 'column' as const, gap: '16px' },
  batchCard: {
    backgroundColor: '#ffffff', border: '1px solid #c5c6cd', borderRadius: '8px',
    padding: '20px', display: 'flex', flexDirection: 'column' as const, gap: '16px',
    transition: 'border-color 0.15s ease',
  },
  batchHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #eceef0', paddingBottom: '10px',
  },
  batchId: { fontWeight: 700, color: '#091426', fontSize: '14px' },
  productName: { color: '#45474c', fontSize: '14px', fontWeight: 500 },
  deleteBtn: {
    background: 'none', border: 'none', color: '#8191a9',
    cursor: 'pointer', padding: '4px', borderRadius: '4px',
  },
  batchItemsList: {
    backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: '6px', padding: '10px 12px',
    display: 'flex', flexDirection: 'column' as const, gap: '6px', fontSize: '13px',
  },
  batchItemRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#334155',
  },
  batchMeta: {
    display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#45474c',
  },
  flowSteps: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f2f4f6', padding: '12px', borderRadius: '6px', overflowX: 'auto' as const,
  },
  step: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px', flex: 1, minWidth: '60px',
  },
  stepNum: {
    width: '24px', height: '24px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700,
  },
  stepLabel: { fontSize: '11px', fontWeight: 600, textAlign: 'center' as const },
  stepPending: { color: '#8191a9' },
  stepActive: { color: '#b45309', fontWeight: 600 },
  stepCompleted: { color: '#006c49' },
  stepConnectorPending: {
    height: '2px', flex: 0.5, backgroundColor: '#c5c6cd',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 4px',
  },
  stepConnectorCompleted: {
    height: '2px', flex: 0.5, backgroundColor: '#006c49',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 4px',
  },
  actionRow: { marginTop: '4px' },
};
