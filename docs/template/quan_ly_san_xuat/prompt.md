# Prompt thiết kế - Quản lý tiến độ sản xuất (Production Tracking)

Hãy thiết kế giao diện màn hình **Quản lý tiến độ sản xuất** cho hệ thống Silence Production theo phong cách công nghiệp chính xác (Industrial Precision). Màn hình này cho phép người quản lý sản xuất lên các lệnh sản xuất mới, theo dõi trạng thái gia công qua 5 công đoạn và kiểm tra lịch sử các lô hàng đã hoàn thành.

---

## 1. Phong cách thiết kế & Theme chủ đạo
- **Chủ đề màu sắc (Theme):** Nền sáng (`#f7f9fb`), bảng hiển thị và thẻ thông tin dùng màu nền trắng (`#ffffff`), viền mỏng (`#c5c6cd` hoặc `#eceef0`) để giữ nét khỏe khoắn, chính xác.
- **Màu sắc tiến độ công đoạn:**
  - **Trạng thái hoàn thành (Completed):** Xanh xô thơm nhạt (`#e6f6ef`) làm nền và chữ màu xanh lá đậm (`#006c49`), kèm biểu tượng CheckCircle.
  - **Trạng thái đang thực hiện (Active):** Màu hổ phách nhạt (`#fef3c7`) làm nền và chữ màu hổ phách đậm (`#b45309`).
  - **Trạng thái chờ (Pending):** Xám nhạt (`#e6e8ea` / `#f2f4f6`) và chữ xám (`#75777d`).
- **Typography & Font:** Font chữ chính là **Inter**. Mã lô sản xuất, số lượng sản phẩm và ngày tháng phải dùng font **Monospace** (ví dụ: JetBrains Mono) để thẳng hàng và dễ đọc trong quá trình rà soát tại xưởng.

---

## 2. Bố cục và cấu trúc giao diện
Màn hình được chia làm 2 phần chính:

### A. Tiêu đề trang (Page Header)
- **Tiêu đề chính:** "Quản lý tiến độ sản xuất" (màu Navy đậm, font-weight 700).
- **Mô tả ngắn:** "Tạo lệnh sản xuất mới và theo dõi chi tiết tiến độ xưởng gia công qua 5 bước" (màu Slate nhạt `#8191a9`).

### B. Bố cục nội dung (Content Layout - 2 Cột)
Chia làm hai cột chính (Cột trái ~30-35% chiều rộng, Cột phải ~65-70% chiều rộng):

#### CỘT TRÁI: Lệnh sản xuất mới (Card tạo lô hàng)
- **Tiêu đề card:** "Lệnh sản xuất mới".
- **Form đầu vào gồm:**
  1. **Sản phẩm gia công:** Dropdown (Select) chọn sản phẩm từ danh mục hiện tại (Hiển thị dạng: `Tên sản phẩm (Mã SKU)`).
  2. **Số lượng sản xuất (Cái):** Trường nhập số (Number Input), placeholder "Ví dụ: 100".
  3. **Ngày hoàn thành dự kiến:** Trường chọn ngày (Date Input).
- **Nút hành động:** Nút bấm "Tạo lệnh sản xuất" (màu Navy đậm, chữ trắng, có biểu tượng Plus).

#### CỘT PHẢI: Các lô hàng đang chạy & Lịch sử hoàn thành (2 Card xếp chồng)

1. **Card "Các lô hàng đang gia công" (Active Pipelines):**
   - Tiêu đề card kèm badge số lượng lô hàng đang chạy (màu vàng nhạt).
   - **Trạng thái trống (Empty State):** Nếu không có lô hàng nào đang sản xuất, hiển thị một khung viền đứt nét màu xám chứa icon nhà máy (Factory), tiêu đề "Không có lệnh sản xuất nào đang chạy" và mô tả "Nhập thông tin bên trái để tạo lệnh sản xuất đầu tiên".
   - **Danh sách lô sản xuất (Batch Cards List):** Mỗi lô hàng đang chạy hiển thị dưới dạng một card độc lập hình chữ nhật bo góc nhẹ. Bên trong card gồm:
     - **Header lô hàng:** Mã lô hàng dạng `LOT-YYYYMMDD-XXXX` (in đậm, font Monospace), tên sản phẩm ở giữa và nút biểu tượng thùng rác màu xám để hủy lệnh ở góc phải.
     - **Thông tin metadata:** Dòng hiển thị số lượng sản xuất (in đậm số lượng) và ngày hạn hoàn thành (in đậm ngày, font Monospace).
     - **Luồng tiến độ trực quan (Visual Flow Steps):** Một thanh ngang gồm 5 vòng tròn tiến độ được kết nối với nhau bằng các đường kẻ (connector):
       - Bước 1: **đã đặt hàng**
       - Bước 2: **đã thanh toán**
       - Bước 3: **đang vận chuyển**
       - Bước 4: **đang sản xuất**
       - Bước 5: **Đã nhập kho**
       - Các bước đã hoàn thành hiển thị màu xanh lá kèm biểu tượng CheckCircle. Bước hiện tại hiển thị màu vàng hổ phách có số thứ tự. Các bước chưa tới hiển thị màu xám.
     - **Các nút hành động:**
       - Nút **Chi tiết** (màu xanh dương nhạt hoặc xám, chữ đen/xám): Mở hộp thoại (Modal) chi tiết lô hàng.
       - Nút **Chuyển công đoạn:** Nút bấm lớn màu xanh lá (chữ trắng) ghi rõ hành động tiếp theo: "Chuyển sang: [CÔNG ĐOẠN TIẾP THEO]" kèm biểu tượng mũi tên chỉ sang phải.

