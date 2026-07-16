---
name: silence-production-batch-field-pattern
description: >-
  Pattern them field moi vao ProductionBatchItem trong du an Silence Production
  (React + TypeScript + LocalStorage). Dung khi can mo rong lenh san xuat voi
  du lieu moi (vi du: so luong tra, loi, so lan giao...). Bao gom checklist
  buoc lam, quy tac tinh toan ton kho, va code pattern cho modal va context.
---

# Silence Production - Batch Field Extension Pattern

## Overview

Skill nay document day du quy trinh them field moi vao `ProductionBatchItem`
trong du an Silence Production (`src/types/index.ts`), bao gom:
- Checklist 5 buoc theo thu tu bat buoc
- Pattern code cho types, context, modal, inventory
- Quy tac business logic tinh ton kho
- Validation rules cho tung field

---

## Fields hien tai trong ProductionBatchItem

```ts
interface ProductionBatchItem {
  productSku: string;
  quantity: number;           // SL dat xuong
  deliveredQty?: number;      // SL xuong da giao ve
  defectQty?: number;         // SL hang loi (tru khoi ton)
  deliveryCount?: number;     // So lan xuong giao (auto-increment)
}
```

---

## Checklist 5 buoc (PHAI lam theo thu tu)

### Buoc 1 - src/types/index.ts
Them field moi vao `ProductionBatchItem`. Luon dung `?` (optional) de
backward-compatible voi du lieu cu trong LocalStorage.

```ts
// Pattern:
newField?: number;  // JSDoc: mo ta ngan gon
```

Quy tac dat ten:
- Field so luong: `xxxQty` (vi du: defectQty, returnQty)
- Field dem lan: `xxxCount` (vi du: deliveryCount)
- Khong dung ten chung chung nhu `value`, `count`

---

### Buoc 2 - src/context/AppContext.tsx -> updateProductionBatch

Neu field moi can auto-compute, them logic vao data.items.map(...):

```ts
// Pattern auto-increment (deliveryCount tang khi deliveredQty tang):
const newItems = data.items.map((newItem) => {
  const oldItem = batch.items.find((i) => i.productSku === newItem.productSku);
  const oldVal = oldItem?.someField ?? 0;
  const newVal = newItem.someField ?? 0;
  const autoCount = newVal > oldVal
    ? (oldItem?.autoCount ?? 0) + 1
    : (oldItem?.autoCount ?? 0);
  return { ...newItem, autoCount };
});
```

Neu field la nhap thu cong (nhu defectQty), khong can xu ly gi them - pass-through tu UI.

Cap nhat log message:
```ts
`${i.productSku}: SL=${i.quantity}, Da tra=${i.deliveredQty ?? 0}, Loi=${i.defectQty ?? 0}, Lan giao=${i.deliveryCount ?? 0}`
```

---

### Buoc 3 - src/pages/Production.tsx

#### 3a. BatchDetailModal (chi doc)

Summary Cards toi da 5 o, dung grid-template-columns: repeat(N, 1fr):

Card mau do nhat cho field "loi/xau":
- backgroundColor: val > 0 ? '#fff1f2' : '#f8fafc'
- borderColor: val > 0 ? '#fecdd3' : '#e2e8f0'
- color: val > 0 ? '#be123c' : '#75777d'

Card mau xanh la cho field "tot/hop le":
- backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d'

Them cot bang items:
- Header: textAlign right, color phan biet theo loai
- Cell: val > 0 ? val : 'dash' (hien thi dash khi = 0)

Badge so lan giao (deliveryCount):
- backgroundColor: '#eff6ff', color: '#1d4ed8'
- Text: "Xe tai [icon] {count}"

#### 3b. BatchEditModal (nhap lieu)

1. Them field vao interface onSave: items: { ...; newField: number }[]
2. Them vao useState khoi tao: newField: item.newField ?? 0
3. Mo rong handleItemChange type union
4. Them validation vao handleSave (min=0, max=deliveredQty)
5. Input mau phan biet:
   - Field "xau": border '#fecdd3', bg '#fff1f2', color '#be123c'
   - Field "tot": border '#b7e4cf', bg '#f0fdf4', color '#006c49'
6. Grid layout: them '90px' per cot moi vao gridTemplateColumns

---

### Buoc 4 - src/pages/Inventory.tsx

#### Cong thuc tinh ton kho (QUAN TRONG):

```
inProduction   = Sum(quantity - deliveredQty) cua running batches
               = Con lai tai xuong (chua tra ve)

totalDelivered = Sum(deliveredQty - defectQty) cua TAT CA batches
               = Hang tot thuc nhan (loai tru hang loi)

available = totalDelivered - sold
           (hoac nhanhStock neu da sync Nhanh.vn)
```

Backward compat pattern (PHAI co):
```ts
if (i.deliveredQty !== undefined) {
  const good = i.deliveredQty - (i.defectQty ?? 0);
  return s + Math.max(0, good);
}
// Fallback cho data cu chua co deliveredQty:
if (b.status === 'completed') return s + i.quantity;
return s;
```

KPI Card label dung: "Con lai tai xuong" (khong phai "Dang san xuat")
nhanhStock override chi khi: !== undefined && !== null (khong dung chi !== undefined)

---

### Buoc 5 - Verify

```bash
npm run build  # Phai pass khong co loi TypeScript
```

Kiem tra logic:
- Mo modal chi tiet lenh SX kiem tra so lieu cac o
- Chinh sua deliveredQty -> deliveryCount phai tu tang
- Sang Inventory kiem tra cot "Da tra tu xuong" va "Kha dung"

---

## Business Logic Rules

| Quan he | Rang buoc |
|---|---|
| deliveredQty | 0 <= deliveredQty <= quantity |
| defectQty | 0 <= defectQty <= deliveredQty |
| goodQty | = deliveredQty - defectQty (computed, khong luu) |
| deliveryCount | auto-increment khi deliveredQty tang, khong giam |
| inProduction (inv) | = quantity - deliveredQty |
| available (inv) | = goodQty - sold hoac nhanhStock neu da sync |

---

## Common Mistakes

1. Dung deliveredQty thay vi goodQty cho ton kho - Hang loi khong nhap kho duoc, phai tru defectQty.

2. inProduction = quantity (khong tru deliveredQty) - Se trung lap so voi Da tra, gay mismatch giua Production va Inventory.

3. Quen ?? 0 khi dung field optional - item.defectQty ?? 0 luon phai co de tranh undefined trong phep tinh.

4. Khong backward-compat - Data cu trong LocalStorage khong co field moi, nen ?? 0 va fallback ve quantity cua completed batch la bat buoc.

5. nhanhStock override deliveredQty du nhanhStock = 0 - Phai check !== undefined && !== null.
