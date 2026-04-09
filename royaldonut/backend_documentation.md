# Royal Doughnuts – Next.js Frontend Documentation

Base URL: `https://royal-dounuts.labs.cloudjet.org/processor.php`

All requests are **POST** with `Content-Type: application/json`.  
The action is passed as a **query param**: `?action=<action_name>`.  
Auth is **session-based** (PHP sessions via cookies) – include `credentials: 'include'` in every fetch.

---

## 1. Setup

### API client (`lib/api.ts`)

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL; // https://royal-dounuts.labs.cloudjet.org/processor.php

type ApiResponse<T = Record<string, unknown>> =
  | ({ success: true; message?: string } & T)
  | { success: false; message: string };

export async function api<T = Record<string, unknown>>(
  action: string,
  body?: object,
  params?: Record<string, string>
): Promise<ApiResponse<T>> {
  const url = new URL(BASE!);
  url.searchParams.set('action', action);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: 'POST',
    credentials: 'include',          // required for session cookies
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  return res.json();
}
```

### Read-only GET-like calls (filters sent as query params, body ignored)

Some actions read their filters from `$_GET` (URL params), not the body.  
Use the `params` argument for those: `api('get_orders', undefined, { status: 'pending' })`.

---

## 2. Roles & Access Matrix

| Role | Value in session | Can do |
|---|---|---|
| `cashier` | `"cashier"` | own shifts, place/view/cancel orders, update payment |
| `kitchen` | `"kitchen"` | own shifts, view active orders, advance order status, manage stock |
| `super_admin` | `"super_admin"` | everything |

The server enforces these; the frontend should also hide irrelevant UI.

---

## 3. Auth

### `login`
```ts
const res = await api<{ user: User }>('login', { username: 'admin', password: '123' });
// res.user = { id, full_name, username, role }
```

**Response**
```json
{
  "success": true,
  "message": "تم تسجيل الدخول بنجاح",
  "user": { "id": 1, "full_name": "Ahmed Hassan", "username": "admin", "role": "super_admin" }
}
```

**Error (401)**
```json
{ "success": false, "message": "اسم المستخدم أو كلمة المرور غير صحيحة" }
```

---

### `logout`
```ts
await api('logout');
```

---

### `get_profile`
```ts
const res = await api<{ user: User }>('get_profile');
```
Returns current session user. Returns 401 if not logged in. Use this for session hydration on app load.

---

## 4. Cashier Shifts

### `start_cashier_shift`
**Roles:** cashier, super_admin

```ts
await api('start_cashier_shift', {
  opening_cash: 500,   // number, required – cash in drawer at start
  notes: 'وردية الصباح' // string, optional
});
```

**Response**
```json
{
  "success": true,
  "message": "تم بدء الوردية بنجاح",
  "shift": {
    "id": 1,
    "user_id": 2,
    "opening_cash": "500.00",
    "status": "open",
    "started_at": "2026-04-09 10:00:00"
  }
}
```

**Error:** Returns 400 if a shift is already open.

---

### `end_cashier_shift`
**Roles:** cashier, super_admin

```ts
await api('end_cashier_shift', {
  closing_cash: 1250,  // number, required – actual cash in drawer
  notes: 'لا ملاحظات'  // optional
});
```

The server auto-calculates `expected_cash` (opening + cash sales) and `cash_difference`.

**Response**
```json
{
  "success": true,
  "shift": {
    "shift_id": 1,
    "cashier_name": "Mohamed Ali",
    "opening_cash": "500.00",
    "closing_cash": "1250.00",
    "expected_cash": "1200.00",
    "cash_difference": "50.00",
    "orders_count": 18,
    "shift_revenue": "1800.00",
    "status": "closed"
  }
}
```

---

### `get_my_shift`
**Roles:** cashier, super_admin

```ts
const res = await api<{ shift: CashierShift | null }>('get_my_shift');
// res.shift is null if no open shift
```

---

## 5. Kitchen Shifts

### `start_kitchen_shift`
**Roles:** kitchen, super_admin

```ts
await api('start_kitchen_shift', { notes: '' });
```

Automatically snapshots quantities of **all active stock items** as `opening`.

**Response**
```json
{
  "success": true,
  "shift": { "id": 3, "user_id": 3, "status": "open", "started_at": "..." },
  "stock_snapshot_items": 7
}
```

---

### `end_kitchen_shift`
**Roles:** kitchen, super_admin

```ts
await api('end_kitchen_shift', {
  notes: '',
  closing_stock: [
    { stock_item_id: 1, qty: 42.5 },
    { stock_item_id: 2, qty: 180 },
    // one entry per active stock item
  ]
});
```

`closing_stock` must list the physical count of every stock item at shift end.

---

### `get_my_kitchen_shift`
**Roles:** kitchen, super_admin

```ts
const res = await api<{ shift: KitchenShift | null }>('get_my_kitchen_shift');
// res.shift.opening_snapshot = [{ stock_item_id, name, unit, qty }]
```

---

### `get_kitchen_shift_details`
**Roles:** kitchen, super_admin  
**Query param:** `id`

```ts
const res = await api<{ shift: KitchenShift }>('get_kitchen_shift_details', undefined, { id: '3' });
// res.shift.snapshots = [{ moment: 'opening'|'closing', stock_name, unit, qty }]
```

---

## 6. Menu

### `get_menu`
**Roles:** all  
**Query param:** `active` (default `1`)

```ts
// active menu (for cashier order screen)
const res = await api<{ items: MenuItem[] }>('get_menu', undefined, { active: '1' });

