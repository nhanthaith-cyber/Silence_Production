import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../hooks/useApp';
import {
  Wifi, WifiOff, Shield, Download, Upload, Trash2, CheckCircle, AlertCircle,
  RefreshCw, Clock, ExternalLink, Link, Loader, FileSpreadsheet, FileDown, FileUp
} from 'lucide-react';
import { exportToExcel, importFromExcel, generateExcelTemplate } from '../services/excelDataService';
import type { ExcelImportResult, ExcelImportMode } from '../types';

export const Settings: React.FC = () => {
  const {
    connectionStatus, apiMode, lastSyncTime, syncLogs,
    checkConnection, setApiMode, exportAllData, importAllData, clearData,
    products, productionBatches, sales, expenses,
    users, addUser, deleteUser
  } = useApp();

  // Form state cho API credentials
  const [appId, setAppId] = useState(localStorage.getItem('silence_nhanh_app_id') || import.meta.env.VITE_NHANH_APP_ID || '');
  const [businessId, setBusinessId] = useState(localStorage.getItem('silence_nhanh_business_id') || import.meta.env.VITE_NHANH_BUSINESS_ID || '');
  const [accessToken, setAccessToken] = useState(localStorage.getItem('silence_nhanh_access_token') || import.meta.env.VITE_NHANH_ACCESS_TOKEN || '');
  const [secretKey, setSecretKey] = useState(localStorage.getItem('silence_nhanh_secret_key') || import.meta.env.VITE_NHANH_SECRET_KEY || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [oauthStatus, setOauthStatus] = useState<{ type: 'info' | 'success' | 'error'; msg: string } | null>(null);
  const [isExchanging, setIsExchanging] = useState(false);

  // Excel import state
  const [excelPreview, setExcelPreview] = useState<ExcelImportResult | null>(null);
  const [excelImportMode, setExcelImportMode] = useState<ExcelImportMode>('overwrite');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [showExcelConfirm, setShowExcelConfirm] = useState(false);
  const [excelSuccess, setExcelSuccess] = useState<string | null>(null);

  // User Management State
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newAllowedPages, setNewAllowedPages] = useState<string[]>(['dashboard']);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  const menuOptions = [
    { key: 'dashboard', label: 'Tổng quan' },
    { key: 'production', label: 'Sản xuất' },
    { key: 'expenses', label: 'Chi phí & Bán hàng' },
    { key: 'inventory', label: 'Tồn kho' },
    { key: 'products', label: 'Sản phẩm' },
    { key: 'forecast', label: 'Dự báo gọi hàng' },
    { key: 'ai', label: 'Trợ lý AI' },
    { key: 'settings', label: 'Cài đặt' },
  ];

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');

    if (!newUsername.trim() || !newName.trim() || !newPassword.trim() || !newRole.trim()) {
      setUserError('Vui lòng nhập đầy đủ thông tin tài khoản!');
      return;
    }

    if (newAllowedPages.length === 0) {
      setUserError('Vui lòng chọn ít nhất 1 quyền truy cập trang!');
      return;
    }

    const res = addUser({
      username: newUsername.trim().toLowerCase(),
      password: newPassword.trim(),
      name: newName.trim(),
      role: newRole.trim(),
      allowedPages: newAllowedPages,
    });

    if (res.success) {
      setUserSuccess('Đã thêm tài khoản thành công!');
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      setNewRole('');
      setNewAllowedPages(['dashboard']);
    } else {
      setUserError(res.error || 'Lỗi thêm tài khoản');
    }
  };

  const handleDeleteUserClick = (username: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}"?`)) {
      const res = deleteUser(username);
      if (res.success) {
        setUserSuccess(`Đã xóa tài khoản "${username}" thành công!`);
      } else {
        setUserError(res.error || 'Lỗi khi xóa tài khoản');
      }
    }
  };

  const handlePageCheckboxChange = (pageKey: string) => {
    setNewAllowedPages(prev =>
      prev.includes(pageKey)
        ? prev.filter(p => p !== pageKey)
        : [...prev, pageKey]
    );
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

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
      const isProduction = import.meta.env.PROD;
      // Nhanh.vn v3.0 yêu cầu truyền appId trên URL query string (?appId=...), kể cả khi gửi yêu cầu POST
      const targetUrl = `https://pos.open.nhanh.vn/v3.0/app/getaccesstoken?appId=${savedAppId}`;
      
      // Sử dụng public CORS proxy trong production (GitHub Pages) để vượt qua giới hạn CORS
      const fetchUrl = isProduction
        ? `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`
        : `/nhanh-v3/v3.0/app/getaccesstoken?appId=${savedAppId}`; // Dev sử dụng Vite proxy

      const payload = {
        appId: savedAppId,
        secretKey: savedSecretKey,
        accessCode: code
      };

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
          // Tự động chuyển sang mode Live sau khi OAuth thành công
          localStorage.setItem('silence_nhanh_api_mode', 'live');
          setApiMode('live');
          setOauthStatus({ type: 'success', msg: '✅ Lấy Access Token thành công! Đã lưu và chuyển sang chế độ Live.' });
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

    // Nhanh.vn yêu cầu redirect URI phải là HTTPS
    if (window.location.protocol !== 'https:') {
      setOauthStatus({
        type: 'error',
        msg: '⚠️ Nhanh.vn yêu cầu HTTPS cho OAuth. Vui lòng thực hiện OAuth trên trang GitHub Pages (https://nhanthaith-cyber.github.io/Silence_Production/) rồi quay lại đây.',
      });
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
    if (secretKey.trim()) {
      localStorage.setItem('silence_nhanh_secret_key', secretKey.trim());
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Test kết nối
  const handleTestConnection = async () => {
    // Lưu credentials trước
    handleSaveCredentials();
    // Đảm bảo mode là Live khi test
    if (apiMode !== 'live') {
      localStorage.setItem('silence_nhanh_api_mode', 'live');
      setApiMode('live');
    }
    setIsTesting(true);
    setTestResult(null);

    // Debug: log credentials để kiểm tra
    const debugAppId = localStorage.getItem('silence_nhanh_app_id');
    const debugBizId = localStorage.getItem('silence_nhanh_business_id');
    const debugToken = localStorage.getItem('silence_nhanh_access_token');
    const debugMode = localStorage.getItem('silence_nhanh_api_mode');
    console.log('[DEBUG] Test kết nối:', {
      appId: debugAppId,
      businessId: debugBizId,
      hasToken: !!debugToken && debugToken.length > 0,
      tokenLength: debugToken?.length || 0,
      mode: debugMode,
    });

    const ok = await checkConnection();
    setTestResult({
      ok,
      msg: ok
        ? 'Kết nối API Nhanh.vn thành công!'
        : `Không thể kết nối. Mode: ${debugMode}, AppID: ${debugAppId || '(trống)'}, BizID: ${debugBizId || '(trống)'}, Token: ${debugToken ? `${debugToken.length} ký tự` : '(trống)'}`,
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

  // ── Excel Handlers ──

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
    const jsonStr = JSON.stringify({
      version: '1.0',
      exportedAt: excelPreview.parsedAt,
      products: excelImportMode === 'overwrite' ? excelPreview.products : [...products, ...excelPreview.products.filter(p => !products.find(ep => ep.sku === p.sku))],
      productionBatches: excelImportMode === 'overwrite' ? excelPreview.productionBatches : [...productionBatches, ...excelPreview.productionBatches.filter(b => !productionBatches.find(eb => eb.id === b.id))],
      sales: excelImportMode === 'overwrite' ? excelPreview.sales : [...sales, ...excelPreview.sales.filter(s => !sales.find(es => es.id === s.id))],
      expenses: excelImportMode === 'overwrite' ? excelPreview.expenses : [...expenses, ...excelPreview.expenses.filter(ex => !expenses.find(ee => ee.id === ex.id))],
    });
    const result = importAllData(jsonStr);
    if (result.success) {
      const mode = excelImportMode === 'overwrite' ? 'Ghi đè' : 'Thêm mới';
      setExcelSuccess(`✅ [${mode}] Import thành công: ${excelPreview.products.length} sản phẩm, ${excelPreview.sales.length} đơn hàng, ${excelPreview.expenses.length} chi phí, ${excelPreview.productionBatches.length} lô SX.`);
      setShowExcelConfirm(false);
      setExcelPreview(null);
      setTimeout(() => window.location.reload(), 2000);
    } else {
      setExcelError(`Lỗi import: ${result.error}`);
      setShowExcelConfirm(false);
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
              {/* ── JSON Backup/Restore ── */}
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8191a9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Backup JSON</div>
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

              {/* ── Excel Section ── */}
              <div style={{ height: '1px', background: '#e8edf4', margin: '4px 0' }} />
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8191a9', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={13} />
                Cập nhật qua Excel
              </div>

              <button
                onClick={generateExcelTemplate}
                className="btn btn-secondary"
                style={{ width: '100%', gap: '8px', borderColor: '#1a7f3f', color: '#1a7f3f' }}
              >
                <FileDown size={14} />
                <span>Tải template Excel mẫu</span>
              </button>

              <button
                onClick={() => { const { products: p, productionBatches: b, sales: s, expenses: ex } = { products, productionBatches, sales, expenses }; exportToExcel(p, b, s, ex); }}
                className="btn btn-secondary"
                style={{ width: '100%', gap: '8px', borderColor: '#1a7f3f', color: '#1a7f3f' }}
              >
                <FileSpreadsheet size={14} />
                <span>Xuất dữ liệu hiện tại ra Excel</span>
              </button>

              <button
                onClick={() => excelFileInputRef.current?.click()}
                className="btn btn-secondary"
                disabled={isParsingExcel}
                style={{ width: '100%', gap: '8px', borderColor: '#1a56db', color: '#1a56db' }}
              >
                {isParsingExcel
                  ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /><span>Đang đọc file...</span></>
                  : <><FileUp size={14} /><span>Import từ file Excel (.xlsx)</span></>}
              </button>
              <input
                ref={excelFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileChange}
                style={{ display: 'none' }}
              />

              {excelError && (
                <div style={styles.errorAlert}>
                  <AlertCircle size={14} />
                  <span>{excelError}</span>
                </div>
              )}

              {excelSuccess && (
                <div style={styles.successAlert}>
                  <CheckCircle size={14} />
                  <span>{excelSuccess}</span>
                </div>
              )}

              {/* ── Excel Confirm Modal ── */}
              {showExcelConfirm && excelPreview && (
                <div style={styles.excelModal}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileSpreadsheet size={16} color="#1a56db" /> Xác nhận import Excel
                  </div>
                  <div style={{ fontSize: '12px', color: '#45474c', marginBottom: '8px' }}>
                    Đọc lúc: {new Date(excelPreview.parsedAt).toLocaleString('vi-VN')}
                  </div>

                  <div style={styles.previewGrid}>
                    <div style={styles.previewItem}><span style={styles.previewNum}>{excelPreview.products.length}</span><span style={styles.previewLabel}>Sản phẩm</span></div>
                    <div style={styles.previewItem}><span style={styles.previewNum}>{excelPreview.sales.length}</span><span style={styles.previewLabel}>Đơn hàng</span></div>
                    <div style={styles.previewItem}><span style={styles.previewNum}>{excelPreview.expenses.length}</span><span style={styles.previewLabel}>Chi phí</span></div>
                    <div style={styles.previewItem}><span style={styles.previewNum}>{excelPreview.productionBatches.length}</span><span style={styles.previewLabel}>Lô SX</span></div>
                  </div>

                  {excelPreview.warnings.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '8px', borderRadius: '4px', marginBottom: '10px', maxHeight: '80px', overflowY: 'auto' }}>
                      {excelPreview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                    </div>
                  )}

                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#45474c' }}>Chọn chế độ import:</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <label style={styles.radioLabel}>
                      <input type="radio" name="excelMode" value="overwrite"
                        checked={excelImportMode === 'overwrite'}
                        onChange={() => setExcelImportMode('overwrite')} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#ba1a1a', fontSize: '12px' }}>Ghi đè</div>
                        <div style={{ fontSize: '11px', color: '#75777d' }}>Xóa data cũ, thay bằng data từ Excel</div>
                      </div>
                    </label>
                    <label style={styles.radioLabel}>
                      <input type="radio" name="excelMode" value="append"
                        checked={excelImportMode === 'append'}
                        onChange={() => setExcelImportMode('append')} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#006c49', fontSize: '12px' }}>Thêm mới</div>
                        <div style={{ fontSize: '11px', color: '#75777d' }}>Giữ data cũ, thêm data mới từ Excel</div>
                      </div>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setShowExcelConfirm(false); setExcelPreview(null); }} className="btn btn-secondary" style={{ flex: 1 }}>Hủy</button>
                    <button onClick={handleConfirmExcelImport} className="btn btn-primary" style={{ flex: 1 }}>Xác nhận</button>
                  </div>
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

        {/* User Management Card */}
        <div className="card">
          <div className="card-header">
            <h3>Quản lý tài khoản & Cấp quyền</h3>
            <span className="badge badge-primary">{users.length} Tài khoản</span>
          </div>

          {/* List of existing users */}
          <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Tên Đăng Nhập</th>
                  <th>Tên Hiển Thị</th>
                  <th>Chức Danh</th>
                  <th>Quyền Truy Cập</th>
                  <th>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.username}>
                    <td className="mono" style={{ fontWeight: 600, fontSize: '13px' }}>{u.username}</td>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td>
                      <span className="badge badge-primary" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                        {u.role === 'admin' ? 'QL Toàn Quyền' : u.role === 'production' ? 'QL Sản Xuất' : u.role === 'finance' ? 'QL Tài Chính' : u.role === 'warehouse' ? 'Thủ Kho' : u.role}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {u.allowedPages.map((page) => (
                          <span key={page} style={{ fontSize: '10px', padding: '2px 6px', background: '#eceef0', borderRadius: '4px', color: '#1e293b', fontWeight: 600 }}>
                            {page === 'dashboard' ? 'Tổng quan' :
                             page === 'production' ? 'Sản xuất' :
                             page === 'expenses' ? 'Chi phí' :
                             page === 'inventory' ? 'Tồn kho' :
                             page === 'products' ? 'Sản phẩm' :
                             page === 'forecast' ? 'Dự báo' :
                             page === 'ai' ? 'AI' : 'Cài đặt'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleDeleteUserClick(u.username)}
                        disabled={u.username === 'admin'}
                        className="btn btn-danger"
                        style={{ padding: '4px 8px', fontSize: '11px', minWidth: 'auto', cursor: u.username === 'admin' ? 'not-allowed' : 'pointer' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Create new user form */}
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '16px', marginTop: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#091426' }}>Thêm tài khoản mới</h4>
            
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '11px' }}>Tên đăng nhập</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: nhanvienmay"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                    style={{ padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '11px' }}>Mật khẩu</label>
                  <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{ padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '11px' }}>Tên hiển thị</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    style={{ padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '11px' }}>Chức danh / Vai trò</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Nhân viên may"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    required
                    style={{ padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Checkbox list of allowed pages */}
              <div className="form-group">
                <label style={{ fontSize: '11px', marginBottom: '4px' }}>Cấp quyền truy cập các trang</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  {menuOptions.map((opt) => {
                    const isChecked = newAllowedPages.includes(opt.key);
                    return (
                      <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'none', fontSize: '13px', fontWeight: 500, color: '#334155', cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handlePageCheckboxChange(opt.key)}
                          style={{ width: 'auto', cursor: 'pointer', margin: 0 }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {userError && (
                <div style={{ ...styles.errorAlert, padding: '8px 10px', fontSize: '12px' }}>
                  <AlertCircle size={14} />
                  <span>{userError}</span>
                </div>
              )}

              {userSuccess && (
                <div style={{ ...styles.successAlert, padding: '8px 10px', fontSize: '12px' }}>
                  <CheckCircle size={14} />
                  <span>{userSuccess}</span>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: '#091426', marginTop: '4px' }}>
                Tạo tài khoản & Cấp quyền
              </button>
            </form>
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
  excelModal: {
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #bfdbfe',
    backgroundColor: '#eff6ff',
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '8px',
    marginBottom: '12px',
  },
  previewItem: {
    textAlign: 'center' as const,
    padding: '8px 4px',
    background: '#fff',
    borderRadius: '6px',
    border: '1px solid #e0e7f0',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
  },
  previewNum: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1a56db',
  },
  previewLabel: {
    fontSize: '10px',
    color: '#75777d',
  },
  radioLabel: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #e0e7f0',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
};
