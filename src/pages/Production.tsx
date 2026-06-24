import React, { useState } from 'react';
import { useApp } from '../hooks/useApp';
import type { ProductionStage } from '../types';
import { Factory, Plus, CheckCircle, ArrowRight, Trash2 } from 'lucide-react';

export const Production: React.FC = () => {
  const { products, productionBatches, createProductionBatch, advanceBatchStage, deleteProductionBatch } = useApp();

  // Form states
  const [productSku, setProductSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!productSku) {
      setError('Vui lòng chọn sản phẩm!');
      return;
    }
    if (!quantity || parseInt(quantity) <= 0) {
      setError('Số lượng sản xuất phải lớn hơn 0!');
      return;
    }
    if (!targetDate) {
      setError('Vui lòng chọn ngày hoàn thành dự kiến!');
      return;
    }

    createProductionBatch({
      productSku,
      quantity: parseInt(quantity),
      targetDate,
    });

    // Reset form
    setQuantity('');
    setTargetDate('');
  };

  const activeBatches = productionBatches.filter((b) => b.status === 'running');
  const completedBatches = productionBatches.filter((b) => b.status === 'completed');

  const stages: { key: ProductionStage; label: string }[] = [
    { key: 'cutting', label: '1. Cắt vải' },
    { key: 'sewing', label: '2. May ráp' },
    { key: 'finishing', label: '3. Hoàn thiện' },
    { key: 'qc', label: '4. Kiểm phẩm' },
    { key: 'ready', label: '5. Nhập kho' },
  ];

  return (
    <div className="page-container fade-in">
      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700 }}>Quản lý tiến độ sản xuất</h2>
          <p style={{ color: '#8191a9', fontSize: '13px' }}>Tạo lệnh sản xuất mới và theo dõi chi tiết tiến độ xưởng gia công qua 5 bước</p>
        </div>
      </div>

      <div style={styles.contentLayout}>
        {/* Left Side: Create batch form */}
        <div className="card" style={{ flex: 1, minWidth: '280px', height: 'fit-content' }}>
          <div className="card-header">
            <h3>Lệnh sản xuất mới</h3>
          </div>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Sản phẩm gia công</label>
              <select value={productSku} onChange={(e) => setProductSku(e.target.value)} required>
                <option value="">-- Chọn sản phẩm --</option>
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Số lượng sản xuất (Cái)</label>
              <input
                type="number"
                min="1"
                placeholder="Ví dụ: 100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Ngày hoàn thành dự kiến</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
            </div>

            {error && <div style={styles.errorAlert}>{error}</div>}

            <button type="submit" className="btn btn-primary">
              <Plus size={16} />
              <span>Tạo lệnh sản xuất</span>
            </button>
          </form>
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
                  const prod = products.find((p) => p.sku === batch.productSku);
                  const currentStageIndex = stages.findIndex((s) => s.key === batch.currentStage);

                  return (
                    <div key={batch.id} style={styles.batchCard}>
                      <div style={styles.batchHeader}>
                        <div>
                          <span className="mono" style={styles.batchId}>{batch.id}</span>
                          <span style={styles.productName}> • {prod?.name || batch.productSku}</span>
                        </div>
                        <button
                          onClick={() => deleteProductionBatch(batch.id)}
                          style={styles.deleteBtn}
                          title="Hủy lệnh sản xuất"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div style={styles.batchMeta}>
                        <div>Số lượng: <strong className="mono">{batch.quantity}</strong> cái</div>
                        <div>Hạn: <strong className="mono">{batch.targetDate}</strong></div>
                      </div>

                      {/* Visual Flow Steps */}
                      <div style={styles.flowSteps}>
                        {stages.map((stg, index) => {
                          const isCompleted = index < currentStageIndex;
                          const isCurrent = index === currentStageIndex;

                          let stepStyle = styles.stepPending;
                          let stepNumStyle = {
                            ...styles.stepNum,
                            backgroundColor: '#e6e8ea',
                            color: '#75777d',
                          };

                          if (isCompleted) {
                            stepStyle = styles.stepCompleted;
                            stepNumStyle = {
                              ...styles.stepNum,
                              backgroundColor: '#e6f6ef',
                              color: '#006c49',
                            };
                          } else if (isCurrent) {
                            stepStyle = styles.stepActive;
                            stepNumStyle = {
                              ...styles.stepNum,
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                            };
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
                        <button
                          onClick={() => advanceBatchStage(batch.id)}
                          className="btn btn-success"
                          style={{ width: '100%' }}
                        >
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
                    <th>Số lượng</th>
                    <th>Ngày khởi tạo</th>
                    <th>Hạn hoàn thành</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {completedBatches.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#8191a9', padding: '24px' }}>
                        Chưa có lô hàng nào hoàn thành sản xuất.
                      </td>
                    </tr>
                  ) : (
                    completedBatches.map((batch) => {
                      const prod = products.find((p) => p.sku === batch.productSku);
                      return (
                        <tr key={batch.id}>
                          <td className="mono" style={{ fontWeight: 600 }}>{batch.id}</td>
                          <td>{prod?.name || batch.productSku}</td>
                          <td className="mono">{batch.quantity}</td>
                          <td className="mono">{batch.createdAt}</td>
                          <td className="mono">{batch.targetDate}</td>
                          <td>
                            <span className="badge badge-success">Đã nhập kho</span>
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
    padding: '10px',
    backgroundColor: '#ffdad6',
    color: '#ba1a1a',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
  },
  emptyPipeline: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#8191a9',
    textAlign: 'center' as const,
    border: '1px dashed #c5c6cd',
    borderRadius: '8px',
  },
  pipelineContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  batchCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #c5c6cd',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    transition: 'border-color 0.15s ease',
  },
  batchHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #eceef0',
    paddingBottom: '10px',
  },
  batchId: {
    fontWeight: 700,
    color: '#091426',
    fontSize: '14px',
  },
  productName: {
    color: '#45474c',
    fontSize: '14px',
    fontWeight: 500,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#8191a9',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
  },
  batchMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#45474c',
  },
  flowSteps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f2f4f6',
    padding: '12px',
    borderRadius: '6px',
    overflowX: 'auto' as const,
  },
  step: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
    flex: 1,
    minWidth: '60px',
  },
  stepNum: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
  },
  stepLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textAlign: 'center' as const,
  },
  stepPending: {
    color: '#8191a9',
  },
  stepActive: {
    color: '#b45309', // Warning color
    fontWeight: 600,
  },
  stepCompleted: {
    color: '#006c49', // Success Sage Green
  },
  stepConnectorPending: {
    height: '2px',
    flex: 0.5,
    backgroundColor: '#c5c6cd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 4px',
  },
  stepConnectorCompleted: {
    height: '2px',
    flex: 0.5,
    backgroundColor: '#006c49',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 4px',
  },
  actionRow: {
    marginTop: '4px',
  },
};
