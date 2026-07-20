/**
 * Firebase Configuration — Khởi tạo Firebase App và Realtime Database
 *
 * Config được đọc từ biến môi trường (.env.local).
 * Nếu thiếu config → Firebase sẽ bị tắt, app vẫn chạy bình thường với LocalStorage.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

// Đọc config từ biến môi trường Vite với fallback cứng để tự động chạy trên GitHub Pages
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCPjFfS6LqbWGnrFxZ4XHzWEqAz6v-coNc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'silence-production-7457d.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://silence-production-7457d-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'silence-production-7457d',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'silence-production-7457d.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '300640955626',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:300640955626:web:e9bca133325dd3d8e8fb93',
};

/** Kiểm tra xem Firebase config có hợp lệ (đã được cấu hình) hay chưa */
export const isFirebaseConfigured = (): boolean => {
  return !!(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
};

let app: FirebaseApp | null = null;
let database: Database | null = null;

/**
 * Khởi tạo Firebase App và Database instance.
 * Trả về null nếu config không hợp lệ (chưa setup Firebase).
 */
export const initFirebase = (): { app: FirebaseApp; database: Database } | null => {
  if (!isFirebaseConfigured()) {
    console.warn(
      '[Firebase] ⚠️ Firebase chưa được cấu hình. App sẽ chạy ở chế độ LocalStorage only.',
      'Hãy thêm các biến VITE_FIREBASE_* vào file .env.local'
    );
    return null;
  }

  try {
    if (!app) {
      app = initializeApp(firebaseConfig);
      console.log('[Firebase] ✅ Firebase App đã khởi tạo thành công.');
    }

    if (!database) {
      database = getDatabase(app);
      console.log('[Firebase] ✅ Realtime Database đã kết nối:', firebaseConfig.databaseURL);
    }

    return { app, database };
  } catch (error) {
    console.error('[Firebase] ❌ Lỗi khởi tạo Firebase:', error);
    return null;
  }
};

/** Lấy Database instance (có thể null nếu chưa init hoặc config sai) */
export const getFirebaseDatabase = (): Database | null => database;

/** Lấy Firebase App instance */
export const getFirebaseApp = (): FirebaseApp | null => app;
