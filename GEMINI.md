# GEMINI.md - Context dành cho AI Assistant

Tệp này cung cấp thông tin ngữ cảnh, quy tắc và chỉ dẫn cốt lõi để các AI Assistant (như Gemini/Antigravity) hiểu rõ kiến trúc, quy ước và mục tiêu của dự án khi làm việc trong workspace này.

---

## 📌 Tổng quan dự án (Project Overview)

- **Tên dự án:** Silence Production
- **Mục tiêu:** [Mô tả ngắn gọn về mục tiêu và sản phẩm của dự án]
- **Stack công nghệ chính:** [Ví dụ: React, Next.js, Node.js, PostgreSQL...]

---

## 📂 Cấu trúc tài liệu (Documentation Structure)

Tài liệu kỹ thuật của dự án nằm trong thư mục `/docs`, được tổ chức thành 4 nhóm:

- **[README.md](README.md):** Hướng dẫn cài đặt và khởi chạy dự án cho lập trình viên.

### 1. Template (`docs/template/`)
- Chứa các mẫu thiết kế UI/UX cho từng module của ứng dụng.

### 2. Requirement (`docs/requirement/`)
- **[docs/requirement/requirement.md](docs/requirement/requirement.md):** Đặc tả yêu cầu chức năng & phi chức năng.

### 3. Flow (`docs/flow/`)
- **[docs/flow/architecture.md](docs/flow/architecture.md):** Thiết kế kiến trúc hệ thống và luồng dữ liệu.

### 4. Technology (`docs/technology/`)
- **[docs/technology/conventions.md](docs/technology/conventions.md):** Quy chuẩn viết code, Git flow, đặt tên biến/hàm.
- **[docs/technology/api.md](docs/technology/api.md):** Tài liệu tích hợp API và đặc tả request/response.
- **[docs/technology/database.md](docs/technology/database.md):** Thiết kế cơ sở dữ liệu, sơ đồ ERD và migrations.

---

## 🎯 Chỉ dẫn cho AI (Instructions for AI)

Khi phát triển hoặc sửa đổi mã nguồn trong dự án này, AI Assistant cần tuân thủ nghiêm ngặt các nguyên tắc sau:

### 1. Đọc và Cập nhật Tài liệu
- Luôn kiểm tra [docs/technology/conventions.md](docs/technology/conventions.md) trước khi đề xuất hoặc viết code mới để đảm bảo tính nhất quán.
- Nếu có sự thay đổi lớn về API, Database hoặc Kiến trúc, hãy chủ động cập nhật các file tài liệu tương ứng trong `/docs`.

### 2. Tiêu chuẩn viết Code
- **Sạch sẽ & Rõ ràng:** Tuân thủ Clean Code. Biến và hàm phải được đặt tên tự giải thích (self-explanatory).
- **Xử lý lỗi:** Luôn bao bọc các tác vụ I/O, API call hoặc xử lý dữ liệu phức tạp trong các khối try-catch và ghi log chi tiết.
- **Testing:** Viết unit test cho các logic xử lý nghiệp vụ quan trọng.

### 3. Quy trình làm việc (Workflow)
- Đề xuất giải pháp (hoặc cập nhật Implementation Plan) trước khi thực hiện các thay đổi lớn về mặt cấu trúc.
- Xác nhận các quyết định thiết kế quan trọng với lập trình viên trước khi triển khai.
