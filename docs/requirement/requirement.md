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
- **Báo cáo Lãi lỗ tổng hợp (P&L) và Thanh biểu đồ cơ cấu tài chính:**
  - Bảng số liệu kết quả hoạt động kinh doanh (P&L) tổng hợp chi tiết phân rã Doanh thu theo nguồn và Chi phí theo phân loại nhóm vận hành.
  - Thanh biểu đồ phân bổ tỉ trọng cơ cấu Doanh thu và Chi phí trực quan.
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
- **Thao tác & Popup chi tiết:**
  - **Xem chi tiết lệnh:** Click "Chi tiết" trên từng card lô hàng để mở Popup xem chi tiết:
    - Hiển thị summary 5 chỉ số: **Tổng đặt**, **Đã trả từ xưởng**, **Lỗi**, **Hàng tốt (deliveredQty − defectQty)**, **Còn lại chưa trả**.
    - Hiển thị tiến trình 5 bước trực quan kèm badge "HIỆN TẠI".
    - Bảng danh sách SKU trong lô kèm tiến độ hoàn thành (%) và số lần giao hàng.
  - **Chỉnh sửa lệnh sản xuất:** Hỗ trợ cập nhật số lượng đặt, số lượng đã trả (`deliveredQty`), và số lượng hàng lỗi (`defectQty`) cho từng SKU.
    - Cột "Còn lại" và "Hàng tốt" tự động tính toán thời gian thực.
    - Cho phép thay đổi ngày hoàn thành dự kiến.
    - Tự động tăng **Số lần giao hàng (deliveryCount)** mỗi khi số lượng đã trả tăng lên so với giá trị trước đó.
  - Bấm nút để chuyển nhanh lô hàng sang công đoạn tiếp theo. Khi chuyển sang công đoạn kế tiếp, trạng thái mới được ghi nhận.

### 3. Nhập chi phí nhanh & Đồng bộ kênh bán (Quick Cost & Sync)
- **Ghi nhận chi phí vận hành:**
  - Nhập chi phí phát sinh: Loại chi phí (Nhân công, Mặt bằng, Quảng cáo, Vận chuyển, Khác), Số tiền, Ngày phát sinh, Ghi chú.
- **Đồng bộ đơn hàng (Mock Sync):**
  - Giả lập kết nối API với kênh bán hàng (như Nhanh.vn hoặc KiotViet).
  - Nút "Đồng bộ đơn hàng" giả lập việc tải về các đơn hàng mới bán được (số lượng, giá bán, sản phẩm) để cập nhật doanh thu tự động.

### 4. Quản lý tồn kho chuyên sâu (Deep Inventory)
- **Quản lý trạng thái tồn kho:**
  - **Tồn kho khả dụng (Available):** Bằng `Hàng tốt thực nhận từ xưởng − Đã xuất bán`. Hàng tốt thực nhận được tính bằng `deliveredQty − defectQty` cho từng SKU trên mọi lô sản xuất (kể cả đang chạy hoặc đã hoàn thành). Nếu sản phẩm đã được đồng bộ `nhanhStock` từ Nhanh.vn thì ưu tiên hiển thị `nhanhStock`.
  - **Còn lại tại xưởng (In Production):** Số lượng sản phẩm còn lại đang nằm tại xưởng gia công chưa bàn giao (`quantity − deliveredQty` của các lô đang sản xuất).
  - **Đã bán (Sold):** Tổng số lượng đã xuất kho bán lẻ thành công.
- **Bảng chi tiết tồn kho:**
  - Bổ sung cột hiển thị **Đã trả từ xưởng** (tổng số lượng tốt đã nhận) và cột **Tồn nguồn** (để biết số tồn hiển thị được lấy từ Nhanh.vn hay tính toán thực tế từ xưởng).
- **Cảnh báo tồn kho thấp (Low Stock Alert):**
  - Tự động hiển thị nhãn cảnh báo đỏ đối với các sản phẩm có tồn kho khả dụng dưới 20 đơn vị.

### 5. Danh mục sản phẩm (Products)
- **Quản lý danh sách sản phẩm:**
  - Nhập thông tin: Mã SKU (Định dạng viết hoa, không dấu, ví dụ: `TS-SILENCE-01`), Tên sản phẩm, Chi phí sản xuất định mức (Cost per unit - dùng để tính giá vốn hàng bán), Giá bán đề xuất.

### 6. Cài đặt & Quản lý dữ liệu (Settings)

#### 6a. Kết nối Nhanh.vn API
- Cấu hình App ID, Business ID, Access Token, Secret Key.
- Hỗ trợ OAuth flow để lấy Access Token tự động.
- Test kết nối, hiển thị trạng thái (Live / Sandbox / Lỗi).

#### 6b. Cập nhật dữ liệu qua Excel (Chuyên biệt cho từng trang)
- **Tích hợp trực tiếp:** Các tính năng Excel được chuyển trực tiếp vào từng trang tương ứng (Sản phẩm, Sản xuất, Chi phí & Bán hàng, Tồn kho, Dự kiến gọi hàng) thay vì chỉ ở trang Cài đặt.
- **Tải Template Excel:** Mỗi trang cung cấp template Excel mẫu riêng phù hợp với cấu trúc dữ liệu của trang đó.
- **Xuất báo cáo Excel:** Cho phép export dữ liệu hiện tại của từng phân hệ (kể cả báo cáo Tồn kho và Dự phóng gọi hàng).
- **Import cập nhật từ Excel:**
  - Hỗ trợ tải file Excel lên, parse và hiển thị modal preview số lượng dòng đọc được cùng cảnh báo (nếu có).
  - Chọn chế độ import: **Ghi đè** (Overwrite) hoặc **Thêm mới** (Append).
  - **Quy tắc Sandbox:** Trong chế độ Sandbox, khi import danh sách Sản phẩm, hệ thống sẽ tự động cập nhật số lượng tồn kho khả dụng (`nhanhStock`) cho sản phẩm đó từ file Excel. Ở chế độ Live, giá trị này được bỏ qua và quản lý bởi API Nhanh.vn.
- **Backup JSON:** Vẫn giữ nguyên tính năng tải xuống/restore toàn bộ dữ liệu dưới dạng JSON ở mục Cài đặt.



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
