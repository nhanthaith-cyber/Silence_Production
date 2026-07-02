# Prompt thiết kế - Bảng điều khiển tổng quan (Dashboard)

Hãy thiết kế giao diện màn hình **Bảng điều khiển tổng quan (Dashboard)** cho hệ thống Silence Production theo phong cách chuyên nghiệp, hiện đại và tối ưu hóa luồng dữ liệu (Industrial Precision). Màn hình này cần hiển thị toàn bộ chỉ số tài chính (Doanh thu, Chi phí, Lợi nhuận) và tiến độ hoạt động sản xuất dệt may theo thời gian thực.

---

## 1. Phong cách thiết kế & Theme chủ đạo
- **Chủ đề màu sắc (Theme):** Nền sáng (`#f7f9fb`), bảng hiển thị và thẻ thông tin dùng màu nền trắng (`#ffffff`), viền mỏng (`#eceef0` hoặc `#e0e3e5`) để phân chia khu vực rõ ràng mà không gây rối mắt.
- **Màu sắc chức năng:**
  - **Navy đậm (`#091426`):** Sử dụng làm màu chủ đạo cho tiêu đề, điều hướng và văn bản quan trọng.
  - **Xanh xô thơm (Sage Green - `#006c49`):** Sử dụng làm màu biểu thị sự tích cực, tăng trưởng, lợi nhuận hoặc trạng thái hoàn thành.
  - **Đỏ đô (Crimson - `#ba1a1a`):** Sử dụng cho chi phí, lợi nhuận âm hoặc các thông số cảnh báo lỗi.
  - **Màu hổ phách (Amber - `#b45309`):** Sử dụng cho tỷ suất lợi nhuận hoặc trạng thái chờ xử lý.
- **Typography:** Sử dụng font chữ **Inter** cho các nhãn, tiêu đề chung. Sử dụng các font chữ **Monospace** (như JetBrains Mono) cho tất cả các con số tài chính, phần trăm, mã SKU hoặc mã số lô sản xuất để đảm bảo tính căn chỉnh thẳng hàng dọc hoàn hảo.

---

## 2. Bố cục và cấu trúc giao diện
Màn hình được chia làm 3 phần chính từ trên xuống dưới:

### A. Tiêu đề trang (Page Header)
- **Tiêu đề chính:** "Bảng điều khiển tài chính & sản xuất" (màu Navy đậm, font-weight 700).
- **Mô tả ngắn:** "Tổng quan báo cáo lãi lỗ kinh doanh và dòng chảy sản xuất dệt may" (màu Slate nhạt `#8191a9`).

### B. Hàng thẻ chỉ số KPI (KPI Cards Grid - 4 Cột)
Hiển thị 4 thẻ thông tin dạng lưới (Grid 4 cột trên desktop, thu gọn trên mobile):
1. **Doanh thu bán hàng:**
   - Số tiền doanh thu (được định dạng tiền tệ VND, màu Navy đậm, font Monospace).
   - Biểu tượng mũi tên đi lên (TrendingUp, màu Sage Green).
   - Mô tả ngắn: "Từ các đơn bán lẻ & đối tác đồng bộ".
2. **Tổng chi phí phát sinh:**
   - Số tiền chi phí (màu đỏ `#ba1a1a`, font Monospace).
   - Mô tả chi tiết: "Giá vốn SX: [Số tiền COGS] + Chi phí VH: [Số tiền Operating Expenses]" (font Monospace nhạt).
3. **Lợi nhuận ròng:**
   - Thẻ có màu nhấn viền nhạt (Xanh nhạt `#e6f6ef` nếu có lãi).
   - Số tiền lợi nhuận (Dynamic màu: màu Sage Green `#006c49` nếu $\ge 0$, màu đỏ `#ba1a1a` nếu $< 0$, font Monospace lớn).
   - Mô tả ngắn: "Doanh thu trừ tổng chi phí thực tế".
4. **Tỷ suất lợi nhuận:**
   - Thẻ có màu nhấn viền nhạt (Vàng nhạt `#fef3c7`).
   - Tỷ lệ phần trăm biên lợi nhuận ròng (màu Amber `#b45309`, font Monospace lớn, 1 chữ số thập phân).
   - Mô tả ngắn: "Biên lợi nhuận ròng trên doanh thu".

### C. Khu vực nội dung chính (Main Content Grid - 2 Cột)
Chia làm hai cột không đều nhau (Cột trái 60-65% chiều rộng, Cột phải 35-40% chiều rộng):

