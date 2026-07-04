import React, { useState, useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import { useApp } from './hooks/useApp';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Production } from './pages/Production';
import { Expenses } from './pages/Expenses';
import { Inventory } from './pages/Inventory';
import { Products } from './pages/Products';
import { Settings } from './pages/Settings';
import { Forecast } from './pages/Forecast';
import { AIAssistant } from './components/AIAssistant';
import { Login } from './components/Login';
import type { User } from './types';

const MainAppContent: React.FC = () => {
  const { user, login, logout, clearData } = useApp();
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Detect Nhanh.vn OAuth callback
  useEffect(() => {
    // Phát hiện OAuth callback từ Nhanh.vn (?accessCode=XXXX hoặc ?code=XXXX trong URL)
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCode = urlParams.get('accessCode') || urlParams.get('code');
    if (oauthCode) {
      localStorage.setItem('silence_nhanh_oauth_code', oauthCode);
      // Xóa code khỏi URL (bảo mật)
      window.history.replaceState({}, document.title, window.location.pathname);
      // Tự động chuyển đến trang Cài đặt để hoàn tất lấy token
      setCurrentPage('settings');
    }
  }, []);

  // Dynamic page title
  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: 'Tổng quan — Silence Production',
      production: 'Sản xuất — Silence Production',
      expenses: 'Chi phí & Đồng bộ — Silence Production',
      inventory: 'Tồn kho — Silence Production',
      products: 'Sản phẩm — Silence Production',
      ai: 'Trợ lý AI — Silence Production',
      forecast: 'Dự kiến gọi hàng — Silence Production',
      settings: 'Cài đặt — Silence Production',
    };
    document.title = titles[currentPage] || 'Silence Production';
  }, [currentPage]);

  const handleResetData = () => {
    if (confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu tùy chỉnh và khôi phục dữ liệu mẫu ban đầu?')) {
      clearData();
      window.location.reload();
    }
  };

  const handleLogin = (loggedUser: User) => {
    login(loggedUser);
    // Sau khi đăng nhập luôn chuyển vào trang Tổng quan (Dashboard)
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    logout();
  };

  const getPageTitle = (page: string) => {
    switch (page) {
      case 'dashboard':
        return 'Bảng điều khiển tổng quan';
      case 'production':
        return 'Tiến độ xưởng sản xuất';
      case 'expenses':
        return 'Chi phí vận hành & Đồng bộ đơn hàng';
      case 'inventory':
        return 'Tồn kho hàng hóa chuyên sâu';
      case 'products':
        return 'Danh mục sản phẩm xưởng';
      case 'ai':
        return 'Trợ lý AI sản xuất';
      case 'forecast':
        return 'Dự kiến gọi hàng';
      case 'settings':
        return 'Cài đặt hệ thống';
      default:
        return 'Hệ thống Quản lý';
    }
  };

  const renderPage = (page: string) => {
    switch (page) {
      case 'dashboard':
        return <Dashboard />;
      case 'production':
        return <Production />;
      case 'expenses':
        return <Expenses />;
      case 'inventory':
        return <Inventory />;
      case 'products':
        return <Products />;
      case 'ai':
        return <AIAssistant />;
      case 'forecast':
        return <Forecast />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onReset={handleResetData}
        user={user}
        onLogout={handleLogout}
      />
      
      <main className="main-content">
        <Header title={getPageTitle(currentPage)} />
        {renderPage(currentPage)}
      </main>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}

export default App;
