# Shifts & Daily Income API Documentation

## Base URL
```
POST /processor.php?action={action_name}
```

## Authentication
All endpoints require `X-Authorization` header with Bearer token.
```
X-Authorization: Bearer {token}
```

---

## Shift Management Endpoints

### 1. Start Shift
Start a new shift for the current admin.

**Endpoint:** `?action=startShift`

**Request Body:**
```json
{
  "started_at": "2026-02-08 09:00:00",  // optional, defaults to current time
  "opening_cash": 500.00,               // optional, defaults to 0
  "notes": "Morning shift"              // optional
}
```

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Shift started successfully.",
    "shift_id": 1,
    "admin": {
      "id": 2,
      "name": "John Doe",
      "role": "admin"
    },
    "started_at": "2026-02-08 09:00:00",
    "opening_cash": 500.00,
    "notes": "Morning shift"
  }
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "You already have an active shift started at 2026-02-08 09:00:00"
}
```

---

### 2. End Shift
End the current active shift and calculate all income.

**Endpoint:** `?action=endShift`

**Request Body:**
```json
{
  "ended_at": "2026-02-08 17:00:00",  // optional, defaults to current time
  "closing_cash": 2500.00,            // optional, defaults to 0
  "notes": "End of shift notes"       // optional
}
```

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Shift ended successfully.",
    "shift_id": 1,
    "admin": {
      "id": 2,
      "name": "John Doe",
      "role": "admin"
    },
    "started_at": "2026-02-08 09:00:00",
    "ended_at": "2026-02-08 17:00:00",
    "duration_hours": 8.0,
    "opening_cash": 500.00,
    "closing_cash": 2500.00,
    "expected_cash": 2450.00,
    "cash_difference": 50.00,
    "income_summary": {
      "total_revenue": 1950.00,
      "order_revenue": 1200.00,
      "booking_revenue": 750.00,
      "total_discount": 50.00,
      "total_orders": 25,
      "total_bookings": 8,
      "total_transactions": 33
    }
  }
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "No active shift found."
}
```

---

### 3. Get Current Shift
Get details of the current active shift with live stats.

**Endpoint:** `?action=getCurrentShift`

**Request Body:** None

**Success Response (with active shift):**
```json
{
  "status": "success",
  "data": {
    "has_active_shift": true,
    "shift": {
      "id": 1,
      "admin_id": 2,
      "admin_name": "John Doe",
      "admin_role": "admin",
      "started_at": "2026-02-08 09:00:00",
      "ended_at": null,
      "opening_cash": 500.00,
      "notes": "Morning shift",
      "status": "active",
      "current_revenue": 850.00,
      "current_orders": 12,
      "current_bookings": 4,
      "current_discount": 25.00,
      "duration_hours": 3.5
    }
  }
}
```

**Success Response (no active shift):**
```json
{
  "status": "success",
  "data": {
    "has_active_shift": false,
    "shift": null
  }
}
```

---

### 4. List Shifts
List all shifts with optional date filtering. Superadmin sees all shifts, others see only their own.

**Endpoint:** `?action=listShifts`

**Request Body:**
```json
{
  "start_date": "2026-02-01",  // optional
  "end_date": "2026-02-08"     // optional
}
```

**Success Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "admin_id": 2,
      "admin_name": "John Doe",
      "admin_role": "admin",
      "started_at": "2026-02-08 09:00:00",
      "ended_at": "2026-02-08 17:00:00",
      "opening_cash": 500.00,
      "closing_cash": 2500.00,
      "total_revenue": 1950.00,
      "total_orders": 25,
      "total_bookings": 8,
      "total_discount": 50.00,
      "cash_difference": 50.00,
      "duration_hours": 8.0,
      "notes": "Morning shift\nEnd notes",
      "status": "completed"
    }
  ]
}
```

---

### 5. Get Shift Report
Get detailed report for a specific shift including all orders and bookings.

**Endpoint:** `?action=getShiftReport`

**Request Body:**
```json
{
  "shift_id": 1
}
```

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "admin_id": 2,
    "admin_name": "John Doe",
    "admin_role": "admin",
    "admin_email": "john@example.com",
    "started_at": "2026-02-08 09:00:00",
    "ended_at": "2026-02-08 17:00:00",
    "opening_cash": 500.00,
    "closing_cash": 2500.00,
    "total_revenue": 1950.00,
    "total_orders": 25,
    "total_bookings": 8,
    "status": "completed",
    "orders": [
      {
        "id": 1,
        "customer_id": 5,
        "customer_name": "Ahmed",
        "customer_phone": "0123456789",
        "price": 50.00,
        "discount": 5.00,
        "created_at": "2026-02-08 10:30:00"
      }
    ],
    "bookings": [
      {
        "id": 1,
        "room_id": 2,
        "room_name": "Room A",
        "customer_id": 5,
        "customer_name": "Ahmed",
        "customer_phone": "0123456789",
        "price": 100.00,
        "started_at": "2026-02-08 11:00:00",
        "finished_at": "2026-02-08 13:00:00",
        "createdAt": "2026-02-08 11:00:00"
      }
    ],
    "hourly_breakdown": [
      {
        "hour": 10,
        "order_count": 5,
        "revenue": 150.00
      },
      {
        "hour": 11,
        "order_count": 8,
        "revenue": 220.00
      }
    ]
  }
}
```

