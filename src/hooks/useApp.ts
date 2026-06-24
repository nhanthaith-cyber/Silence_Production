import { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import type { AppContextType } from '../types';

/**
 * Hook truy cập AppContext — tập trung toàn bộ state và actions
 */
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp phải được sử dụng bên trong AppProvider');
  }
  return context;
};
