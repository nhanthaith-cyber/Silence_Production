import React from 'react';
import {
  LayoutDashboard, Factory, Receipt, Boxes, Package, Sparkles, Settings, RotateCcw, LogOut, TrendingUp, Cloud, CloudOff
} from 'lucide-react';
import type { User } from '../types';
import { useApp } from '../hooks/useApp';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  onReset: () => void;
  user: User;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, onReset, user, onLogout }) => {
  const { firebaseSyncStatus } = useApp();

  const getSyncLabel = () => {
    switch (firebaseSyncStatus) {
      case 'connected': return 'Cloud đã kết nối';
      case 'syncing': return 'Đang đồng bộ...';
      case 'connecting': return 'Đang kết nối...';
      case 'error': return 'Lỗi kết nối Cloud';
      default: return 'Cloud chưa cài đặt';
    }
  };

  const getSyncColor = () => {
    switch (firebaseSyncStatus) {
      case 'connected': return '#34d399';
      case 'syncing': return '#fbbf24';
      case 'connecting': return '#fbbf24';
      case 'error': return '#f87171';
      default: return '#6b7280';
    }
  };
  const menuItems = [
    { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { key: 'production', label: 'Sản xuất', icon: Factory },
    { key: 'expenses', label: 'Chi phí & Đồng bộ', icon: Receipt },
    { key: 'inventory', label: 'Tồn kho', icon: Boxes },
    { key: 'products', label: 'Sản phẩm', icon: Package },
    { key: 'forecast', label: 'Dự báo gọi hàng', icon: TrendingUp },
    { key: 'ai', label: 'Trợ lý AI', icon: Sparkles },
    { key: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  // Cấp quyền hiển thị theo tài khoản (cho phép cấu hình linh hoạt) hoặc fallback theo Role
  const roleAccess: Record<string, string[]> = {
    admin: ['dashboard', 'production', 'expenses', 'inventory', 'products', 'forecast', 'ai', 'settings'],
    production: ['dashboard', 'production', 'products', 'ai'],
    finance: ['dashboard', 'expenses', 'settings'],
    warehouse: ['dashboard', 'inventory', 'products', 'forecast'],
  };

  const allowedPages = user.allowedPages || roleAccess[user.role] || ['dashboard'];
  const filteredMenuItems = menuItems.filter((item) => allowedPages.includes(item.key));

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'QL Toàn Quyền';
      case 'production': return 'QL Sản Xuất';
      case 'finance': return 'QL Tài Chính';
      case 'warehouse': return 'Thủ Kho';
      default: return 'Nhân Viên';
    }
  };

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logoSection}>
        <div style={styles.logoIcon}>
          <span style={styles.logoLetter}>S</span>
        </div>
        <div>
          <div style={styles.logoTitle}>Silence</div>
          <div style={styles.logoSub}>Production</div>
        </div>
      </div>

      {/* User profile section */}
      <div style={styles.userSection}>
        <div style={styles.userAvatar}>
          {user.name.charAt(0)}
        </div>
        <div style={styles.userInfo}>
          <div style={styles.userName}>{user.name}</div>
          <div style={styles.userRoleBadge}>{getRoleLabel(user.role)}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {filteredMenuItems.map((item) => {
          const isActive = currentPage === item.key;
          const IconComponent = item.icon;
          return (
            <button
              key={item.key}
              id={`nav-${item.key}`}
              onClick={() => setCurrentPage(item.key)}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              }}
            >
              <IconComponent
                size={18}
                style={{ color: isActive ? '#006c49' : '#8191a9' }}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={styles.footer}>
        {/* Cloud Sync Status */}
        <div style={styles.syncStatus}>
          {firebaseSyncStatus === 'disabled' ? (
            <CloudOff size={13} style={{ color: getSyncColor() }} />
          ) : (
            <Cloud size={13} style={{ color: getSyncColor() }} />
          )}
          <span style={{ ...styles.syncLabel, color: getSyncColor() }}>
            <span style={{ ...styles.syncDot, backgroundColor: getSyncColor() }} />
            {getSyncLabel()}
          </span>
        </div>

        <button
          onClick={onReset}
          style={styles.resetBtn}
          title="Xóa dữ liệu và khôi phục mặc định"
        >
          <RotateCcw size={14} />
          <span>Đặt lại dữ liệu</span>
        </button>
        <button
          onClick={onLogout}
          style={styles.logoutBtn}
          title="Đăng xuất khỏi hệ thống"
        >
          <LogOut size={14} />
          <span>Đăng xuất</span>
        </button>
        <div style={styles.version} className="mono">v2.1 — Cloud Sync</div>
      </div>
    </aside>
  );
};

const styles = {
  sidebar: {
    width: '240px',
    height: '100vh',
    backgroundColor: '#091426',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '0',
    position: 'fixed' as const,
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logoIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#091426',
  },
  logoTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '0.5px',
  },
  logoSub: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#6b91b8',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '16px 12px',
    gap: '2px',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#a8b8cc',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.15s ease',
    width: '100%',
    outline: 'none',
    boxShadow: 'none',
  },
  navItemActive: {
    backgroundColor: 'rgba(0, 108, 73, 0.12)',
    color: '#ffffff',
    fontWeight: 600,
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#006c49',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '14px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  userName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#ffffff',
  },
  userRoleBadge: {
    alignSelf: 'flex-start',
    fontSize: '10px',
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: 'rgba(0,108,73,0.3)',
    border: '1px solid rgba(0,108,73,0.4)',
    padding: '1px 5px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#6b91b8',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 0',
    outline: 'none',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ffdad6',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 0',
    transition: 'color 0.15s ease',
    outline: 'none',
  },
  version: {
    fontSize: '10px',
    color: '#3e5573',
    textAlign: 'center' as const,
  },
  syncStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 0',
    marginBottom: '4px',
  },
  syncDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '4px',
    animation: 'pulse 2s infinite',
  } as React.CSSProperties,
  syncLabel: {
    fontSize: '11px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
  },
};
