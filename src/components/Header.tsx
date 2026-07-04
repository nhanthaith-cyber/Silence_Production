import React from 'react';
import { useApp } from '../hooks/useApp';
import { Wifi, WifiOff, Clock } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { connectionStatus, apiMode, lastSyncTime } = useApp();

  const getStatusInfo = () => {
    switch (connectionStatus) {
      case 'connected':
        return { label: 'Live', color: '#006c49', bg: '#e6f6ef', icon: <Wifi size={12} /> };
      case 'sandbox':
        return { label: 'Sandbox', color: '#b45309', bg: '#fef3c7', icon: <WifiOff size={12} /> };
      case 'checking':
        return { label: 'Đang kiểm tra...', color: '#6b7280', bg: '#f3f4f6', icon: <Wifi size={12} /> };
      case 'error':
        return { label: 'Lỗi kết nối', color: '#ba1a1a', bg: '#ffdad6', icon: <WifiOff size={12} /> };
      default:
        return { label: 'Sandbox', color: '#b45309', bg: '#fef3c7', icon: <WifiOff size={12} /> };
    }
  };

  const status = getStatusInfo();

  const formatSyncTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  return (
    <header style={styles.header}>
      <div>
        <h1 style={styles.title}>{title}</h1>
      </div>

      <div style={styles.rightSection}>
        {/* Sync Time */}
        {lastSyncTime && (
          <div style={styles.syncInfo}>
            <Clock size={12} style={{ color: '#8191a9' }} />
            <span style={styles.syncText}>Sync: {formatSyncTime(lastSyncTime)}</span>
          </div>
        )}

        {/* API Mode Badge */}
        <div style={styles.modeBadge}>
          <span className="mono" style={{ fontSize: '10px', color: '#8191a9', textTransform: 'uppercase' }}>
            {apiMode}
          </span>
        </div>

        {/* Connection Status */}
        <div
          style={{
            ...styles.statusBadge,
            backgroundColor: status.bg,
            color: status.color,
            borderColor: status.color + '30',
          }}
        >
          {status.icon}
          <span>{status.label}</span>
        </div>
      </div>
    </header>
  );
};

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    borderBottom: '1px solid #eceef0',
    marginBottom: '24px',
  } as React.CSSProperties,
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#091426',
    margin: 0,
  } as React.CSSProperties,
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,
  syncInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties,
  syncText: {
    fontSize: '11px',
    color: '#8191a9',
    fontWeight: 500,
  } as React.CSSProperties,
  modeBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: '#f2f4f6',
    border: '1px solid #e0e3e5',
  } as React.CSSProperties,
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    border: '1px solid',
  } as React.CSSProperties,
};