---

## Daily Income Analysis Endpoints

### 6. Get Daily Income Analysis
Get comprehensive daily income analysis. **Superadmin only.**

**Endpoint:** `?action=getDailyIncomeAnalysis`

**Request Body:**
```json
{
  "date": "2026-02-08"  // optional, defaults to today
}
```

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "date": "2026-02-08",
    "summary": {
      "total_revenue": 3500.00,
      "order_revenue": 2200.00,
      "booking_revenue": 1300.00,
      "total_cost": 800.00,
      "total_profit": 2700.00,
      "profit_margin": 77.14,
      "total_discount": 120.00,
      "total_orders": 45,
      "total_bookings": 12,
      "total_transactions": 57,
      "avg_order_value": 48.89,
      "avg_booking_value": 108.33
    },
    "shifts": {
      "count": 2,
      "total_shift_revenue": 3500.00,
      "details": [
        {
          "id": 1,
          "admin_name": "John Doe",
          "started_at": "2026-02-08 09:00:00",
          "ended_at": "2026-02-08 17:00:00",
          "total_revenue": 1950.00
        },
        {
          "id": 2,
          "admin_name": "Jane Smith",
          "started_at": "2026-02-08 17:00:00",
          "ended_at": "2026-02-09 01:00:00",
          "total_revenue": 1550.00
        }
      ]
    },
    "orders": [
      {
        "id": 1,
        "customer_name": "Ahmed",
        "price": 50.00,
        "discount": 5.00,
        "created_at": "2026-02-08 10:30:00"
      }
    ],
    "bookings": [
      {
        "id": 1,
        "room_name": "Room A",
        "customer_name": "Ahmed",
        "price": 100.00,
        "started_at": "2026-02-08 11:00:00",
        "finished_at": "2026-02-08 13:00:00"
      }
    ],
    "top_selling_items": [
      {
        "id": 1,
        "name": "Pepsi",
        "price": 15.00,
        "cost": 8.00,
        "quantity_sold": 50,
        "revenue": 750.00
      },
      {
        "id": 2,
        "name": "Chips",
        "price": 10.00,
        "cost": 5.00,
        "quantity_sold": 35,
        "revenue": 350.00
      }
    ],
    "room_utilization": [
      {
        "id": 1,
        "name": "Room A",
        "ps": "PS5",
        "booking_count": 5,
        "revenue": 500.00,
        "total_minutes": 600,
        "total_hours": 10.0
      }
    ],
    "hourly_breakdown": [
      {
        "hour": 9,
        "hour_label": "09:00",
        "order_revenue": 120.00,
        "booking_revenue": 0,
        "order_count": 5,
        "booking_count": 0,
        "total_revenue": 120.00,
        "total_transactions": 5
      },
      {
        "hour": 10,
        "hour_label": "10:00",
        "order_revenue": 180.00,
        "booking_revenue": 100.00,
        "order_count": 8,
        "booking_count": 1,
        "total_revenue": 280.00,
        "total_transactions": 9
      }
    ],
    "peak_hour": {
      "hour": 18,
      "hour_label": "18:00 - 19:00",
      "revenue": 450.00
    },
    "report_generated_at": "2026-02-08 23:30:00",
    "report_generated_by": {
      "id": 1,
      "name": "Super Admin",
      "role": "superadmin"
    }
  }
}
```

---

### 7. Get Printable Daily Report
Get simplified daily report formatted for printing. **Superadmin only.**

**Endpoint:** `?action=getPrintableDailyReport`

**Request Body:**
```json
{
  "date": "2026-02-08"  // optional, defaults to today
}
```

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "business_name": "X-SPACE STATION",
    "report_title": "DAILY INCOME ANALYSIS",
    "date": "Sunday, February 8, 2026",
    "date_short": "2026-02-08",
    "print_time": "2026-02-08 23:30:00",
    "printed_by": "Super Admin",
    "summary": {
      "total_revenue": 3500.00,
      "order_revenue": 2200.00,
      "booking_revenue": 1300.00,
      "total_discount": 120.00,
      "net_revenue": 3380.00,
      "total_orders": 45,
      "total_bookings": 12,
      "total_transactions": 57
    },
    "shifts": {
      "count": 2,
      "total_opening_cash": 1000.00,
      "total_closing_cash": 4500.00,
      "shift_revenue": 3500.00
    },
    "formatted_for_print": true
  }
}
```

---

### 8. Get Monthly Shift Summary
Get monthly summary with daily breakdown and staff performance. **Superadmin only.**

