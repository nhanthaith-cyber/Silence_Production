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
import { AIAssistant } from './components/AIAssistant';
import { Login } from './components/Login';
import type { User } from './types';

const MainAppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { clearData } = useApp();

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('silence_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user:', e);
        localStorage.removeItem('silence_user');
      }
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
    setUser(loggedUser);
    localStorage.setItem('silence_user', JSON.stringify(loggedUser));
    // Sau khi đăng nhập luôn chuyển vào trang Tổng quan (Dashboard)
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('silence_user');
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
