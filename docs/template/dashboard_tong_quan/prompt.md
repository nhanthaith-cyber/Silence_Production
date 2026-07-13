# Prompt thiết kế - Bảng điều khiển tổng quan (Dashboard)

Hãy thiết kế giao diện màn hình **Bảng điều khiển tổng quan (Dashboard)** cho hệ thống Silence Production theo phong cách chuyên nghiệp, hiện đại và tối ưu hóa luồng dữ liệu (Industrial Precision). Màn hình này cần hiển thị toàn bộ chỉ số tài chính và tiến độ hoạt động sản xuất dệt may theo thời gian thực, với **2 góc nhìn lãi/lỗ** chuyển đổi qua tab.

---

## 1. Phong cách thiết kế & Theme chủ đạo
- **Chủ đề màu sắc (Theme):** Nền sáng (`#f7f9fb`), bảng hiển thị và thẻ thông tin dùng màu nền trắng (`#ffffff`), viền mỏng (`#eceef0` hoặc `#e0e3e5`) để phân chia khu vực rõ ràng mà không gây rối mắt.
- **Màu sắc chức năng:**
  - **Navy đậm (`#091426`):** Sử dụng làm màu chủ đạo cho tiêu đề, điều hướng và văn bản quan trọng.
  - **Xanh xô thơm (Sage Green - `#006c49`):** Sử dụng làm màu biểu thị sự tích cực, tăng trưởng, lợi nhuận hoặc trạng thái hoàn thành. Cũng là màu chủ đạo cho tab "Theo Tiền thu thực tế".
  - **Đỏ đô (Crimson - `#ba1a1a`):** Sử dụng cho chi phí, lợi nhuận âm hoặc các thông số cảnh báo lỗi.
  - **Màu hổ phách (Amber - `#b45309`):** Sử dụng cho tỷ suất lợi nhuận hoặc trạng thái chờ xử lý.
- **Typography:** Sử dụng font chữ **Inter** cho các nhãn, tiêu đề chung. Sử dụng các font chữ **Monospace** (như JetBrains Mono) cho tất cả các con số tài chính, phần trăm, mã SKU hoặc mã số lô sản xuất để đảm bảo tính căn chỉnh thẳng hàng dọc hoàn hảo.

---

## 2. Bố cục và cấu trúc giao diện
Màn hình được chia làm 4 phần chính từ trên xuống dưới:

### A. Tab chuyển đổi góc nhìn (View Switcher)
- **Vị trí:** Phía trên cùng của nội dung trang, trước thanh bộ lọc ngày.
- **Kiểu dáng:** Thanh tab dạng segmented control, nền xám nhạt (`#f1f3f5`), viền (`#e2e5e9`), bo tròn `10px`, padding `4px`.
- **2 Tab:**
  1. **📊 Theo Doanh thu** (mặc định): Nền trắng khi active, chữ Navy đậm, shadow nhẹ. Icon `BarChart3`.
  2. **💰 Theo Tiền thu thực tế**: Nền xanh `#006c49` khi active, chữ trắng, shadow nhẹ. Icon `Wallet`.
- **Tab không active:** Nền trong suốt, chữ xám `#6b7280`.
- **Mỗi tab chiếm 50% chiều rộng** (flex: 1), căn giữa icon + text.

### B. Thanh bộ lọc ngày (Date Range Filter)
- **Tiêu đề chính:** Không có tiêu đề riêng — chỉ là thanh filter ngang nền xám nhạt (`#f8fafc`).
- **Nút nhanh:** 4 nút: "Hôm nay", "7 ngày", "30 ngày", "Tất cả" (mặc định active). Active state: nền Navy đậm, chữ trắng.
- **Input ngày tùy chỉnh:** 2 ô nhập ngày `date` nối bằng dấu "→".
- **Dòng tóm tắt:** Hiển thị phạm vi ngày đang lọc + số lượng đơn/chi phí (hoặc khoản thu/chi phí tùy tab active).

### C. Nội dung Tab "Theo Doanh thu" (Revenue-based P&L)