#### C. Popup Chi tiết lệnh sản xuất (BatchDetailModal)
Khi bấm nút "Chi tiết", hiển thị một Modal đè lên màn hình chính với cấu trúc:
1. **Header:** Hiển thị Mã lô hàng dạng `LOT-YYYYMMDD-XXXX`, ngày tạo, ngày hoàn thành dự kiến và một badge màu xanh dương hiển thị **Số lần giao hàng** (`deliveryCount`).
2. **Thẻ tóm tắt chỉ số (Summary Grid - 5 cột):**
   - **Tổng đặt:** Số lượng đặt sản xuất.
   - **Đã trả:** Tổng số lượng xưởng đã trả về.
   - **Lỗi:** Tổng số lượng hàng lỗi được loại bỏ (màu đỏ).
   - **Hàng tốt:** Số lượng thực nhập kho (`Đã trả - Lỗi`).
   - **Còn lại:** Số lượng còn ở xưởng (`Tổng đặt - Đã trả`).
3. **Bảng sản phẩm chi tiết (Items Table):**
   - Các cột: Sản phẩm (Tên & SKU), SL đặt, Đã trả, Lỗi, Hàng tốt, Còn lại, Lần giao, Tiến độ (thanh progress bar % trực quan).
4. **Tiến độ công đoạn (Visual Steps):** Hiển thị trực quan vị trí hiện tại trong quy trình 5 bước.
5. **Nút điều hướng:** Nút "Chỉnh sửa" mở Popup chỉnh sửa, nút "Chuyển sang công đoạn tiếp theo", và nút "Đóng".

#### D. Popup Chỉnh sửa lệnh sản xuất (BatchEditModal)
Khi bấm "Chỉnh sửa" từ Popup Chi tiết, hiển thị Modal chỉnh sửa:
1. **Ngày hoàn thành dự kiến:** Ô chọn Date picker.
2. **Form danh sách sản phẩm (Grid Form):**
   - Hỗ trợ sửa trực tiếp: **SL đặt** (Input số), **Đã trả** (Input số, nền xanh lục nhạt), và **Lỗi** (Input số, nền đỏ nhạt).
   - Cột **Hàng tốt** tự động hiển thị kết quả tính toán (`Đã trả - Lỗi`).
   - Có cơ chế validate nghiêm ngặt (không cho phép nhập số âm, không cho phép số lỗi vượt quá số đã trả, không cho phép đã trả vượt quá số đặt).
3. **Nút bấm:** "Lưu thay đổi" và "Hủy".

2. **Card "Lịch sử lô hàng đã hoàn thành" (Completed History):**
   - Tiêu đề card kèm số lượng lô hàng đã xong trong một badge màu xanh lá.
   - **Bảng lịch sử (Table):** Gồm các cột:
     - **Mã Lô:** Dưới dạng font Monospace in đậm.
     - **Sản phẩm:** Tên sản phẩm hoàn thành.
     - **Số lượng:** Số lượng nhập kho (font Monospace).
     - **Ngày khởi tạo:** Ngày tạo lệnh (font Monospace).
     - **Hạn hoàn thành:** Hạn dự kiến (font Monospace).
     - **Trạng thái:** Badge màu xanh lá cây "Đã nhập kho".
     - *Nút hành động:* Nút "Chi tiết" để xem lại cấu trúc phân phối, số lần giao, lỗi của lô hàng lịch sử.
     - *Trạng thái trống:* Nếu chưa có lô hàng nào hoàn thành, dòng bảng hiển thị "Chưa có lô hàng nào hoàn thành sản xuất." căn giữa.