// all items including inactive (for admin)
const res = await api<{ items: MenuItem[] }>('get_menu', undefined, { active: '0' });
```

**MenuItem shape**
```ts
interface MenuItem {
  id: number;
  category_id: number;
  category_name: string;
  name: string;
  description: string | null;
  price: string;           // decimal string e.g. "35.00"
  cost_estimate: string;
  prep_time_min: number | null;
  image_url: string | null;
  is_available: 0 | 1;
  is_active: 0 | 1;
}
```

---

### `get_menu_categories`
**Roles:** all

```ts
const res = await api<{ categories: MenuCategory[] }>('get_menu_categories');
```

---

### `get_menu_item`
**Roles:** all  
**Query param:** `id`

```ts
const res = await api<{ item: MenuItem & { ingredients: Ingredient[] } }>('get_menu_item', undefined, { id: '1' });
// item.ingredients = [{ stock_item_id, stock_name, unit, qty_needed }]
```

---

### `create_menu_category` *(admin)*
```ts
await api('create_menu_category', { name: 'وجبات', sort_order: 2 });
```

---

### `create_menu_item` *(admin)*
```ts
await api('create_menu_item', {
  category_id: 1,
  name: 'شاورما دجاج',
  description: '',
  price: 35,
  cost_estimate: 15,
  prep_time_min: 5,
  image_url: ''
});
// Response: { success: true, id: 8 }
```

---

### `update_menu_item` *(admin)*
```ts
await api('update_menu_item', {
  id: 1,
  category_id: 1,
  name: 'شاورما دجاج',
  description: '',
  price: 38,
  cost_estimate: 15,
  prep_time_min: 5,
  image_url: ''
});
```

---

### `toggle_menu_item_availability`
**Roles:** kitchen, super_admin

```ts
await api('toggle_menu_item_availability', { id: 1 });
// Response: { success: true, item: { id, name, is_available: 0 } }
```

Toggles between available/unavailable (e.g. ran out mid-shift).

---

### `toggle_menu_item_active` *(admin)*
```ts
await api('toggle_menu_item_active', { id: 1 });
// Completely hides/shows item from the system
```

---

### `set_menu_item_ingredients` *(admin)*
```ts
await api('set_menu_item_ingredients', {
  menu_item_id: 1,
  ingredients: [
    { stock_item_id: 1, qty_needed: 0.15 },  // 150g chicken per item
    { stock_item_id: 2, qty_needed: 1 },      // 1 pita bread
  ]
});
```
Replaces all existing ingredients. Send empty array to clear.

---

## 7. Orders

### `place_order`
**Roles:** cashier, super_admin  
Requires an open cashier shift.

```ts
await api('place_order', {
  items: [
    { menu_item_id: 1, quantity: 2, special_request: 'بدون بصل' },
    { menu_item_id: 6, quantity: 1, special_request: '' },
  ],
  customer_name: 'محمد',         // optional
  customer_phone: '0501234567',  // optional
  discount_amount: 5,            // optional, default 0
  tax_amount: 0,                 // optional, default 0
  payment_method: 'cash',        // 'cash' | 'card' | 'online' | 'other'
  payment_status: 'pending',     // usually 'pending' at creation
  estimated_pickup: '',          // optional datetime string
  notes: ''
});
```

**Response**
```json
{
  "success": true,
  "message": "تم إنشاء الطلب بنجاح",
  "order": {
    "id": 1,
    "order_number": "ORD-20260409-0001",
    "subtotal": "80.00",
    "discount_amount": "5.00",
    "tax_amount": "0.00",
    "total": "75.00",
    "payment_method": "cash",
    "payment_status": "pending",
    "order_status": "pending",
    "items": [
      { "menu_item_id": 1, "item_name": "شاورما دجاج", "unit_price": "35.00", "quantity": 2, "line_total": "70.00", "special_request": "بدون بصل" },
      { "menu_item_id": 6, "item_name": "Pepsi 330ml",  "unit_price": "10.00", "quantity": 1, "line_total": "10.00", "special_request": "" }
    ]
  }
}
```

**Error cases:**
- No open shift → 400
- Item unavailable/inactive → 400
- Item not found → 400

---

### `get_orders`
**Roles:** cashier (own open shift), super_admin (any shift)  
**Query params:** `shift_id` (admin only), `status`

```ts
// Cashier sees their current open shift orders automatically
const res = await api<{ orders: Order[] }>('get_orders');

