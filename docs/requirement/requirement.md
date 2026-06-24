# Đặc tả yêu cầu phần mềm - Silence Production (Industrial Precision)

Tài liệu này xác định chi tiết các yêu cầu chức năng và phi chức năng cho hệ thống **Silence Production Dashboard**, được thiết kế theo tiêu chuẩn **Industrial Precision** để phục vụ quản lý sản xuất dệt may/gia công và bán hàng.

---

## 👥 Đối tượng sử dụng (Target Personas)
- **Quản lý sản xuất (Production Manager):** Giám sát các lô hàng trong xưởng, cập nhật tiến độ công đoạn từ cắt vải, may, hoàn thiện, kiểm phẩm đến đóng gói.
- **Quản lý tài chính & bán hàng (Financial/Sales Manager):** Theo dõi doanh thu từ các kênh bán hàng (giả lập đồng bộ), nhập chi phí ngoài sản xuất và theo dõi lãi lỗ thực tế.
- **Quản lý kho (Warehouse Keeper):** Theo dõi số lượng tồn kho khả dụng, tồn kho đang sản xuất và các cảnh báo mức tồn kho thấp.

---

## 🎯 Chi tiết phân hệ chức năng (Functional Specifications)

### 1. Bảng điều khiển tổng quan (Dashboard - Màn hình chính)
- **Tổng hợp KPI:**
  - **Doanh thu (Revenue):** Tổng tiền thu về từ các đơn bán hàng đã đồng bộ.
  - **Tổng chi phí (Total Cost):** Bằng `Chi phí sản xuất` (số lượng bán * chi phí định mức SKU) + `Chi phí vận hành` (chi phí nhập ngoài).
  - **Lợi nhuận ròng (Net Profit):** Bằng `Doanh thu` - `Tổng chi phí`.
  - **Tỷ suất lợi nhuận (Profit Margin):** Bằng `(Lợi nhuận ròng / Doanh thu) * 100%`.
- **Biểu đồ trực quan:**
  - Biểu đồ cột chồng hoặc đường xu hướng so sánh Doanh thu, Chi phí và Lợi nhuận ròng qua các ngày/tháng.
- **Tiến độ sản xuất tóm tắt:**
  - Danh sách các lô sản xuất đang chạy và tỷ lệ hoàn thành (%).
- **Lịch sử hoạt động:**
  - Hiển thị danh sách các đơn bán hàng và các lô sản xuất mới cập nhật.

### 2. Quản lý tiến độ sản xuất (Production Tracking)
- **Lập lệnh sản xuất mới:**
  - Nhập thông tin: Chọn Sản phẩm (SKU), Số lượng sản xuất, Ngày dự kiến hoàn thành.
  - Sau khi tạo, hệ thống tự động sinh mã lô hàng dạng `LOT-YYYYMMDD-XXXX` và khởi tạo ở trạng thái **Chuẩn bị nguyên liệu**.
- **Quản lý quy trình qua 5 công đoạn (Production Pipeline):**
  1. **Chuẩn bị nguyên liệu (Cutting/Raw):** Tập hợp nguyên vật liệu, cắt vải.
  2. **Gia công sản xuất (Sewing/Assembly):** Ráp nối thành phẩm tại xưởng.
  3. **Hoàn thiện (Finishing):** Ủi, làm sạch, gắn nhãn mác.
  4. **Kiểm định chất lượng (Quality Control - QC):** Đo đạc thông số, loại bỏ hàng lỗi.
  5. **Đóng gói & Nhập kho (Packaging/Ready):** Đóng gói thành phẩm và nhập kho.
- **Thao tác:**
  - Bấm nút để chuyển lô hàng sang công đoạn tiếp theo.
  - Khi lô hàng đạt trạng thái **Đóng gói & Nhập kho (Ready)**, hệ thống tự động cộng số lượng thành phẩm vào kho lưu trữ (tồn kho khả dụng - Available).

### 3. Nhập chi phí nhanh & Đồng bộ kênh bán (Quick Cost & Sync)
- **Ghi nhận chi phí vận hành:**
  - Nhập chi phí phát sinh: Loại chi phí (Nhân công, Mặt bằng, Quảng cáo, Vận chuyển, Khác), Số tiền, Ngày phát sinh, Ghi chú.
- **Đồng bộ đơn hàng (Mock Sync):**
  - Giả lập kết nối API với kênh bán hàng (như Nhanh.vn hoặc KiotViet).
  - Nút "Đồng bộ đơn hàng" giả lập việc tải về các đơn hàng mới bán được (số lượng, giá bán, sản phẩm) để cập nhật doanh thu tự động.

### 4. Quản lý tồn kho chuyên sâu (Deep Inventory)
- **Quản lý trạng thái tồn kho:**
  - **Tồn kho khả dụng (Available):** Hàng đã hoàn thành sản xuất, sẵn sàng bán.
  - **Đang sản xuất (In Production):** Tổng số lượng sản phẩm nằm trong các lô sản xuất chưa hoàn thành (từ công đoạn 1 đến 4).
  - **Đã bán (Sold):** Tổng số lượng đã xuất kho bán thành công.
- **Cảnh báo tồn kho thấp (Low Stock Alert):**
  - Tự động hiển thị nhãn cảnh báo đỏ đối với các sản phẩm có tồn kho khả dụng dưới 20 đơn vị.

### 5. Danh mục sản phẩm (Products)
- **Quản lý danh sách sản phẩm:**
  - Nhập thông tin: Mã SKU (Định dạng viết hoa, không dấu, ví dụ: `TS-SILENCE-01`), Tên sản phẩm, Chi phí sản xuất định mức (Cost per unit - dùng để tính giá vốn hàng bán), Giá bán đề xuất.

---

## 🎨 Yêu cầu thiết kế (UI/UX - Industrial Precision)
- **Theme:** Thiết kế sáng sủa, độ tương phản cao, hiện đại (`surface`: `#ffffff`, `background`: `#f7f9fb`).
- **Màu sắc chỉ định:**
  - Navy (`#091426` / `#1e293b`) làm màu chủ đạo cho tiêu đề, sidebar và nút hành động chính.
  - Sage Green (`#006c49` / `#10B981`) dành riêng cho thông số tăng trưởng, lợi nhuận và các trạng thái hoàn thành.
  - Amber (`#F59E0B`) cho các trạng thái cảnh báo, tồn kho thấp hoặc lô hàng đang kiểm phẩm.
- **Typography:**
  - Sử dụng phông chữ `Inter` cho toàn bộ văn bản.
  - Sử dụng phông chữ `JetBrains Mono` hoặc các font Monospace cho các con số tài chính, mã SKU, mã lô hàng để thẳng hàng hoàn hảo trong bảng biểu.
