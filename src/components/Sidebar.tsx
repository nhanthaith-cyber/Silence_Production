import React from 'react';
import {
  LayoutDashboard, Factory, Receipt, Boxes, Package, Sparkles, Settings, RotateCcw
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  onReset: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, onReset }) => {
  const menuItems = [
    { key: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { key: 'production', label: 'Sản xuất', icon: Factory },
    { key: 'expenses', label: 'Chi phí & Đồng bộ', icon: Receipt },
    { key: 'inventory', label: 'Tồn kho', icon: Boxes },
    { key: 'products', label: 'Sản phẩm', icon: Package },
    { key: 'ai', label: 'Trợ lý AI', icon: Sparkles },
    { key: 'settings', label: 'Cài đặt', icon: Settings },
  ];

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

      {/* Navigation */}
      <nav style={styles.nav}>
        {menuItems.map((item) => {
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
        <button
          onClick={onReset}
          style={styles.resetBtn}
          title="Xóa dữ liệu và khôi phục mặc định"
        >
          <RotateCcw size={14} />
          <span>Đặt lại dữ liệu</span>
        </button>
        <div style={styles.version} className="mono">v2.0 — Production</div>
      </div>
    </aside>
  );
};

const styles = {
  sidebar: {
    width: '240px',
    minHeight: '100vh',
    backgroundColor: '#091426',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '0',
    position: 'sticky' as const,
    top: 0,
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
    background: 'none',
    border: 'none',
    color: '#a8b8cc',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'all 0.15s ease',
    width: '100%',
  },
  navItemActive: {
    backgroundColor: 'rgba(0, 108, 73, 0.12)',
    color: '#ffffff',
    fontWeight: 600,
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
    background: 'none',
    border: 'none',
    color: '#6b91b8',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '6px 0',
  },
  version: {
    fontSize: '10px',
    color: '#3e5573',
    textAlign: 'center' as const,
  },
};
