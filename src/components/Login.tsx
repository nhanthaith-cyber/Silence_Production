import React, { useState } from 'react';
import type { User } from '../types';
import { Lock, User as UserIcon, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const PREDEFINED_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: 'silence@2026',
    user: { username: 'admin', name: 'Quản trị viên', role: 'admin' },
  },
  production: {
    password: 'production@2026',
    user: { username: 'production', name: 'Quản lý Sản xuất', role: 'production' },
  },
  finance: {
    password: 'finance@2026',
    user: { username: 'finance', name: 'Quản lý Tài chính', role: 'finance' },
  },
  warehouse: {
    password: 'warehouse@2026',
    user: { username: 'warehouse', name: 'Thủ kho', role: 'warehouse' },
  },
};

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    const account = PREDEFINED_USERS[cleanUsername];

    if (!account || account.password !== password) {
      setError('Tài khoản hoặc mật khẩu không chính xác!');
      return;
    }

    onLogin(account.user);
  };

  return (
    <div style={styles.loginContainer}>
      {/* Background Orbs */}
      <div style={styles.orb1}></div>
      <div style={styles.orb2}></div>

      {/* Login Card */}
      <div style={styles.loginCard}>
        <div style={styles.header}>
          <div style={styles.logoIcon}>
            <span style={styles.logoLetter}>S</span>
          </div>
          <h2 style={styles.title}>Silence Production</h2>
          <p style={styles.subtitle}>Hệ thống Điều phối & Quản lý Xưởng sản xuất</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="form-group" style={styles.formGroup}>
            <label style={styles.label}>Tên đăng nhập</label>
            <div style={styles.inputWrapper}>
              <UserIcon size={16} style={styles.inputIcon} />
              <input
                type="text"
                placeholder="Nhập username (admin, production...)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          <div className="form-group" style={styles.formGroup}>
            <label style={styles.label}>Mật khẩu</label>
            <div style={styles.inputWrapper}>
              <Lock size={16} style={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={styles.errorAlert}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={styles.submitBtn}>
            Đăng nhập hệ thống
          </button>
        </form>

        {/* Demo Credentials Helper Card */}
        <div style={styles.credentialsHelper}>
          <div style={styles.helperTitle}>Tài khoản vận hành mặc định:</div>
          <div style={styles.helperGrid}>
            <div>
              <strong>admin</strong> / silence@2026
              <span style={styles.roleTag}>Admin</span>
            </div>
            <div>
              <strong>production</strong> / production@2026
              <span style={styles.roleTag}>Sản xuất</span>
            </div>
            <div>
              <strong>finance</strong> / finance@2026
              <span style={styles.roleTag}>Tài chính</span>
            </div>
            <div>
              <strong>warehouse</strong> / warehouse@2026
              <span style={styles.roleTag}>Thủ kho</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  loginContainer: {
    position: 'relative' as const,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050c18',
    overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
  },
  orb1: {
    position: 'absolute' as const,
    top: '-15%',
    left: '-10%',
    width: '50vw',
    height: '50vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,108,73,0.2) 0%, rgba(0,0,0,0) 70%)',
    zIndex: 1,
    filter: 'blur(40px)',
  },
  orb2: {
    position: 'absolute' as const,
    bottom: '-15%',
    right: '-10%',
    width: '50vw',
    height: '50vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(9,20,38,0.6) 0%, rgba(0,0,0,0) 70%)',
    zIndex: 1,
    filter: 'blur(40px)',
  },
  loginCard: {
    position: 'relative' as const,
    zIndex: 10,
    width: '100%',
    maxWidth: '440px',
    backgroundColor: 'rgba(9, 20, 38, 0.65)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '40px 32px 32px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    margin: '16px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    textAlign: 'center' as const,
  },
  logoIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
    boxShadow: '0 4px 12px rgba(255,255,255,0.15)',
  },
  logoLetter: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#091426',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#8191a9',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6b91b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  inputWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute' as const,
    left: '12px',
    color: '#8191a9',
  },
  input: {
    width: '100%',
    padding: '12px 12px 12px 40px',
    backgroundColor: 'rgba(5, 12, 24, 0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  eyeBtn: {
    position: 'absolute' as const,
    right: '12px',
    background: 'none',
    border: 'none',
    color: '#8191a9',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
  },
  errorAlert: {
    padding: '10px 12px',
    backgroundColor: 'rgba(186, 26, 26, 0.15)',
    border: '1px solid rgba(186, 26, 26, 0.3)',
    color: '#ffdad6',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#006c49',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '14px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginTop: '4px',
  },
  credentialsHelper: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '12px',
    color: '#8191a9',
  },
  helperTitle: {
    fontWeight: 600,
    marginBottom: '8px',
    color: '#6b91b8',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
  },
  helperGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '6px',
  },
  roleTag: {
    float: 'right' as const,
    fontSize: '9px',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: '1px 5px',
    borderRadius: '3px',
    color: '#a8b8cc',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
  },
};