// Admin filters by shift or status
const res = await api<{ orders: Order[] }>('get_orders', undefined, {
  shift_id: '5',
  status: 'pending'   // optional
});
```

---

### `get_order`
**Roles:** all  
**Query param:** `id`

```ts
const res = await api<{ order: OrderDetail }>('get_order', undefined, { id: '1' });
// order.items = [...]
// order.status_log = [{ old_status, new_status, changed_by_name, created_at }]
```

---

### `update_order_payment`
**Roles:** cashier, super_admin

```ts
await api('update_order_payment', {
  order_id: 1,
  payment_status: 'paid',   // 'pending' | 'paid' | 'refunded' | 'partially_refunded'
  payment_method: 'card'    // optional, only if changing method
});
```

---

### `cancel_order`
**Roles:** cashier, super_admin  
Cannot cancel `picked_up` orders.

```ts
await api('cancel_order', { order_id: 1 });
```

---

### `get_active_orders`
**Roles:** kitchen, cashier, super_admin  
**Query param:** `statuses` (comma-separated, default `pending,preparing`)

```ts
// Kitchen's main queue
const res = await api<{ orders: OrderDetail[] }>('get_active_orders', undefined, {
  statuses: 'pending,preparing'
});

// Include ready orders too
const res = await api<{ orders: OrderDetail[] }>('get_active_orders', undefined, {
  statuses: 'pending,preparing,ready'
});
// Each order includes its items array
```

---

### `update_order_status`
**Roles:** kitchen, cashier, super_admin

```ts
await api('update_order_status', {
  order_id: 1,
  order_status: 'preparing'  // 'preparing' | 'ready' | 'picked_up' | 'cancelled'
});
```

**Flow:** `pending` → `preparing` → `ready` → `picked_up`

| Transition | Side effect |
|---|---|
| `→ preparing` | Stock ingredients deducted automatically |
| `→ picked_up` | `payment_status` set to `"paid"` automatically |

Cannot go backwards. Returns 400 on invalid transition.

---

### `get_all_orders` *(admin)*
**Query params:** `from`, `to` (dates, default today), `status`

```ts
const res = await api<{ orders: Order[] }>('get_all_orders', undefined, {
  from: '2026-04-01',
  to: '2026-04-09',
  status: 'cancelled'  // optional filter
});
```

---

## 8. Stock

### `get_stock`
**Roles:** kitchen, super_admin

```ts
const res = await api<{ items: StockItem[] }>('get_stock');
```

```ts
interface StockItem {
  id: number;
  name: string;
  unit: string;          // e.g. "kg", "piece"
  current_qty: string;   // decimal string
  min_qty: string;
  cost_per_unit: string;
  is_active: 0 | 1;
}
```

---

### `get_all_stock` *(admin)*
Same as `get_stock` but includes inactive items.

---

### `get_low_stock`
**Roles:** kitchen, super_admin  
Returns items where `current_qty <= min_qty`.

```ts
const res = await api<{ items: LowStockItem[] }>('get_low_stock');
```

---

### `get_stock_units`
**Roles:** all

```ts
const res = await api<{ units: { id: number; name: string }[] }>('get_stock_units');
// ["kg", "g", "litre", "ml", "piece", "box", "pack", "dozen"]
```

---

### `add_stock_transaction`
**Roles:** kitchen, super_admin

```ts
await api('add_stock_transaction', {
  stock_item_id: 1,
  type: 'purchase',      // 'purchase' | 'waste' | 'adjustment'
  qty: 20,               // positive for purchase/adjustment-add, negative for adjustment-subtract; waste always treated as negative
  unit_cost: 120,        // optional, cost per unit (for purchase)
  reference_note: 'توريد من المورد'  // optional
});
```

**Type behaviour:**
- `purchase` → always adds `abs(qty)` to stock
- `waste` → always subtracts `abs(qty)` from stock
- `adjustment` → adds signed `qty` (use negative to correct downward)

**Response:** returns updated stock item.

---

### `get_stock_transactions`
**Roles:** kitchen, super_admin  
**Query params:** `stock_item_id` (optional), `type` (optional)

```ts
const res = await api<{ transactions: StockTransaction[] }>('get_stock_transactions', undefined, {
  stock_item_id: '1',
  type: 'purchase'
});
```

---

### `create_stock_item` *(admin)*
```ts
await api('create_stock_item', {
  name: 'زيت نباتي',
  unit_id: 3,          // from get_stock_units
  current_qty: 10,
  min_qty: 2,
  cost_per_unit: 45
});
```

---

### `update_stock_item` *(admin)*
```ts
await api('update_stock_item', {
  id: 1,
  name: 'Chicken Breast',
  unit_id: 1,
  min_qty: 15,
  cost_per_unit: 125
});
// Note: current_qty is NOT editable here – use add_stock_transaction instead
```

---

### `toggle_stock_item` *(admin)*
```ts
await api('toggle_stock_item', { id: 1 });
```

---

## 9. Expenses

### `get_expense_categories` *(admin)*
```ts
const res = await api<{ categories: ExpenseCategory[] }>('get_expense_categories');
// [{ id, name, is_active }]
// Seeded: Rent, Utilities, Salaries, Maintenance, Marketing, Packaging, Delivery, Other
```

---

### `get_expenses` *(admin)*
**Query params:** `from`, `to` (default: current month)

```ts
const res = await api<{ expenses: Expense[] }>('get_expenses', undefined, {
  from: '2026-04-01',
  to: '2026-04-30'
});
```

---

### `add_expense` *(admin)*
```ts
await api('add_expense', {
  category_id: 3,
  amount: 25000,
  description: 'رواتب أبريل',
  expense_date: '2026-04-09',  // default: today
  receipt_url: ''              // optional
});
```

---

### `delete_expense` *(admin)*
```ts
await api('delete_expense', { id: 5 });
```

---

## 10. Users

### `get_users` *(admin)*
```ts
const res = await api<{ users: UserRecord[] }>('get_users');
// [{ id, full_name, username, phone, is_active, role, created_at }]
```

---

### `create_user` *(admin)*
```ts
await api('create_user', {
  full_name: 'علي محمد',
  username: 'cashier2',
  password: 'SecurePass123',
  role_id: 1,         // 1=cashier, 2=kitchen, 3=super_admin
  phone: '0509999999' // optional
});
```

---

### `update_user` *(admin)*
```ts
await api('update_user', {
  id: 2,
  full_name: 'علي محمد العمري',
  phone: '0501111111',
  role_id: 1,
  password: 'NewPass456'  // omit to keep existing password
});
```

---

### `toggle_user_status` *(admin)*
```ts
await api('toggle_user_status', { id: 2 });
// Cannot disable your own account
```

---

## 11. Reports (admin)

### `get_dashboard`
One-call summary for the admin home screen.

```ts
const res = await api('get_dashboard');
```

**Response**
```json
{
  "success": true,
  "today_report": {
    "report_date": "2026-04-09",
    "gross_income": "2450.00",
    "total_expenses": "500.00",
    "stock_costs": "320.50000",
    "net_profit": "1629.50000",
    "total_orders": 32,
    "cancelled_orders": 2
  },
  "low_stock_items": [ { "id": 3, "name": "Tahini", "unit": "litre", "current_qty": "1.500", "min_qty": "2.000" } ],
  "open_cashier_shifts": [ { "id": 1, "cashier_name": "Mohamed Ali", "opening_cash": "500.00", "status": "open" } ],
  "open_kitchen_shifts": [ { "id": 1, "full_name": "Sara Ibrahim", "status": "open" } ],
  "order_counts": [
    { "order_status": "pending",   "cnt": 3 },
    { "order_status": "preparing", "cnt": 5 }
  ]
}
```

---

### `get_daily_report`
**Query params:** `from`, `to`

```ts
const res = await api<{ report: DailyProfit[] }>('get_daily_report', undefined, {
  from: '2026-04-01',
  to: '2026-04-09'
});
```

**DailyProfit row**
```ts
interface DailyProfit {
  report_date: string;
  gross_income: string;
  total_expenses: string;
  stock_costs: string;
  net_profit: string;
  total_orders: number;
  cancelled_orders: number;
}
```

---

### `get_income_report`
**Query params:** `from`, `to`

```ts
const res = await api<{ report: DailyIncome[] }>('get_income_report', undefined, { from: '...', to: '...' });
```

**DailyIncome row**
```ts
interface DailyIncome {
  report_date: string;
  total_orders: number;
  gross_income: string;
  total_discounts: string;
  cash_income: string;
  non_cash_income: string;
  cancelled_orders: number;
}
```

---

### `get_top_selling`
**Query params:** `limit` (default 10, max 50), `from` + `to` (optional date range)

```ts
const res = await api<{ items: TopItem[] }>('get_top_selling', undefined, { limit: '5' });

