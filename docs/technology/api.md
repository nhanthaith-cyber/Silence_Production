# Hướng dẫn API & Dịch vụ đồng bộ - Silence Production

Ứng dụng chạy hoàn toàn ở Client-side. Do đó, các API được thiết kế dưới dạng các hàm Services (hoặc Hooks) thao tác trực tiếp với Database LocalStorage. Màn hình đồng bộ (`Quick Expense & Sync`) cũng thực hiện mô phỏng lại các API kết nối với các đối tác ngoại vi.

---

## 📡 Dịch vụ giả lập API (Mock API Services)

Tất cả các hành động tương tác dữ liệu được quản lý tập trung trong file `AppContext.tsx` thông qua các hành động sau:

### 1. Quản lý Sản phẩm (Products Service)

#### 🔸 `addProduct(product: Product)`
- **Tham số:** `sku: string, name: string, defaultCost: number, defaultPrice: number`
- **Logic:** Kiểm tra trùng SKU. Nếu chưa tồn tại, đẩy thêm vào mảng `products` và lưu lại vào LocalStorage.

---

### 2. Quản lý Lô sản xuất (Production Service)

#### 🔸 `createProductionBatch(batch: Omit<ProductionBatch, 'id' | 'createdAt' | 'currentStage' | 'status'>)`
- **Logic:** Tạo một mã lô hàng ngẫu nhiên `LOT-YYYYMMDD-XXXX`. Đặt trạng thái ban đầu là `cutting` (Chuẩn bị nguyên liệu), thêm vào danh sách và cập nhật trạng thái kho `In Production` của sản phẩm tương ứng.

#### 🔸 `advanceBatchStage(batchId: string)`
- **Logic:** Chuyển lô hàng qua các trạng thái kế tiếp:
  `cutting` $\rightarrow$ `sewing` $\rightarrow$ `finishing` $\rightarrow$ `qc` $\rightarrow$ `ready`
- **Sự kiện đặc biệt:** Khi chuyển sang công đoạn cuối cùng là `ready` (Đóng gói & Nhập kho):
  - Trạng thái lô hàng đánh dấu là `completed`.
  - Tồn kho khả dụng (Available) của sản phẩm tương ứng được tăng lên một lượng bằng số lượng của lô hàng.
  - Tồn kho đang sản xuất (In Production) của sản phẩm đó giảm đi.

---

### 3. Đồng bộ hóa Kênh bán lẻ (Sales Channel Integration Sync)

#### 🔸 `syncSalesFromChannel(channelName: 'nhanh_vn' | 'kiotviet')`
- **Logic:** Giả lập hành vi fetch đơn hàng của đối tác bán hàng qua HTTP API.
- **Dữ liệu giả lập trả về:** Một danh sách gồm 3 - 5 đơn hàng chứa các SKU thực tế đang có trong danh mục sản phẩm của cửa hàng với số lượng và đơn giá ngẫu nhiên.
- **Ảnh hưởng hệ thống:**
  - Tăng tổng doanh thu hiển thị trên Dashboard.
  - Khấu trừ trực tiếp số lượng bán vào tồn kho khả dụng `Available` của sản phẩm tương ứng.
  - Tăng số lượng `Sold` trong kho hàng.
