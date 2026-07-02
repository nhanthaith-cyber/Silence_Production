#!/usr/bin/env python3
"""
order_forecast.py — Công cụ dự kiến gọi hàng cho Silence Production
Đọc file JSON backup của ứng dụng và tính toán đề xuất số lượng
cần sản xuất / đặt hàng dựa trên thuật toán Reorder Point.

Cách dùng:
    uv run order_forecast.py analyze --backup-file backup.json --format markdown
"""

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path


# ─── Algorithm ────────────────────────────────────────────────────────────────

def load_backup(path: str) -> dict:
    """Load and validate a Silence Production JSON backup file."""
    p = Path(path)
    if not p.exists():
        print(f"ERROR: File không tồn tại: {path}", file=sys.stderr)
        sys.exit(1)
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"ERROR: File JSON không hợp lệ: {e}", file=sys.stderr)
        sys.exit(1)

    required = {"products", "sales", "productionBatches"}
    missing = required - set(data.keys())
    if missing:
        print(f"ERROR: File backup thiếu các trường: {missing}", file=sys.stderr)
        sys.exit(1)

    return data


def compute_forecast(
    data: dict,
    lead_time: int,
    safety_stock: int,
    cover_days: int,
    velocity_days: int,
) -> list[dict]:
    """
    Compute order-forecast rows for each product SKU.

    Returns a list of dicts sorted by alert level (critical → reorder → safe).
    """
    products: list[dict] = data.get("products", [])
    sales: list[dict] = data.get("sales", [])
    batches: list[dict] = data.get("productionBatches", [])

    # Cutoff date for velocity window
    today = date.today()
    cutoff_iso = (today - timedelta(days=velocity_days)).isoformat()

    rows = []
    for prod in products:
        sku = prod.get("sku", "")
        name = prod.get("name", "")

        # 1. Daily sales velocity (within velocity window)
        recent_qty = sum(
            s.get("quantity", 0)
            for s in sales
            if s.get("productSku") == sku and s.get("saleDate", "") >= cutoff_iso
        )
        daily_velocity = recent_qty / velocity_days

        # 2. Available stock = completed batches - total sold
        total_produced = sum(
            item.get("quantity", 0)
            for b in batches
            if b.get("status") == "completed"
            for item in b.get("items", [])
            if item.get("productSku") == sku
        )
        total_sold = sum(
            s.get("quantity", 0) for s in sales if s.get("productSku") == sku
        )
        available = max(0, total_produced - total_sold)

        # 3. In-production stock = running batches
        in_production = sum(
            item.get("quantity", 0)
            for b in batches
            if b.get("status") == "running"
            for item in b.get("items", [])
            if item.get("productSku") == sku
        )

        total_stock = available + in_production

        # 4. Days of cover
        days_of_cover: float = total_stock / daily_velocity if daily_velocity > 0 else float("inf")

        # 5. Reorder point
        reorder_point = daily_velocity * lead_time + safety_stock

        # 6. Alert level
        if daily_velocity == 0:
            alert_level = "safe"          # No sales history → skip
        elif available <= daily_velocity * 3:
            alert_level = "critical"
        elif total_stock < reorder_point:
            alert_level = "reorder"
        else:
            alert_level = "safe"

        # 7. Proposed order quantity
        proposed_qty = 0
        if daily_velocity > 0 and total_stock < reorder_point:
            proposed_qty = max(
                0,
                round(daily_velocity * cover_days + safety_stock - total_stock),
            )

        rows.append(
            {
                "sku": sku,
                "name": name,
                "daily_velocity": round(daily_velocity, 4),
                "available": available,
                "in_production": in_production,
                "total_stock": total_stock,
                "days_of_cover": round(days_of_cover, 1) if days_of_cover != float("inf") else None,
                "reorder_point": round(reorder_point, 1),
                "proposed_qty": proposed_qty,
                "alert_level": alert_level,
            }
        )

    # Sort: critical → reorder → safe, then by proposed qty desc
    priority = {"critical": 0, "reorder": 1, "safe": 2}
    rows.sort(key=lambda r: (priority[r["alert_level"]], -r["proposed_qty"]))
    return rows


# ─── Formatters ───────────────────────────────────────────────────────────────

ALERT_LABELS = {
    "critical": "🔴 Khẩn cấp",
    "reorder":  "🟡 Cần gọi hàng",
    "safe":     "🟢 Đủ hàng",
}