#### CỘT TRÁI: Báo cáo Lãi lỗ tổng hợp (P&L) & Cơ cấu Tài chính (Card lớn)
- **Tiêu đề thẻ:** "Lãi lỗ hiện tại tổng (P&L)" (kèm nhãn phụ "Đơn vị: VND").
- **Bố cục bên trong:** Chia làm 2 phần song song (hoặc hàng dọc trên màn hình nhỏ):
  1. **Bảng số liệu lãi lỗ (P&L Table):**
     - **I. TỔNG DOANH THU:** Dòng tiêu đề viết hoa. Dòng tổng cộng doanh thu in đậm, các dòng con thụt lề hiển thị doanh thu chi tiết theo từng kênh bán hàng (Shopee, TikTok, Offline, Đồng bộ Nhanh.vn, Nhập thủ công) định dạng font Monospace.
     - **II. TỔNG CHI PHÍ:** Dòng tiêu đề viết hoa. Dòng tổng cộng chi phí in đậm (màu đỏ), các dòng con thụt lề hiển thị chi tiết: Giá vốn sản xuất (COGS), Chi phí nhân công, Chi phí mặt bằng, Chi phí quảng cáo, Chi phí vận chuyển, Chi phí nguyên vật liệu, Chi phí khác.
     - **III. KẾT QUẢ KINH DOANH:** Ngăn cách bằng đường kẻ mỏng phía trên. Dòng "Lợi nhuận ròng" hiển thị chữ in đậm lớn, số tiền in đậm nổi bật (Dynamic màu theo kết quả âm/dương). Dòng "Biên lợi nhuận ròng" hiển thị tỷ lệ phần trăm màu hổ phách.
  2. **Trực quan hóa cấu trúc tài chính (Visual Bars):**
     - **Thanh cơ cấu doanh thu:** Thanh ngang (height 16px, rounded) chia thành các phân đoạn có màu sắc tương ứng với các kênh bán hàng (Shopee: cam đỏ `#ff5722`, TikTok: đen `#000000`, Offline: xanh navy `#091426`, Nhanh.vn: xanh dương `#0084ff`, Nhập tay: xám nhạt `#8191a9`). Đi kèm nhãn chú thích (Legend) hiển thị phần trăm tỷ trọng của mỗi kênh.
     - **Thanh cơ cấu chi phí:** Thanh ngang tương tự hiển thị tỷ trọng các loại chi phí (Giá vốn SX: đỏ `#ba1a1a`, Nhân công: xanh dương `#1976d2`, Mặt bằng: tím `#9c27b0`, Quảng cáo: hồng `#e91e63`, Vận chuyển: vàng `#ffeb3b`, Vật liệu: xanh lá `#4caf50`, Khác: xám `#9e9e9e`) đi kèm chú thích tỷ trọng tương ứng.

#### CỘT PHẢI: Tiến độ sản xuất & Nhật ký hoạt động (2 Card xếp chồng)
1. **Thẻ "Sản xuất đang chạy" (Active Production):**
   - Tiêu đề thẻ kèm số lượng lô hàng đang chạy dạng badge.
   - Nếu không có lô hàng nào: Hiển thị trạng thái trống (Empty state) với biểu tượng hộp hàng nét đứt và thông báo "Không có lô hàng nào đang gia công".
   - Nếu có lô hàng đang chạy: Hiển thị tối đa 3 lô sản xuất mới nhất dưới dạng thẻ nhỏ compact. Mỗi thẻ nhỏ gồm:
     - Dòng trên: Mã lô hàng (font Monospace) và badge trạng thái công đoạn hiện tại (Cắt vải, May ráp, Hoàn thiện, Kiểm phẩm) màu vàng nhạt.
     - Dòng giữa: Tên sản phẩm, số lượng sản xuất (font Monospace).
     - Thanh tiến độ (Progress bar): Hiển thị tiến trình hoàn thành dựa trên công đoạn hiện tại (ví dụ: Cắt vải 20%, May ráp 40%, Hoàn thiện 60%, Kiểm phẩm 80%).
     - Dòng dưới: Hạn hoàn thành dự kiến (font Monospace).
2. **Thẻ "Nhật ký hoạt động" (Recent Operations):**
   - Hiển thị danh sách 5 hoạt động mới nhất kết hợp từ đơn bán hàng và lô sản xuất, sắp xếp theo thời gian giảm dần.
   - Mỗi dòng hoạt động gồm: một chấm tròn nhỏ làm mốc thời gian (timeline dot), tiêu đề hoạt động (ví dụ: "Bán 5 x Áo thun Classic" hoặc "Lô sản xuất LOT-2026..."), giá trị tài chính (`+150.000đ` màu đen/xanh hoặc trạng thái lô hàng như `May ráp (100 SP)` màu xanh/vàng), dòng chân trang hiển thị ngày giờ và nguồn phát sinh.
