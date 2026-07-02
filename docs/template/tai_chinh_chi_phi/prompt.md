# Prompt thiết kế - Chi phí phát sinh & Đồng bộ bán hàng (Expenses & Sales Sync)

Hãy thiết kế giao diện màn hình **Chi phí phát sinh & Đồng bộ bán hàng (Expenses & Sales Sync)** cho hệ thống Silence Production. Màn hình này hỗ trợ quản trị viên nhập các khoản chi phí vận hành xưởng, kích hoạt đồng bộ đơn hàng từ Nhanh.vn để cập nhật doanh thu tự động, đồng thời kiểm tra lịch sử tất cả các giao dịch bán hàng và chi phí chi tiết.

---

## 1. Phong cách thiết kế & Theme chủ đạo
- **Chủ đề màu sắc (Theme):** Nền sáng (`#f7f9fb`), bảng hiển thị và thẻ thông tin dùng màu nền trắng (`#ffffff`), viền mỏng nhẹ (`#eceef0` hoặc `#e0e3e5`).
- **Màu sắc nhãn nguồn đơn hàng (Sales Channels Badges):**
  - **Shopee:** Badge màu cam đỏ đặc trưng (`#ff5722` nền nhạt, chữ đậm hoặc ngược lại).
  - **TikTok:** Badge màu đen tối giản (`#000000` nền xám nhạt, chữ đen).
  - **Offline (Lên ngoài):** Badge màu vàng hổ phách (`#fef3c7` nền nhạt, chữ `#b45309`).
  - **Nhanh.vn / Nhập tay (Manual):** Badge màu xanh dương (`#e8f0fe` nền nhạt, chữ `#1a56db`).
- **Typography & Font:** Font chính là **Inter**. Các mã số đơn hàng, giá tiền, số lượng bán và ngày tháng thực hiện dùng font **Monospace** (ví dụ: JetBrains Mono) để tăng tính minh bạch, thẳng hàng.

---

## 2. Bố cục và cấu trúc giao diện
Màn hình được chia làm 2 phần chính:

### A. Tiêu đề trang (Page Header)
- **Tiêu đề chính:** "Chi phí phát sinh & Đồng bộ bán hàng" (màu Navy đậm, font-weight 700).
- **Mô tả ngắn:** "Nhập chi phí vận hành xưởng và đồng bộ đơn hàng từ Nhanh.vn (Shopee, TikTok, Lên ngoài)" (màu Slate nhạt `#8191a9`).

### B. Bố cục nội dung (Content Layout - 2 Cột)
Chia làm hai cột chính (Cột trái ~40% chiều rộng, Cột phải ~60% chiều rộng):

#### CỘT TRÁI: Nhập chi phí & Cấu hình đồng bộ (2 Card xếp chồng)

1. **Card "Nhập chi phí vận hành" (Expense Logger):**
   - **Form đầu vào gồm:**
     - **Nhóm chi phí:** Dropdown chọn danh mục (Lương / Nhân công, Mặt bằng / Thuê xưởng, Quảng cáo / Marketing, Vận chuyển / Logistics, Nguyên vật liệu, Chi phí khác).
     - **Số tiền chi (VND):** Trường nhập số (Number Input), placeholder "Ví dụ: 500000".
     - **Ghi chú chi tiết:** Khung nhập văn bản nhiều dòng (Textarea), placeholder "Mô tả mục đích chi...".
   - **Thông báo thành công:** Nhãn xanh nhạt "Đã ghi nhận chi phí thành công!" xuất hiện sau khi submit.
   - **Nút bấm:** "Ghi nhận chi phí" (màu Navy đậm, chữ trắng, icon Plus).

2. **Card "Đồng bộ đơn hàng từ Nhanh.vn" (Nhanh.vn Integration):**
   - **Header card:** Gồm tiêu đề và badge trạng thái kết nối hiện tại (Live màu xanh hoặc Sandbox màu vàng).
   - **Mô tả tính năng:** Đoạn giới thiệu ngắn về việc tải đơn hàng từ các kênh tích hợp trên Nhanh.vn.
   - **Nút hành động đồng bộ:** Nút lớn "Đồng bộ đơn hàng từ Nhanh.vn" màu Navy, có biểu tượng RefreshCw.
   - **Khung kết quả đồng bộ:** Xuất hiện sau khi đồng bộ thành công, hiển thị nhãn xanh/vàng thông báo số lượng đơn hàng mới tải về và thông tin cập nhật tồn kho đi kèm.

#### CỘT PHẢI: Lịch sử Đơn hàng & Chi phí (2 Card xếp chồng)

1. **Card "Lịch sử đơn bán hàng" (Sales History):**
   - Tiêu đề card kèm badge tổng số lượng đơn hàng đã ghi nhận.
   - **Bảng danh sách đơn hàng (Table):** Gồm các cột:
     - **Mã Đơn:** Dạng Monospace ngắn, kích thước chữ nhỏ.
     - **Sản phẩm:** Tên sản phẩm và mã SKU (font Monospace xám nhỏ) xếp chồng lên nhau.
     - **SL (Số lượng):** Font Monospace.
     - **Giá Bán:** Giá trị đơn vị (font Monospace).
     - **Doanh thu:** Tổng tiền đơn (in đậm, font Monospace).
     - **Nguồn:** Badge kênh bán tương ứng (Shopee, TikTok, Offline, Manual, Nhanh.vn).
     - *Trạng thái trống:* Hiển thị "Chưa có đơn bán hàng. Nhấn 'Đồng bộ' để tải đơn hàng từ Nhanh.vn." căn giữa.

2. **Card "Lịch sử chi phí vận hành" (Expenses History):**
   - Tiêu đề card kèm tổng số tiền đã chi tiêu (font Monospace, màu đỏ đô, làm nổi bật trong badge).
   - **Bảng danh sách chi phí (Table):** Gồm các cột:
     - **Ngày:** Ngày phát sinh khoản chi (font Monospace).
     - **Mã khoản:** ID giao dịch (font Monospace).
     - **Loại chi phí:** Badge phân loại (Nhân công, Mặt bằng, Quảng cáo, Vận chuyển, Vật liệu, Khác).
     - **Số tiền chi:** Số tiền thực chi (in đậm màu đỏ `#ba1a1a`, font Monospace).
     - **Ghi chú:** Nội dung ghi chú chi tiết.
     - *Trạng thái trống:* Hiển thị "Chưa ghi nhận chi phí. Nhập chi phí ở form bên trái." căn giữa.