#### C1. Hàng thẻ chỉ số KPI (KPI Cards Grid - 4 Cột)
Hiển thị 4 thẻ thông tin dạng lưới (Grid 4 cột trên desktop, thu gọn trên mobile):
1. **Doanh thu bán hàng:**
   - Số tiền doanh thu (được định dạng tiền tệ VND, màu Navy đậm, font Monospace).
   - Biểu tượng mũi tên đi lên (TrendingUp, màu Sage Green).
   - Mô tả ngắn: "Từ các đơn bán lẻ & đối tác đồng bộ".
2. **Tổng chi phí phát sinh:**
   - Số tiền chi phí (màu đỏ `#ba1a1a`, font Monospace).
   - Mô tả chi tiết: "Giá vốn: [COGS] + CP sàn: [Platform Fee] + CP VH: [Operating Expenses]" (font Monospace nhạt).
3. **Lợi nhuận ròng:**
   - Thẻ có màu nhấn viền nhạt (Xanh nhạt `#e6f6ef` nếu có lãi).
   - Số tiền lợi nhuận (Dynamic màu: Sage Green `#006c49` nếu ≥ 0, đỏ `#ba1a1a` nếu < 0, font Monospace lớn).
   - Công thức: **Doanh thu − (COGS + CP sàn + CP vận hành)**.
   - Mô tả ngắn: "Doanh thu trừ tổng chi phí thực tế".
4. **Tỷ suất lợi nhuận:**
   - Thẻ có màu nhấn viền nhạt (Vàng nhạt `#fef3c7`).
   - Tỷ lệ phần trăm biên lợi nhuận ròng (màu Amber `#b45309`, font Monospace lớn, 1 chữ số thập phân).
   - Mô tả ngắn: "Biên lợi nhuận ròng trên doanh thu".

#### C2. Khu vực nội dung chính (Main Content Grid - 2 Cột)
Chia làm hai cột không đều nhau (Cột trái 60-65% chiều rộng, Cột phải 35-40% chiều rộng):

##### CỘT TRÁI: Báo cáo Lãi lỗ tổng hợp (P&L) & Cơ cấu Tài chính (Card lớn)
- **Tiêu đề thẻ:** "Lãi lỗ hiện tại tổng (P&L)" (kèm nhãn phụ "Đơn vị: VND").
- **Bố cục bên trong:** Chia làm 2 phần song song (hoặc hàng dọc trên màn hình nhỏ):
  1. **Bảng số liệu lãi lỗ (P&L Table):**
     - **I. TỔNG DOANH THU:** Dòng tiêu đề viết hoa. Dòng tổng cộng doanh thu in đậm, các dòng con thụt lề hiển thị doanh thu chi tiết theo từng kênh bán hàng (Shopee, TikTok, Offline, Đồng bộ Nhanh.vn, Nhập thủ công) định dạng font Monospace.
     - **II. TỔNG CHI PHÍ:** Dòng tiêu đề viết hoa. Dòng tổng cộng chi phí in đậm (màu đỏ), các dòng con thụt lề hiển thị chi tiết: Giá vốn sản xuất (COGS), Chi phí sàn, Chi phí nhân công, Chi phí mặt bằng, Chi phí quảng cáo, Chi phí vận chuyển, Chi phí gia công (ghi chú Đã gộp trong COGS, giá trị 0đ khi tính tổng), Chi phí nguyên phụ liệu (ghi chú Đã gộp trong COGS, giá trị 0đ khi tính tổng), Chi phí khác.
     - **III. KẾT QUẢ KINH DOANH:** Ngăn cách bằng đường kẻ mỏng phía trên. Dòng "Lợi nhuận ròng" hiển thị chữ in đậm lớn, số tiền in đậm nổi bật (Dynamic màu theo kết quả âm/dương). Dòng "Biên lợi nhuận ròng" hiển thị tỷ lệ phần trăm màu hổ phách.
  2. **Trực quan hóa cấu trúc tài chính (Visual Bars):**
     - **Thanh cơ cấu doanh thu:** Thanh ngang (height 16px, rounded) chia thành các phân đoạn có màu sắc tương ứng với các kênh bán hàng (Shopee: cam đỏ `#ff5722`, TikTok: đen `#000000`, Offline: xanh navy `#091426`, Nhanh.vn: xanh dương `#0084ff`, Nhập tay: xám nhạt `#8191a9`). Đi kèm nhãn chú thích (Legend) hiển thị phần trăm tỷ trọng của mỗi kênh.
     - **Thanh cơ cấu chi phí:** Thanh ngang tương tự hiển thị tỷ trọng các loại chi phí (Giá vốn SX: đỏ `#ba1a1a`, CP sàn: cam `#ff9800`, Nhân công: xanh dương `#1976d2`, Mặt bằng: tím `#9c27b0`, Quảng cáo: hồng `#e91e63`, Vận chuyển: vàng `#ffeb3b`, Vật liệu: xanh lá `#4caf50`, Khác: xám `#9e9e9e`) đi kèm chú thích tỷ trọng tương ứng.

