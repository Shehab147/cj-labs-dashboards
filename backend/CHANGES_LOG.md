# Backend API Changes Log

## Date: February 11, 2026

### Overview
This document summarizes the changes made to `proc.php` for the X-Space PlayStation gaming room management system.

---

## 1. Multi-Hour Cost Support for Rooms

### Changes Made:
- **`addRoom()`** - Added `multi_hour_cost` as a required parameter
- **`updateRoom()`** - Added `multi_hour_cost` as a required parameter

### Database Schema Update Required:
```sql
ALTER TABLE rooms ADD COLUMN multi_hour_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00;
```

### Usage:
```json
POST ?action=addRoom
{
  "name": "Room 1",
  "ps": "PS5",
  "hour_cost": 50.00,
  "multi_hour_cost": 80.00,
  "capacity": 4
}
```

---

## 2. Multi-Player Booking Support (`is_multi`)

### Changes Made:
- **`addBooking()`** - Added `is_multi` parameter (0 or 1)
  - If `is_multi = 1`, uses `multi_hour_cost` for price calculation
  - If `is_multi = 0`, uses standard `hour_cost`
- **`endBooking()`** - Reads `is_multi` from booking to calculate final price correctly
- **`listBookings()`**, **`getActiveBookings()`**, **`getBookingEndingAlerts()`**, **`getBookings()`** - Updated queries to include `multi_hour_cost` field

### Database Schema Update Required:
```sql
ALTER TABLE room_booking ADD COLUMN is_multi TINYINT(1) NOT NULL DEFAULT 0;
```

### Usage:
```json
POST ?action=addBooking
{
  "room_id": 1,
  "customer_id": 5,
  "is_multi": 1,
  "started_at": "2026-02-11 14:00:00",
  "finished_at": "2026-02-11 16:00:00"
}
```

---

## 3. Discount Support for Bookings

### Changes Made:
- **`addBooking()`** - Added optional `discount` parameter
  - For scheduled bookings: discount is applied immediately and stored with calculated price
  - For open sessions: discount is stored and applied when booking ends
- **`endBooking()`** - Reads stored `discount` and subtracts from calculated price

### Database Schema Update Required:
```sql
ALTER TABLE room_booking ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
```

### Price Calculation Formula:
```
price_before_discount = (hour_cost / 60) * total_minutes
final_price = price_before_discount - discount
```

### Usage:
```json
POST ?action=addBooking
{
  "room_id": 1,
  "customer_id": 5,
  "is_multi": 0,
  "discount": 10.00,
  "started_at": "2026-02-11 14:00:00",
  "finished_at": "2026-02-11 16:00:00"
}
```

---

## 4. New Function: `updateBookingDiscount()`

### Purpose:
Update the discount for an active or pending booking before it ends. Useful for applying discounts during an open session.

### Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `booking_id` | int | Yes | The booking ID to update |
| `discount` | float | Yes | New discount amount (must be >= 0) |

### Behavior:
- **Scheduled Bookings**: Updates both `discount` and recalculates `price` immediately
- **Open Sessions**: Updates only `discount` (final price calculated at `endBooking`)
- Returns error if booking is already completed

### Usage:
```json
POST ?action=updateBookingDiscount
{
  "booking_id": 123,
  "discount": 15.00
}
```

### Response Example (Scheduled Booking):
```json
{
  "status": "success",
  "data": {
    "message": "Discount updated successfully",
    "booking_id": 123,
    "booking_type": "scheduled",
    "room_name": "Room 1",
    "old_discount": 0,
    "new_discount": 15,
    "scheduled_duration_hours": 2,
    "price_before_discount": 100,
    "total_price": 85
  }
}
```

### Response Example (Open Session):
```json
{
  "status": "success",
  "data": {
    "message": "Discount updated successfully",
    "booking_id": 124,
    "booking_type": "open_session",
    "room_name": "Room 2",
    "old_discount": 0,
    "new_discount": 20,
    "current_duration_hours": 1.5,
    "current_price_before_discount": 75,
    "estimated_price_with_discount": 55,
    "note": "Final price will be calculated when booking ends"
  }
}
```

---

