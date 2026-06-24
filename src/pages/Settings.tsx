import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import {
  Wifi, WifiOff, Shield, Download, Upload, Trash2, CheckCircle, AlertCircle,
  RefreshCw, Clock, ExternalLink, Link, Loader
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
  const [secretKey, setSecretKey] = useState(localStorage.getItem('silence_nhanh_secret_key') || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [oauthStatus, setOauthStatus] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null);
  const [isExchanging, setIsExchanging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trao đổi OAuth code lấy Access Token
  const exchangeCodeForToken = async (code: string) => {
    setIsExchanging(true);
    setOauthStatus({ type: 'info', msg: 'Đang đổi OAuth code lấy Access Token...' });

    const savedAppId = localStorage.getItem('silence_nhanh_app_id') || appId.trim();
    const savedSecretKey = localStorage.getItem('silence_nhanh_secret_key') || secretKey.trim();

    if (!savedAppId || !savedSecretKey) {
      setOauthStatus({
        type: 'error',
        msg: 'Thiếu App ID hoặc Secret Key. Hãy điền vào form rồi bấm Lưu trước khi kết nối.',
      });
      setIsExchanging(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('version', '3.0');
      formData.append('appId', savedAppId);
      formData.append('secretKey', savedSecretKey);
      formData.append('accessCode', code); // Nhanh.vn v3.0 endpoint requires accessCode
      formData.append('code', code); // Fallback for some environments

      const isProduction = import.meta.env.PROD;
      const targetUrl = 'https://pos.open.nhanh.vn/v3.0/app/getaccesstoken';
      
      // Sử dụng public CORS proxy trong production (GitHub Pages) để vượt qua giới hạn CORS
      const fetchUrl = isProduction
        ? `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`
        : `/nhanh-v3/v3.0/app/getaccesstoken`; // Dev sử dụng Vite proxy

      const response = await fetch(fetchUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Trả về từ Nhanh.vn v3.0: { code: 1, data: { accessToken: "...", businessId: "..." } }
      if (data && data.code === 1 && data.data) {
        const token = data.data.accessToken;
        const bizId = data.data.businessId;

        if (token) {
          setAccessToken(token);
          localStorage.setItem('silence_nhanh_access_token', token);
          if (bizId) {
            setBusinessId(String(bizId));
            localStorage.setItem('silence_nhanh_business_id', String(bizId));
          }
          setOauthStatus({ type: 'success', msg: '✅ Lấy Access Token thành công! Đã lưu vào hệ thống.' });
        } else {
          throw new Error('Không tìm thấy accessToken trong dữ liệu trả về.');
        }
      } else {
        const errorMsg = data?.messages?.[0] || data?.message || JSON.stringify(data);
        throw new Error(errorMsg || 'Phản hồi lỗi từ server Nhanh.vn');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setOauthStatus({
        type: 'error',
        msg: `Không thể tự động lấy token: ${errMsg}. Bạn có thể dùng Postman/curl gửi POST tới "https://pos.open.nhanh.vn/v3.0/app/getaccesstoken" với các tham số (appId, secretKey, accessCode: "${code}") để lấy token và tự nhập vào ô bên dưới.`,
      });
    } finally {
      setIsExchanging(false);
    }
  };

  // Phát hiện OAuth code sau khi redirect từ Nhanh.vn
  useEffect(() => {
    const code = localStorage.getItem('silence_nhanh_oauth_code');
    if (code) {
      localStorage.removeItem('silence_nhanh_oauth_code');
      exchangeCodeForToken(code);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mở trang OAuth Nhanh.vn
  const handleNhanhConnect = () => {
    const id = appId.trim();
    if (!id) {
      setOauthStatus({ type: 'error', msg: 'Vui lòng nhập App ID trước.' });
      return;
    }
    // Lưu App ID và Secret Key
    localStorage.setItem('silence_nhanh_app_id', id);
    if (secretKey.trim()) localStorage.setItem('silence_nhanh_secret_key', secretKey.trim());
    if (businessId.trim()) localStorage.setItem('silence_nhanh_business_id', businessId.trim());

    const redirectUri = encodeURIComponent(`${window.location.origin}${window.location.pathname}`);
    const scopes = encodeURIComponent('viewOrder,updateInventory,updateProduct,viewProduct');
    // Nhanh.vn v3.0 sử dụng parameter returnLink hoặc redirectUri, và version=v3.0
    const oauthUrl = `https://nhanh.vn/oauth?version=v3.0&appId=${id}&redirectUri=${redirectUri}&returnLink=${redirectUri}&responseType=code&scopes=${scopes}`;
    window.location.href = oauthUrl;
  };

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
                  Secret Key
                </label>
                <input
                  type="password"
                  placeholder="Secret key từ open.nhanh.vn"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
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

              {/* OAuth Connect Button */}
              <button
                onClick={handleNhanhConnect}
                disabled={isExchanging}
                className="btn btn-secondary"
                style={{ width: '100%', gap: '8px', borderColor: '#006c49', color: '#006c49' }}
              >
                {isExchanging
                  ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /><span>Đang lấy token...</span></>
                  : <><Link size={14} /><span>Kết nối Nhanh.vn (OAuth)</span></>}
              </button>

              {/* OAuth Status */}
              {oauthStatus && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  backgroundColor: oauthStatus.type === 'success' ? '#e6f6ef' : oauthStatus.type === 'error' ? '#ffdad6' : '#e8f0fe',
                  color: oauthStatus.type === 'success' ? '#006c49' : oauthStatus.type === 'error' ? '#ba1a1a' : '#1a56db',
                  border: `1px solid ${oauthStatus.type === 'success' ? '#c8f5e2' : oauthStatus.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
                  wordBreak: 'break-word' as const,
                }}>
                  {oauthStatus.type === 'success' ? <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> :
                   oauthStatus.type === 'error' ? <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> :
                   <RefreshCw size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
                  <span>{oauthStatus.msg}</span>
                </div>
              )}

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
