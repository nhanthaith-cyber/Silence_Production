# Prompt thiết kế - Quản lý tồn kho chuyên sâu (Deep Inventory)

Hãy thiết kế giao diện màn hình **Quản lý tồn kho chuyên sâu (Deep Inventory)** cho hệ thống Silence Production. Màn hình này hỗ trợ thủ kho và ban quản lý giám sát lượng tồn kho khả dụng để bán, lượng bán thành phẩm đang gia công tại xưởng, số lượng sản phẩm đã xuất bán và đưa ra các cảnh báo tồn kho thấp dưới định mức an toàn.

---

## 1. Phong cách thiết kế & Theme chủ đạo
- **Chủ đề màu sắc (Theme):** Nền sáng (`#f7f9fb`), bảng hiển thị và thẻ thông tin dùng màu nền trắng (`#ffffff`), viền mỏng nhẹ (`#eceef0` hoặc `#e0e3e5`).
- **Màu sắc trạng thái tồn kho:**
  - **Đủ hàng (In Stock):** Badge màu xanh xô thơm (`#e6f6ef` nền, chữ `#006c49`) kèm icon CheckCircle2.
  - **Tồn kho thấp (Low Stock):** Badge màu đỏ nhạt (`#ffdad6` nền, chữ `#ba1a1a`) kèm icon AlertTriangle.
- **Typography & Font:** Font chữ chính là **Inter**. Mã SKU, các con số tồn kho (Khả dụng, Đang sản xuất, Đã bán) sử dụng font **Monospace** (ví dụ: JetBrains Mono) để thẳng hàng cột dọc khi hiển thị trong bảng dữ liệu lớn.

---

## 2. Bố cục và cấu trúc giao diện
Màn hình được thiết kế theo cấu trúc dọc gồm các phân khu sau:

### A. Tiêu đề trang & Nút hành động đồng bộ (Page Header)
- **Cột trái (Thông tin):**
  - Tiêu đề chính: "Quản lý tồn kho chuyên sâu" (màu Navy đậm, font-weight 700).
  - Mô tả ngắn: "Giám sát trạng thái tồn kho thực tế, số lượng đang sản xuất tại xưởng và cảnh báo nhập hàng".
- **Cột phải (Nút đồng bộ hệ thống Nhanh.vn):** 2 nút bấm đặt ngang:
  1. **Nút "Nhận tồn từ Nhanh.vn":** Nút phụ viền xám, nền trắng, chữ đen, icon RefreshCw xoay nhẹ. Hành động giả lập đồng bộ kéo số liệu tồn kho từ API Nhanh.vn về máy.
  2. **Nút "Đẩy tất cả tồn lên Nhanh":** Nút chính Navy đậm, chữ trắng, icon RefreshCw. Hành động giả lập đẩy toàn bộ số lượng khả dụng tại xưởng lên kênh bán lẻ Nhanh.vn.

### B. Hàng thẻ KPI tồn kho (KPI Cards Grid - 3 Cột)
Hiển thị 3 chỉ số tổng hợp toàn hệ thống:
1. **Tồn kho khả dụng (Available):**
   - Tổng số lượng thành phẩm đã hoàn thành sản xuất tại xưởng và chưa bán (màu Navy đậm, font Monospace lớn).
   - Biểu tượng hộp hàng (Boxes) đi kèm mô tả ngắn: "Thành phẩm đã hoàn thành, sẵn sàng bán".
2. **Số lượng đang sản xuất (In Production):**
   - Tổng số sản phẩm đang nằm trong các lô hàng chưa hoàn thành ở xưởng (màu Amber `#b45309`, font Monospace lớn).
   - Biểu tượng thêm sản phẩm (PackagePlus) đi kèm mô tả ngắn: "Nằm trong các công đoạn xưởng gia công".
3. **Tổng sản phẩm đã bán (Sold):**
   - Tổng số lượng sản phẩm đã được bán ra thành công (màu Sage Green `#006c49`, font Monospace lớn).
   - Biểu tượng túi mua sắm (ShoppingBag) đi kèm mô tả ngắn: "Đã xuất kho qua các kênh bán hàng".

### C. Thẻ bảng chi tiết tồn kho theo SKU (Inventory Details Card)
- **Tiêu đề bảng:** "Chi tiết số lượng tồn kho theo SKU" (kèm nhãn cảnh báo phụ "Cảnh báo mức tồn thấp: < 20 SP").
- **Bảng dữ liệu chi tiết (Data Table):** Cấu trúc bảng gồm 7 cột:
  1. **Mã SKU:** Định dạng in đậm, viết hoa toàn bộ, font Monospace (ví dụ: `TS-SILENCE-01`).
  2. **Tên Sản Phẩm:** Tên hiển thị đầy đủ của sản phẩm, in đậm nhẹ.
  3. **Đang sản xuất:** Số lượng sản phẩm đang gia công (font Monospace, căn phải. Nếu $> 0$, hiển thị màu hổ phách và in đậm nhẹ; nếu $= 0$, hiển thị màu xám mờ).
  4. **Khả dụng (Available):** Số lượng thành phẩm hiện tại trong kho (font Monospace in đậm, căn phải. Nếu số lượng $< 20$, hiển thị màu đỏ đô `#ba1a1a` nổi bật để báo động).
  5. **Đã xuất bán:** Tổng số sản phẩm đã bán thành công (font Monospace, căn phải, màu xám nhạt).
  6. **Trạng thái tồn:** Hiển thị Badge trạng thái:
     - Nhãn đỏ "Tồn kho thấp" kèm icon cảnh báo nếu Khả dụng $< 20$.
     - Nhãn xanh "Đủ hàng" kèm icon tích xanh nếu Khả dụng $\ge 20$.
  7. **Đồng bộ Nhanh:** Nút bấm phụ "Đẩy tồn" (nút nhỏ compact, font chữ bé, viền xám). Khi click, đẩy riêng số tồn khả dụng của SKU này lên Nhanh.vn.
- *Trạng thái trống:* Nếu hệ thống chưa có SKU nào, hiển thị dòng thông báo "Chưa có sản phẩm nào trong hệ thống." ở giữa bảng.
Phần sản phẩm có nhiều SKU thì dùng chế độ mở nhiều trang để xem, mỗi trang 30 SKU
Phần sản phẩm thêm vùng để tìm kiếm SKU
