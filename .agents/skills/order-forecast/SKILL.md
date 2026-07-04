---
name: order-forecast
description: >-
  Phân tích dữ liệu bán hàng và tồn kho từ file JSON backup của Silence Production
  để tính toán và đề xuất số lượng sản phẩm cần gọi hàng / sản xuất hằng ngày.
  Sử dụng thuật toán Reorder Point dựa trên tốc độ bán trung bình, lead time và
  safety stock. Kích hoạt khi người dùng hỏi về "dự báo gọi hàng", "cần sản xuất
  bao nhiêu", "tồn kho sắp hết", hoặc yêu cầu phân tích hằng ngày từ file backup.
---

# Order Forecast — Dự kiến gọi hàng

## Overview

Skill này tự động tính toán và xuất báo cáo đề xuất số lượng hàng cần gọi thêm hoặc lên lệnh sản xuất dựa trên dữ liệu lịch sử bán hàng và tồn kho từ hệ thống **Silence Production**.

Quy trình hằng ngày:
1. Người dùng xuất file backup JSON từ ứng dụng (trang **Cài đặt → Tải xuống backup**).
2. Agent nhận file và chạy script phân tích.
3. Agent trả về báo cáo dạng bảng Markdown kèm danh sách SKU cần gọi hàng.

## Dependencies

Không có skill bên ngoài nào được yêu cầu. Script sử dụng Python stdlib (`json`, `argparse`, `datetime`, `pathlib`).

## Quick Start

```bash
# Phân tích từ file backup JSON
uv run .agents/skills/order-forecast/order_forecast.py analyze \
  --backup-file "silence-production-backup-2026-07-01.json" \
  --output "forecast_report.json"

# Xem báo cáo dạng markdown trực tiếp
uv run .agents/skills/order-forecast/order_forecast.py analyze \
  --backup-file "silence-production-backup-2026-07-01.json" \
  --format markdown
```

## Utility Scripts

### Subcommand: `analyze`

Phân tích dữ liệu và xuất báo cáo dự kiến gọi hàng.

**Tham số bắt buộc:**
| Tham số | Mô tả |
|---|---|
| `--backup-file` | Đường dẫn tuyệt đối hoặc tương đối đến file backup JSON |
| `--output` | Đường dẫn file kết quả. Bắt buộc khi `--format=json` |

**Tham số tùy chọn:**
| Tham số | Mặc định | Mô tả |
|---|---|---|
| `--lead-time` | `25` | Số ngày từ khi lên đơn đến khi nhận hàng (ngày) |
| `--safety-stock` | `20` | Tồn kho an toàn tối thiểu (cái) |
| `--cover-days` | `30` | Số ngày phủ sóng tồn kho mong muốn sau khi gọi hàng |
| `--velocity-days` | `30` | Số ngày gần nhất dùng để tính tốc độ bán trung bình |
| `--format` | `json` | Định dạng kết quả: `json` hoặc `markdown` |

**Ví dụ:**
```bash
uv run .agents/skills/order-forecast/order_forecast.py analyze \
  --backup-file "backup.json" \
  --lead-time 25 \
  --safety-stock 20 \
  --cover-days 30 \
  --velocity-days 30 \
  --format markdown
```

## Workflow (Hướng dẫn dùng hằng ngày)

### 1. Xuất file backup từ ứng dụng
- Mở ứng dụng Silence Production → vào **Cài đặt**.
- Nhấn nút **"Tải xuống backup (JSON)"**.
- Lưu file vào thư mục làm việc (ví dụ: `backup-YYYY-MM-DD.json`).

### 2. Cung cấp file backup cho Agent
- Hỏi agent: *"Phân tích file backup `backup-2026-07-01.json` và cho tôi biết cần gọi hàng gì hôm nay."*

### 3. Agent chạy script và trả báo cáo
- Agent sẽ gọi lệnh `analyze` trên script Python và trình bày kết quả dưới dạng bảng Markdown.
- Các SKU được phân loại theo 3 mức độ ưu tiên:
  - 🔴 **Khẩn cấp:** Tồn khả dụng < 3 ngày tiêu thụ — cần gọi ngay lập tức.
  - 🟡 **Cần gọi hàng:** Tổng tồn < Điểm đặt hàng — lên kế hoạch sản xuất.
  - 🟢 **Đủ hàng:** Tổng tồn ≥ Điểm đặt hàng — không cần hành động.

## Rate Limiting

Không áp dụng — script chạy hoàn toàn offline từ file JSON cục bộ.

## Common Mistakes

1. **Dùng file backup cũ:** Luôn xuất file backup mới nhất trước khi chạy phân tích để đảm bảo dữ liệu bán hàng và tồn kho chính xác.
2. **Lead time không khớp thực tế:** Thay đổi `--lead-time` cho phù hợp với chu kỳ sản xuất thực tế. Giá trị mặc định là 25 ngày (đã cài đặt cho Silence Production).
3. **Velocity Days quá ngắn:** Nếu `--velocity-days` quá nhỏ (ví dụ: 7 ngày), kết quả có thể bị sai lệch do biến động doanh số ngắn hạn (ví dụ: tuần tết). Khuyến nghị dùng ít nhất 14-30 ngày.