## 5. New Function: `deleteOrderItems()`

### Purpose:
Delete a specific item from an order, restore the stock to inventory, and recalculate the order total.

### Parameters:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_item_id` | int | Yes | The order_items.id to delete |

### Behavior:
1. Finds the order item by ID
2. Restores the quantity back to `cafeteria_items.stock`
3. Deletes the order item record
4. If no items remain in the order, deletes the order itself
5. If items remain, recalculates `orders.price` (subtotal - discount)

### Usage:
```json
POST ?action=deleteOrderItems
{
  "order_item_id": 45
}
```

### Response Example (Items Remaining):
```json
{
  "status": "success",
  "data": {
    "message": "Order item deleted and stock restored.",
    "order_deleted": false,
    "stock_restored": 2,
    "new_order_subtotal": 75.00,
    "new_order_total": 70.00,
    "remaining_items": 3
  }
}
```

### Response Example (Order Deleted):
```json
{
  "status": "success",
  "data": {
    "message": "Order item deleted and stock restored. Order was also deleted as it had no remaining items.",
    "order_deleted": true,
    "stock_restored": 1
  }
}
```

---

## 6. Enhanced `getFullRoomAnalytics()` for Calendar View

### Changes Made:
Added `all_bookings` array to the response with complete booking data for calendar rendering.

### New Fields in Each Booking:
| Field | Description |
|-------|-------------|
| `booking_id` | Unique booking identifier |
| `room_id` | Room identifier |
| `customer_id` | Customer identifier (nullable) |
| `booking_date` | Date only (e.g., "2026-02-11") |
| `start_time` | Time only (e.g., "14:00:00") |
| `end_time` | Time only (e.g., "16:00:00") |
| `started_at` | Full datetime |
| `finished_at` | Full datetime (null for open sessions) |
| `room_name` | Room display name |
| `room_ps` | PlayStation version |
| `room_capacity` | Room capacity |
| `hour_cost` | Single player hourly rate |
| `multi_hour_cost` | Multi-player hourly rate |
| `customer_name` | Customer name (nullable) |
| `customer_phone` | Customer phone (nullable) |
| `price` | Final price |
| `discount` | Discount applied |
| `is_multi` | Multi-player flag (0/1) |
| `duration_minutes` | Duration in minutes |
| `duration_hours` | Duration in hours |
| `status` | 'active', 'completed', or 'pending' |

### Usage:
```json
POST ?action=getFullRoomAnalytics
{
  "start_date": "2026-02-01",
  "end_date": "2026-02-28"
}
```

### Response Structure:
```json
{
  "status": "success",
  "data": {
    "date_range": { "start_date": "2026-02-01", "end_date": "2026-02-28" },
    "summary": { ... },
    "room_performance": [ ... ],
    "daily_breakdown": [ ... ],
    "hourly_distribution": [ ... ],
    "day_of_week_analysis": [ ... ],
    "top_customers": [ ... ],
    "all_bookings": [
      {
        "booking_id": 1,
        "room_id": 1,
        "booking_date": "2026-02-11",
        "start_time": "14:00:00",
        "end_time": "16:00:00",
        "room_name": "Room 1",
        "customer_name": "John Doe",
        "price": 85.00,
        "status": "completed",
        ...
      }
    ]
  }
}
```

---

## Summary of Database Changes

Run these SQL statements to update your database schema:

```sql
-- Add multi_hour_cost to rooms table
ALTER TABLE rooms ADD COLUMN multi_hour_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Add is_multi and discount to room_booking table
ALTER TABLE room_booking ADD COLUMN is_multi TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE room_booking ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
```

---

## API Endpoints Reference

| Action | Method | Description |
|--------|--------|-------------|
| `addRoom` | POST | Add room with multi_hour_cost |
| `updateRoom` | POST | Update room with multi_hour_cost |
| `addBooking` | POST | Create booking with is_multi & discount |
| `endBooking` | POST | End booking (applies is_multi & discount) |
| `updateBookingDiscount` | POST | Update discount on active booking |
| `deleteOrderItems` | POST | Delete order item & restore stock |
| `getFullRoomAnalytics` | POST | Get analytics with all_bookings for calendar |