##### CỘT PHẢI: Tiến độ sản xuất & Nhật ký hoạt động (2 Card xếp chồng)
1. **Thẻ "Sản xuất đang chạy" (Active Production):**
   - Tiêu đề thẻ kèm số lượng lô hàng đang chạy dạng badge.
   - Nếu không có lô hàng nào: Hiển thị trạng thái trống (Empty state) với biểu tượng hộp hàng nét đứt và thông báo "Không có lô hàng nào đang gia công".
   - Nếu có lô hàng đang chạy: Hiển thị tối đa 3 lô sản xuất mới nhất dưới dạng thẻ nhỏ compact. Mỗi thẻ nhỏ gồm:
     - Dòng trên: Mã lô hàng (font Monospace) và badge trạng thái công đoạn hiện tại (Đã đặt hàng, Đã thanh toán, Đang vận chuyển, Đang sản xuất) màu vàng nhạt.
     - Dòng giữa: Tên sản phẩm, số lượng sản xuất (font Monospace).
     - Thanh tiến độ (Progress bar): Hiển thị tiến trình hoàn thành dựa trên công đoạn hiện tại (Đã đặt 20%, Đã TT 40%, Vận chuyển 60%, Đang SX 80%, Nhập kho 100%).
     - Dòng dưới: Hạn hoàn thành dự kiến (font Monospace).
2. **Thẻ "Nhật ký hoạt động" (Recent Operations):**
   - Hiển thị danh sách 5 hoạt động mới nhất kết hợp từ đơn bán hàng và lô sản xuất, sắp xếp theo thời gian giảm dần.
   - Mỗi dòng hoạt động gồm: một chấm tròn nhỏ làm mốc thời gian (timeline dot), tiêu đề hoạt động, giá trị tài chính, dòng chân trang hiển thị ngày giờ và nguồn phát sinh.

---

### D. Nội dung Tab "Theo Tiền thu thực tế" (Cashflow-based P&L)

> **Tư duy:** Lãi = Tiền thu về thật − Chi phí tự nhập. Đây là góc nhìn dòng tiền thuần (cashflow), không tính COGS hay phí sàn — vì các chi phí đó đã được ghi nhận trong mục Chi phí vận hành (nguyên vật liệu, nhân công, v.v.).

#### D1. Hàng thẻ chỉ số KPI (KPI Cards Grid - 4 Cột)
Mỗi thẻ có **viền trên 3px** để nhấn mạnh sắc thái:
1. **💰 Tiền thu thực tế:**
   - Viền trên xanh `#006c49`. Icon `Wallet`.
   - Số tiền tổng cộng tiền thu nhập tay (Monospace, màu xanh `#006c49`).
   - Mô tả ngắn: "Tiền thật nhận từ sàn/kênh bán".
2. **Chi phí vận hành:**
   - Viền trên đỏ `#ba1a1a`.
   - Tổng chi phí vận hành tự nhập (Monospace, màu đỏ `#ba1a1a`).
   - Mô tả ngắn: "Tổng chi phí nhập tay ([N] khoản)".