def format_markdown(rows: list[dict], params: dict) -> str:
    today = date.today().strftime("%d/%m/%Y")
    lead_time = params["lead_time"]
    safety_stock = params["safety_stock"]
    cover_days = params["cover_days"]
    velocity_days = params["velocity_days"]

    critical = [r for r in rows if r["alert_level"] == "critical"]
    reorder  = [r for r in rows if r["alert_level"] == "reorder"]
    total_proposed = sum(r["proposed_qty"] for r in rows)

    lines = [
        f"# 📦 Báo cáo Dự kiến Gọi hàng — {today}",
        "",
        f"> **Tham số:** Lead Time = {lead_time} ngày · Safety Stock = {safety_stock} cái · "
        f"Cover Days = {cover_days} ngày · Velocity Window = {velocity_days} ngày",
        "",
    ]

    # Summary
    lines += [
        "## Tóm tắt",
        f"| Chỉ số | Giá trị |",
        f"|---|---|",
        f"| Tổng SKU theo dõi | {len(rows)} |",
        f"| 🔴 SKU khẩn cấp (hết hàng < 3 ngày) | {len(critical)} |",
        f"| 🟡 SKU cần gọi hàng | {len(reorder)} |",
        f"| Tổng số lượng đề xuất gọi | **{total_proposed:,} cái** |",
        "",
    ]

    # Detail table
    if rows:
        lines += [
            "## Chi tiết từng SKU",
            "",
            "| SKU | Tên sản phẩm | Tốc độ bán | Khả dụng | Đang SX | Tổng tồn | Còn ~ngày | Trạng thái | Đề xuất gọi |",
            "|---|---|---:|---:|---:|---:|---:|---|---:|",
        ]
        for r in rows:
            doc = f"{r['days_of_cover']}" if r["days_of_cover"] is not None else "∞"
            proposed = f"**+{r['proposed_qty']:,}**" if r["proposed_qty"] > 0 else "—"
            label = ALERT_LABELS.get(r["alert_level"], r["alert_level"])
            velocity_str = f"{r['daily_velocity']:.2f} c/ngày" if r["daily_velocity"] > 0 else "_Chưa có DL_"
            lines.append(
                f"| `{r['sku']}` | {r['name']} | {velocity_str} | "
                f"{r['available']:,} | {r['in_production']:,} | {r['total_stock']:,} | "
                f"{doc} | {label} | {proposed} |"
            )
        lines.append("")

    # Action list
    urgent = [r for r in rows if r["alert_level"] in ("critical", "reorder") and r["proposed_qty"] > 0]
    if urgent:
        lines += [
            "## ✅ Danh sách hành động đề xuất",
            "",
        ]
        for r in urgent:
            lines.append(
                f"- [ ] **{r['sku']}** — {r['name']}: "
                f"lên lệnh sản xuất / gọi hàng **{r['proposed_qty']:,} cái** "
                f"({ALERT_LABELS[r['alert_level']]})"
            )
        lines.append("")

    lines += [
        "---",
        f"_Báo cáo được tạo tự động bởi `order-forecast` skill · {today}_",
    ]

    return "\n".join(lines)


def format_json(rows: list[dict], params: dict) -> str:
    output = {
        "generated_at": date.today().isoformat(),
        "params": params,
        "summary": {
            "total_skus": len(rows),
            "critical_count": sum(1 for r in rows if r["alert_level"] == "critical"),
            "reorder_count": sum(1 for r in rows if r["alert_level"] == "reorder"),
            "safe_count": sum(1 for r in rows if r["alert_level"] == "safe"),
            "total_proposed_qty": sum(r["proposed_qty"] for r in rows),
        },
        "rows": rows,
    }
    return json.dumps(output, indent=2, ensure_ascii=False)


# ─── CLI ──────────────────────────────────────────────────────────────────────

def cmd_analyze(args: argparse.Namespace) -> None:
    data = load_backup(args.backup_file)

    params = {
        "lead_time": args.lead_time,
        "safety_stock": args.safety_stock,
        "cover_days": args.cover_days,
        "velocity_days": args.velocity_days,
    }

    rows = compute_forecast(data, **params)

    if args.format == "markdown":
        report = format_markdown(rows, params)
        if args.output:
            Path(args.output).write_text(report, encoding="utf-8")
            print(f"Success! Báo cáo đã được lưu tại: {args.output}")
        else:
            print(report)
    else:
        report = format_json(rows, params)
        if not args.output:
            print("ERROR: --output bắt buộc khi sử dụng --format=json", file=sys.stderr)
            sys.exit(1)
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"Success! Dữ liệu JSON đã được lưu tại: {args.output}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="order_forecast",
        description="Công cụ dự kiến gọi hàng cho Silence Production",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    analyze = subparsers.add_parser("analyze", help="Phân tích và xuất báo cáo dự báo gọi hàng")
    analyze.add_argument(
        "--backup-file",
        required=True,
        metavar="PATH",
        help="Đường dẫn đến file JSON backup của Silence Production",
    )
    analyze.add_argument(
        "--lead-time",
        type=int,
        default=25,
        metavar="DAYS",
        help="Thời gian sản xuất dự kiến (ngày). Mặc định: 25",
    )
    analyze.add_argument(
        "--safety-stock",
        type=int,
        default=20,
        metavar="QTY",
        help="Tồn kho an toàn tối thiểu (cái). Mặc định: 20",
    )
    analyze.add_argument(
        "--cover-days",
        type=int,
        default=30,
        metavar="DAYS",
        help="Số ngày phủ sóng tồn kho mong muốn sau gọi hàng. Mặc định: 30",
    )
    analyze.add_argument(
        "--velocity-days",
        type=int,
        default=30,
        metavar="DAYS",
        help="Số ngày gần nhất dùng để tính tốc độ bán. Mặc định: 30",
    )
    analyze.add_argument(
        "--format",
        choices=["json", "markdown"],
        default="json",
        help="Định dạng kết quả: json (mặc định) hoặc markdown",
    )
    analyze.add_argument(
        "--output",
        metavar="PATH",
        help="Đường dẫn file kết quả. Bắt buộc với --format=json",
    )

    return parser


if __name__ == "__main__":
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "analyze":
        cmd_analyze(args)
    else:
        parser.print_help()
        sys.exit(1)