**Endpoint:** `?action=getMonthlyShiftSummary`

**Request Body:**
```json
{
  "month": "2026-02"  // optional, defaults to current month
}
```

**Success Response:**
```json
{
  "status": "success",
  "data": {
    "month": "2026-02",
    "month_name": "February 2026",
    "summary": {
      "total_revenue": 85000.00,
      "total_days": 8,
      "avg_daily_revenue": 10625.00
    },
    "daily_summary": [
      {
        "date": "2026-02-01",
        "shift_count": 2,
        "revenue": 9500.00,
        "orders": 40,
        "bookings": 15,
        "total_hours": 16.0
      },
      {
        "date": "2026-02-02",
        "shift_count": 2,
        "revenue": 11200.00,
        "orders": 52,
        "bookings": 18,
        "total_hours": 16.0
      }
    ],
    "staff_performance": [
      {
        "id": 2,
        "name": "John Doe",
        "role": "admin",
        "shift_count": 8,
        "revenue": 45000.00,
        "hours_worked": 64.0
      },
      {
        "id": 3,
        "name": "Jane Smith",
        "role": "cashier",
        "shift_count": 8,
        "revenue": 40000.00,
        "hours_worked": 64.0
      }
    ]
  }
}
```

---

## Frontend Usage Examples

### React/TypeScript Types

```typescript
// Types
interface Admin {
  id: number;
  name: string;
  role: 'superadmin' | 'admin' | 'manager' | 'cashier';
}

interface Shift {
  id: number;
  admin_id: number;
  admin_name: string;
  admin_role: string;
  started_at: string;
  ended_at: string | null;
  opening_cash: number;
  closing_cash: number;
  total_revenue: number;
  total_orders: number;
  total_bookings: number;
  total_discount: number;
  cash_difference: number;
  duration_hours: number;
  notes: string;
  status: 'active' | 'completed' | 'cancelled';
}

interface CurrentShiftResponse {
  has_active_shift: boolean;
  shift: Shift | null;
}

interface IncomeSummary {
  total_revenue: number;
  order_revenue: number;
  booking_revenue: number;
  total_discount: number;
  total_orders: number;
  total_bookings: number;
  total_transactions: number;
}

interface HourlyBreakdown {
  hour: number;
  hour_label: string;
  order_revenue: number;
  booking_revenue: number;
  order_count: number;
  booking_count: number;
  total_revenue: number;
  total_transactions: number;
}
```

### API Service Example

```typescript
const API_BASE = 'https://your-domain.com/processor.php';

async function apiCall(action: string, body?: object) {
  const response = await fetch(`${API_BASE}?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${getToken()}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return response.json();
}

// Shift functions
export const startShift = (data?: { opening_cash?: number; notes?: string }) => 
  apiCall('startShift', data);

export const endShift = (data?: { closing_cash?: number; notes?: string }) => 
  apiCall('endShift', data);

export const getCurrentShift = () => 
  apiCall('getCurrentShift');

export const listShifts = (startDate?: string, endDate?: string) => 
  apiCall('listShifts', { start_date: startDate, end_date: endDate });

export const getShiftReport = (shiftId: number) => 
  apiCall('getShiftReport', { shift_id: shiftId });

// Report functions (superadmin only)
export const getDailyIncomeAnalysis = (date?: string) => 
  apiCall('getDailyIncomeAnalysis', { date });

export const getPrintableDailyReport = (date?: string) => 
  apiCall('getPrintableDailyReport', { date });

export const getMonthlyShiftSummary = (month?: string) => 
  apiCall('getMonthlyShiftSummary', { month });
```

---

## Permission Summary

| Endpoint | superadmin | admin | manager | cashier |
|----------|------------|-------|---------|---------|
| startShift | ✓ | ✓ | ✓ | ✓ |
| endShift | ✓ | ✓ | ✓ | ✓ |
| getCurrentShift | ✓ | ✓ | ✓ | ✓ |
| listShifts | All shifts | Own only | Own only | Own only |
| getShiftReport | All shifts | Own only | Own only | Own only |
| getDailyIncomeAnalysis | ✓ | ✗ | ✗ | ✗ |
| getPrintableDailyReport | ✓ | ✗ | ✗ | ✗ |
| getMonthlyShiftSummary | ✓ | ✗ | ✗ | ✗ |

---

## Error Codes

| Error Message | Cause |
|---------------|-------|
| "No authorization token provided." | Missing X-Authorization header |
| "Invalid or expired token." | Token expired or invalid |
| "You already have an active shift started at {date}" | Trying to start shift when one is active |
| "No active shift found." | Trying to end shift when none is active |
| "Shift not found." | Invalid shift_id |
| "Unauthorized. You can only view your own shifts." | Non-superadmin trying to view other's shift |
| "Unauthorized. Only superadmin can view daily income analysis." | Non-superadmin accessing reports |