// with date range
const res = await api<{ items: TopItem[] }>('get_top_selling', undefined, {
  limit: '10', from: '2026-04-01', to: '2026-04-09'
});
```

---

### `get_cashier_shifts`
**Query params:** `from`, `to`, `user_id` (optional)

```ts
const res = await api<{ shifts: CashierShiftSummary[] }>('get_cashier_shifts', undefined, {
  from: '2026-04-01',
  to: '2026-04-09'
});
```

**CashierShiftSummary** (from `v_cashier_shift_summary`)
```ts
interface CashierShiftSummary {
  shift_id: number;
  cashier_name: string;
  started_at: string;
  ended_at: string | null;
  opening_cash: string;
  closing_cash: string | null;
  expected_cash: string | null;
  cash_difference: string | null;
  orders_count: number;
  shift_revenue: string;
  status: 'open' | 'closed';
}
```

---

### `get_kitchen_shifts`
**Query params:** `from`, `to`

```ts
const res = await api<{ shifts: KitchenShift[] }>('get_kitchen_shifts', undefined, {
  from: '2026-04-01', to: '2026-04-09'
});
```

---

## 12. Error handling

Every failed response has this shape:
```json
{ "success": false, "message": "رسالة الخطأ بالعربية" }
```

Common HTTP codes:
| Code | Meaning |
|---|---|
| 400 | Validation error / business rule violation |
| 401 | Not logged in |
| 403 | Logged in but wrong role |
| 404 | Resource or action not found |
| 500 | Server / DB error |

Recommended pattern:
```ts
const res = await api('place_order', payload);
if (!res.success) {
  toast.error(res.message); // already in Arabic
  return;
}
// use res.order
```

---

## 13. Suggested Next.js project structure

```
app/
  (auth)/
    login/page.tsx
  (cashier)/
    shift/page.tsx         — start/end shift
    orders/page.tsx        — place order + order list
    orders/[id]/page.tsx   — order detail
  (kitchen)/
    shift/page.tsx         — start/end shift + stock snapshot form
    queue/page.tsx         — active orders, advance status
    stock/page.tsx         — stock list, add transaction
  (admin)/
    dashboard/page.tsx
    orders/page.tsx
    shifts/page.tsx
    stock/page.tsx
    menu/page.tsx
    expenses/page.tsx
    users/page.tsx
    reports/page.tsx
  layout.tsx               — guards route by role