3. **Lãi / Lỗ thực tế:**
   - Viền trên dynamic (xanh nếu lãi, đỏ nếu lỗ).
   - Công thức: **Tiền thu thực tế − Chi phí vận hành**.
   - Mô tả ngắn: "= Tiền thu − Chi phí vận hành".
4. **Tỷ suất lãi thực tế:**
   - Viền trên hổ phách `#b45309`.
   - Tỷ lệ phần trăm (Lãi/Lỗ ÷ Tiền thu × 100%).
   - Mô tả ngắn: "Biên lãi trên tiền thu".

#### D2. Khu vực nội dung chính (Main Content Grid - 2 Cột)
Chia làm hai cột (Cột trái 60-65%, Cột phải 35-40%):

##### CỘT TRÁI: Báo cáo Lãi lỗ theo Tiền thu thực tế (P&L Card)
- **Tiêu đề thẻ:** "💰 Lãi lỗ theo Tiền thu thực tế" (kèm nhãn phụ "Đơn vị: VND").
- **Bảng số liệu P&L:**
  - **I. TIỀN THU THỰC TẾ:** Tổng tiền thu (xanh `#006c49`), các dòng con theo nguồn (Shopee, TikTok, Offline, Chuyển khoản, Tiền mặt, Khác).
  - **II. CHI PHÍ VẬN HÀNH:** Tổng chi phí (đỏ `#ba1a1a`), các dòng con theo category (Nhân công, Mặt bằng, Quảng cáo, Vận chuyển, Nguyên vật liệu, Khác).
  - **III. KẾT QUẢ DÒNG TIỀN:** Lãi/Lỗ thực tế (dynamic màu), Tỷ suất lãi thực tế (hổ phách).
- **Trực quan hóa cấu trúc dòng tiền (Visual Bars):**
  - **Thanh tiền thu theo nguồn:** Phân đoạn màu: Shopee `#ff5722`, TikTok `#000000`, Offline `#091426`, Chuyển khoản `#1976d2`, Tiền mặt `#006c49`, Khác `#9e9e9e`.
  - **Thanh chi phí vận hành:** Phân đoạn màu theo category chi phí.

##### CỘT PHẢI: Form nhập & Lịch sử tiền thu (2 Card xếp chồng)

1. **Card "Nhập tiền thu thực tế" (Actual Revenue Logger):**
   - **Icon header:** Icon `Plus` xanh `#006c49`.
   - **Form đầu vào gồm:**
     - **Ngày nhận tiền:** Input `date` (mặc định ngày hôm nay).
     - **Nguồn thu:** Dropdown chọn (Shopee, TikTok, Offline, Chuyển khoản ngân hàng, Tiền mặt, Khác).
     - **Số tiền (VND):** Input số, placeholder "0", font Monospace.
     - **Ghi chú:** Input text, placeholder "VD: Shopee thanh toán đợt 1 tháng 7".
   - **Nút hành động:** "Ghi nhận tiền thu" nền xanh `#006c49`, chữ trắng, icon `Plus`. Disable khi chưa nhập đủ.
   - **Thông báo thành công:** Nhãn xanh nhạt "Đã ghi nhận thành công!" với icon `CheckCircle2`, nền `#ecfdf5`, viền `#a7f3d0`.

2. **Card "Lịch sử tiền thu" (Actual Revenue History):**
   - Tiêu đề card kèm badge tổng số bản ghi.
   - **Danh sách bản ghi** (scroll tối đa 400px, hiển thị tối đa 20 bản ghi):
     - Mỗi dòng gồm: chấm tròn màu nguồn, tên nguồn (in đậm 12px), số tiền (Monospace xanh `#006c49` in đậm), ngày nhận (Monospace 11px xám), ghi chú (11px xám).
     - **Nút xóa:** Icon `Trash2` đỏ `#ba1a1a`, nền transparent, hover highlight.
   - **Trạng thái trống:** "Chưa có bản ghi tiền thu thực tế nào." căn giữa.
