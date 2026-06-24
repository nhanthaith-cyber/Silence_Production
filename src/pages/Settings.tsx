import React, { useState, useRef } from 'react';
import { useApp } from '../hooks/useApp';
import {
  Wifi, WifiOff, Shield, Download, Upload, Trash2, CheckCircle, AlertCircle,
  RefreshCw, Clock, ExternalLink
} from 'lucide-react';

export const Settings: React.FC = () => {
  const {
    connectionStatus, apiMode, lastSyncTime, syncLogs,
    checkConnection, setApiMode, exportAllData, importAllData, clearData,
  } = useApp();

  // Form state cho API credentials
  const [appId, setAppId] = useState(localStorage.getItem('silence_nhanh_app_id') || '');
  const [businessId, setBusinessId] = useState(localStorage.getItem('silence_nhanh_business_id') || '');
  const [accessToken, setAccessToken] = useState(localStorage.getItem('silence_nhanh_access_token') || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lưu credentials
  const handleSaveCredentials = () => {
    localStorage.setItem('silence_nhanh_app_id', appId.trim());
    localStorage.setItem('silence_nhanh_business_id', businessId.trim());
    localStorage.setItem('silence_nhanh_access_token', accessToken.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Test kết nối
  const handleTestConnection = async () => {
    handleSaveCredentials();
    setIsTesting(true);
    setTestResult(null);

    const ok = await checkConnection();
    setTestResult({
      ok,
      msg: ok ? 'Kết nối API Nhanh.vn thành công!' : 'Không thể kết nối. Kiểm tra lại API key và quyền truy cập.',
    });
    setIsTesting(false);
  };

  // Export JSON
  const handleExport = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silence-production-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      const result = importAllData(json);
      setImportResult({
        ok: result.success,
        msg: result.success
          ? 'Import dữ liệu thành công! Trang sẽ được làm mới.'
          : `Lỗi: ${result.error}`,
      });
      if (result.success) {
        setTimeout(() => window.location.reload(), 1500);
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Clear all
  const handleClearAll = () => {
    if (confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu? Hành động này không thể hoàn tác!')) {
      clearData();
      window.location.reload();
    }
  };

  const statusColors = {
    connected: { bg: '#e6f6ef', color: '#006c49', label: 'Đã kết nối', icon: <Wifi size={16} /> },
    sandbox: { bg: '#fef3c7', color: '#b45309', label: 'Chế độ Sandbox', icon: <WifiOff size={16} /> },
    checking: { bg: '#f3f4f6', color: '#6b7280', label: 'Đang kiểm tra...', icon: <RefreshCw size={16} /> },
    error: { bg: '#ffdad6', color: '#ba1a1a', label: 'Lỗi kết nối', icon: <WifiOff size={16} /> },
  };

  const currentStatus = statusColors[connectionStatus];

  return (
    <div className="page-container fade-in">
      <div style={styles.pageHeader}>
        <div>
          <h2 style={{ color: '#091426', fontSize: '24px', fontWeight: 700 }}>Cài đặt hệ thống</h2>
          <p style={{ color: '#8191a9', fontSize: '13px' }}>Cấu hình kết nối API Nhanh.vn, quản lý dữ liệu và sao lưu</p>
        </div>
      </div>

      <div style={styles.contentLayout}>
        {/* Left Column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '320px' }}>

          {/* Connection Status Card */}
          <div className="card">
            <div className="card-header">
              <h3>Trạng thái kết nối</h3>
            </div>

            <div style={{
              ...styles.statusBox,
              backgroundColor: currentStatus.bg,
              color: currentStatus.color,
              borderColor: currentStatus.color + '30',
            }}>
              {currentStatus.icon}
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{currentStatus.label}</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  Chế độ: {apiMode === 'live' ? 'Kết nối thực' : 'Sandbox (giả lập)'}
                </div>
              </div>
            </div>

            {lastSyncTime && (
              <div style={styles.syncTimeInfo}>
                <Clock size={12} style={{ color: '#8191a9' }} />
                <span>Đồng bộ lần cuối: {new Date(lastSyncTime).toLocaleString('vi-VN')}</span>
              </div>
            )}

            {/* API Mode Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => setApiMode('sandbox')}
                className={`btn ${apiMode === 'sandbox' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: '12px' }}
              >
                Sandbox
              </button>
              <button
                onClick={() => setApiMode('live')}
                className={`btn ${apiMode === 'live' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, fontSize: '12px' }}
              >
                Live (Kết nối thực)
              </button>
            </div>
          </div>

          {/* API Credentials Card */}
          <div className="card">
            <div className="card-header">
              <h3>Cấu hình API Nhanh.vn</h3>
              <a
                href="https://open.nhanh.vn/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#006c49', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ExternalLink size={12} />
                Tài liệu API
              </a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>
                  <Shield size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  App ID
                </label>
                <input
                  type="text"
                  placeholder="ID ứng dụng từ open.nhanh.vn"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>
                  <Shield size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Business ID
                </label>
                <input
                  type="text"
                  placeholder="Mã doanh nghiệp"
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>
                  <Shield size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Access Token
                </label>
                <input
                  type="password"
                  placeholder="Token xác thực (mã hóa hiển thị)"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
              </div>

              {saveSuccess && (
                <div style={styles.successAlert}>
                  <CheckCircle size={14} />
                  <span>Đã lưu cấu hình API!</span>
                </div>
              )}

              {testResult && (
                <div style={testResult.ok ? styles.successAlert : styles.errorAlert}>
                  {testResult.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  <span>{testResult.msg}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveCredentials} className="btn btn-secondary" style={{ flex: 1 }}>
                  Lưu cấu hình
                </button>
                <button
                  onClick={handleTestConnection}
                  className="btn btn-primary"
                  disabled={isTesting}
                  style={{ flex: 1, gap: '6px' }}
                >
                  <Wifi size={14} />
                  <span>{isTesting ? 'Đang test...' : 'Test kết nối'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Data Management Card */}
          <div className="card">
            <div className="card-header">
              <h3>Quản lý dữ liệu</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={handleExport} className="btn btn-secondary" style={{ width: '100%', gap: '8px' }}>
                <Download size={14} />
                <span>Tải xuống backup (JSON)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary"
                style={{ width: '100%', gap: '8px' }}
              >
                <Upload size={14} />
                <span>Import dữ liệu từ file JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />

              {importResult && (
                <div style={importResult.ok ? styles.successAlert : styles.errorAlert}>
                  {importResult.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  <span>{importResult.msg}</span>
                </div>
              )}

              <div style={styles.dangerZone}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ba1a1a' }}>Vùng nguy hiểm</div>
                <p style={{ fontSize: '12px', color: '#75777d', margin: '4px 0 8px' }}>
                  Xóa toàn bộ dữ liệu hệ thống. Nên tải backup trước khi xóa.
                </p>
                <button onClick={handleClearAll} className="btn" style={styles.dangerBtn}>
                  <Trash2 size={14} />
                  <span>Xóa toàn bộ dữ liệu</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sync Logs */}
        <div className="card" style={{ flex: 1.5, minWidth: '400px', height: 'fit-content' }}>
          <div className="card-header">
            <h3>Lịch sử đồng bộ</h3>
            <span className="badge badge-primary">{syncLogs.length} Bản ghi</span>
          </div>

          <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Nguồn</th>
                  <th>Hành động</th>
                  <th>Kết quả</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#8191a9', padding: '40px 24px' }}>
                      Chưa có lịch sử đồng bộ nào. Nhấn "Đồng bộ" trong các trang khác để bắt đầu.
                    </td>
                  </tr>
                ) : (
                  syncLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="mono" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString('vi-VN', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                          day: '2-digit', month: '2-digit',
                        })}
                      </td>
                      <td style={{ fontWeight: 500, fontSize: '12px' }}>{log.source}</td>
                      <td style={{ fontSize: '12px' }}>{log.action}</td>
                      <td>
                        <span
                          className={`badge ${
                            log.result === 'success' ? 'badge-success' :
                            log.result === 'sandbox' ? 'badge-warning' : 'badge-error'
                          }`}
                          style={{ fontSize: '10px' }}
                        >
                          {log.result === 'success' ? 'OK' : log.result === 'sandbox' ? 'Sandbox' : 'Lỗi'}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#45474c', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.details}
                      </td>
                    </tr>
                  ))
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
  statusBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid',
  },
  syncTimeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    fontSize: '12px',
    color: '#8191a9',
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
  dangerZone: {
    marginTop: '12px',
    padding: '16px',
    borderRadius: '6px',
    border: '1px solid #fecaca',
    backgroundColor: '#fef2f2',
  },
  dangerBtn: {
    backgroundColor: '#ba1a1a',
    color: '#ffffff',
    border: 'none',
    gap: '8px',
    width: '100%',
  },
};
