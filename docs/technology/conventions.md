# Quy ước viết code (Coding Conventions)

Tài liệu này định nghĩa các chuẩn mực lập trình, quy trình Git và cấu trúc thư mục mà mọi thành viên (và AI Assistant) tham gia dự án **Silence Production** phải tuân thủ.

---

## 🏷️ Quy tắc đặt tên (Naming Conventions)

### 1. File và Thư mục
- **Thư mục:** Sử dụng `kebab-case` (ví dụ: `user-profile`, `auth-services`).
- **File mã nguồn (JS/TS/Python):** Sử dụng `camelCase` hoặc `kebab-case`. Đối với Component React/Vue, sử dụng `PascalCase` (ví dụ: `UserProfile.tsx`).

### 2. Biến, Hàm và Lớp
- **Biến và Hàm:** Sử dụng `camelCase` (ví dụ: `const userId = 1;`, `function getUserData() {}`).
- **Lớp (Classes):** Sử dụng `PascalCase` (ví dụ: `class UserService {}`).
- **Hằng số (Constants):** Sử dụng `UPPER_SNAKE_CASE` (ví dụ: `const MAX_RETRY_ATTEMPTS = 3;`).
- **Cơ sở dữ liệu (Tables & Columns):** Sử dụng `snake_case` (ví dụ: `user_accounts`, `created_at`).

---

## 🛠️ Quy chuẩn code (Coding Standard)

- **Linter & Formatter:** Sử dụng `ESLint` và `Prettier` (hoặc các công cụ tương đương cho ngôn ngữ khác) để tự động định dạng mã nguồn.
- **Strict Typing:** Nếu sử dụng TypeScript, hạn chế tối đa việc sử dụng kiểu `any`. Luôn định nghĩa Interface/Type rõ ràng cho dữ liệu đầu vào và đầu ra.
- **Xử lý bất đồng bộ:** Ưu tiên sử dụng `async/await` thay vì Promise chaining (`.then().catch()`) để mã nguồn dễ đọc hơn.
- **Comment:** Viết comment ngắn gọn, giải thích lý do tại sao đoạn code đó phức tạp, tránh giải thích những thứ đã quá rõ ràng qua tên hàm/biến.

---

## 🌿 Quy trình Git & Commit (Git Flow)

### 1. Quy tắc đặt tên nhánh (Branch Naming)
Mọi nhánh phát triển phải được tạo từ nhánh `main` (hoặc `develop`) và tuân theo định dạng: `<loại-nhánh>/<mô-tả-ngắn>`
- **Tính năng mới:** `feature/add-login-google`
- **Sửa lỗi:** `bugfix/fix-expired-token`
- **Cải tiến/Tối ưu:** `refactor/optimize-database-query`
- **Tài liệu:** `docs/update-api-guide`

### 2. Quy chuẩn thông điệp Commit (Conventional Commits)
Thông điệp commit cần ngắn gọn và bắt đầu bằng một tiền tố xác định mục đích:
- `feat`: Tính năng mới (ví dụ: `feat: tích hợp đăng nhập bằng Google`)
- `fix`: Sửa lỗi (ví dụ: `fix: sửa lỗi crash khi token hết hạn`)
- `docs`: Chỉnh sửa tài liệu (ví dụ: `docs: cập nhật tài liệu API thanh toán`)
- `style`: Định dạng code, dấu phẩy, khoảng trắng (không ảnh hưởng logic)
- `refactor`: Tái cấu trúc code nhưng không thay đổi tính năng
- `test`: Thêm hoặc sửa các bài test