lib/
  api.ts                   — fetch wrapper (above)
  auth.ts                  — useUser hook / context
  types.ts                 — all interfaces
```

### Auth guard example
```ts
// lib/auth.ts
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>('get_profile')
      .then(r => { if (r.success) setUser(r.user); })
      .finally(() => setLoading(false));
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export const useUser = () => useContext(AuthContext);
```

### Role-based layout guard
```ts
// app/(cashier)/layout.tsx
'use client';
import { useUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !['cashier', 'super_admin'].includes(user.role))) {
      router.replace('/login');
    }
  }, [user, loading]);

  if (loading || !user) return null;
  return <>{children}</>;
}
```

---

## 14. Key UX flows

### Cashier flow
1. Login → redirect based on role
2. Check `get_my_shift` — if no open shift, show "Start Shift" screen with cash input
3. Order screen: `get_menu` (active only) → build cart → `place_order`
4. After placing: show order number, optionally `update_order_payment` if paid immediately
5. End of day: `end_cashier_shift` with closing cash amount

### Kitchen flow
1. Login → `get_my_kitchen_shift` — if none, start shift (auto-snapshots stock)
2. Main screen: poll `get_active_orders?statuses=pending,preparing` every 15-30s
3. On order card: button "بدء التحضير" → `update_order_status { order_status: 'preparing' }`  
   (this deducts stock automatically)
4. Then "جاهز" → `update_order_status { order_status: 'ready' }`
5. Stock management tab: `get_stock`, `add_stock_transaction` for purchases/waste
6. End shift: `end_kitchen_shift` with physical count form for each stock item

### Admin flow
1. Dashboard: `get_dashboard` for live overview
2. Reports: date-range pickers feeding `get_daily_report`, `get_top_selling`
3. Shift review: `get_cashier_shifts` → click → `get_kitchen_shift_details`
4. Menu management: CRUD via `create/update_menu_item` + `set_menu_item_ingredients`
5. Expenses: monthly view via `get_expenses`, add via `add_expense`
