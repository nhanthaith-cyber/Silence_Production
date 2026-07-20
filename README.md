# Silence Production

Chào mừng bạn đến với dự án **Silence Production**! Đây là tài liệu hướng dẫn phát triển và khởi chạy dự án dành cho lập trình viên.

---

## 🚀 Hướng dẫn khởi đầu nhanh (Quick Start)

### 1. Yêu cầu hệ thống
- Node.js (phiên bản `>= 18.x` khuyến nghị) hoặc môi trường runtime tương thích tùy thuộc vào stack được chọn.
- Trình quản lý gói: `npm`, `yarn`, hoặc `pnpm`.

### 2. Cài đặt các gói phụ thuộc (Dependencies)
```bash
# Sử dụng npm
npm install

# Hoặc sử dụng pnpm / yarn
pnpm install
# yarn install
```

### 3. Chạy dự án ở môi trường phát triển (Development)
```bash
npm run dev
```

### 4. Cấu hình biến môi trường (Environment Variables)
Để kích hoạt tính năng **Đồng bộ đám mây (Firebase Realtime Database)**, hãy mở file cục bộ [`.env.local`](file:///.env.local) ở thư mục gốc và điền thông số cấu hình Firebase của bạn:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_DATABASE_URL=your_database_url  # Vị trí Singapore (asia-southeast1) khuyến nghị
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```
*(Nếu chưa cấu hình, ứng dụng sẽ tự động rơi vào chế độ ngoại tuyến - LocalStorage fallback).*

### 5. Xây dựng bản Production (Build)
```bash
npm run build
```

### 6. Đẩy bản build lên GitHub Pages (Deploy)
```bash
npm run deploy
```

---

## 📂 Cấu trúc thư mục dự án

```text
your-project/
│
├── GEMINI.md                   ⭐ Context chính cho AI
├── README.md                   📖 Giới thiệu dự án (cho người)
│
├── docs/                       📋 Thư mục chứa tài liệu đặc tả dự án
│   ├── requirement/            📋 Yêu cầu chức năng
│   │   └── requirement.md
│   ├── flow/                   🏗️ Kiến trúc hệ thống & luồng dữ liệu
│   │   └── architecture.md
│   ├── technology/             📐 Quy ước, API & Database
│   │   ├── conventions.md
│   │   ├── api.md
│   │   └── database.md
│   └── template/               🎨 Mẫu thiết kế UI/UX các phân hệ
│
└── src/                        🛠️ Mã nguồn chính ứng dụng React/Vite
```

---

## 📐 Quy ước và Tài liệu

Để tìm hiểu chi tiết hơn về dự án, vui lòng đọc các tài liệu sau trong thư mục `/docs`:
- **Đặc tả yêu cầu:** Xem [requirement.md](docs/requirement/requirement.md) để biết các chức năng cần phát triển.
- **Kiến trúc hệ thống:** Xem [architecture.md](docs/flow/architecture.md) để hiểu cách hệ thống vận hành.
- **Quy chuẩn lập trình:** Xem [conventions.md](docs/technology/conventions.md) để viết code đúng chuẩn của dự án.
- **Tài liệu API:** Xem [api.md](docs/technology/api.md) để tích hợp các cổng kết nối API.
- **Cơ sở dữ liệu:** Xem [database.md](docs/technology/database.md) để nắm thông tin về schema cơ sở dữ liệu.

---

## 🤝 Hướng dẫn đóng góp (Contributing)

1. Tạo một nhánh mới từ nhánh chính: `git checkout -b feature/ten-tinh-nang`.
2. Thực hiện các chỉnh sửa và viết code theo đúng [quy chuẩn code](docs/conventions.md).
3. Đảm bảo tất cả các bài test đều vượt qua.
4. Commit thay đổi của bạn với thông điệp rõ ràng theo định dạng Conventional Commits.
5. Tạo một Pull Request (PR) mới để xem xét trước khi gộp vào nhánh chính.
