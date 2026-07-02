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

### 3. Đồng bộ hóa Kênh bán lẻ (Nhanh.vn API Integration v3.0)

Ứng dụng hỗ trợ kết nối trực tiếp với cổng API Nhanh.vn (v3.0) để đồng bộ sản phẩm, tồn kho và đơn hàng thực tế từ các kênh Shopee, TikTok, Website, Lazada và Offline.

#### Quy cách gọi API v3.0

Mọi API endpoint đều tuân theo format:
- **URL**: `https://pos.open.nhanh.vn/v3.0/{resource}/{action}?appId={appId}&businessId={businessId}`
- **Method**: `POST`
- **Headers**:
  - `Authorization`: `{accessToken}`
  - `Content-Type`: `application/json`
- **Body**: JSON với cấu trúc `{ filters: {...}, paginator: { size: N, next: {...} } }`

#### 🔸 `syncSalesFromNhanh()`
- **Endpoint:** `POST /v3.0/order/list?appId=...&businessId=...`
- **Body:** `{ filters: { createdAtFrom: timestamp, createdAtTo: timestamp }, paginator: { size: 100 } }`
- **Phân loại nguồn:** Đơn hàng được tự động phân loại theo kênh bán hàng (`shopee`, `tiktok`, `offline`, `nhanh_vn`) dựa trên trường `fromChannel`.
- **Phân trang:** Sử dụng cursor-based pagination qua `paginator.next`, tối đa 100 đơn/trang.
- **Giới hạn:** Chỉ hỗ trợ lọc trong khoảng 31 ngày.

#### 🔸 `syncStockFromNhanh()`
- **Endpoint:** `POST /v3.0/product/list?appId=...&businessId=...`
- **Body:** `{ filters: { status: [1] }, paginator: { size: 100 } }`
- **Tác động:** Đồng bộ tên sản phẩm, mã SKU, giá bán và tồn kho về cơ sở dữ liệu local.
- **Phân trang:** Cursor-based, tối đa 10 trang (1000 sản phẩm).

#### 🔸 `fetchNhanhInventory()`
- **Endpoint:** `POST /v3.0/product/inventory?appId=...&businessId=...`
- **Mục đích:** Lấy tồn kho chuyên dụng (nhẹ hơn product/list).

#### 🔸 `syncStockToNhanh(sku: string)`
- **Lưu ý:** API v3.0 không hỗ trợ trực tiếp push tồn kho từ bên ngoài. Nhanh.vn khuyến nghị dùng Webhooks. Hàm này giữ lại để tương thích giao diện.

---

### 4. Quy trình xác thực OAuth Nhanh.vn v3.0

#### Bước 1: Khởi tạo đăng nhập cấp quyền
Ứng dụng chuyển hướng người dùng tới Nhanh.vn để chọn doanh nghiệp và cấp quyền:
```
https://nhanh.vn/oauth?version=v3.0&appId={appId}&redirectUri={redirectUri}&returnLink={redirectUri}&responseType=code&scopes=viewOrder,updateInventory,updateProduct,viewProduct
```

#### Bước 2: Nhận Access Code và đổi Access Token
Sau khi đồng ý, Nhanh.vn chuyển hướng trình duyệt về Silence Production kèm theo mã `accessCode` trong URL query string.
Ứng dụng gửi yêu cầu POST dạng raw JSON tới endpoint:
```
https://pos.open.nhanh.vn/v3.0/app/getaccesstoken?appId={appId}
```
**JSON Body:**
```json
{
  "appId": "YOUR_APP_ID",
  "secretKey": "YOUR_SECRET_KEY",
  "accessCode": "YOUR_ACCESS_CODE"
}
```

#### Giải quyết giới hạn CORS trong trình duyệt:
- **Môi trường Development:** Sử dụng Vite proxy `/nhanh-v3` trỏ tới `https://pos.open.nhanh.vn`.
- **Môi trường Production (GitHub Pages):** Định tuyến yêu cầu qua cổng CORS Proxy của `corsproxy.io`:
  `https://corsproxy.io/?url=https://pos.open.nhanh.vn/v3.0/...`
  để vượt qua chính sách CORS của trình duyệt mà không cần sử dụng máy chủ backend riêng biệt.
