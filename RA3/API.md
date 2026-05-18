# SS Maintenance API

**Base URL:** `https://Solarsector.net/api/maintenance/engineers-ap/`

All endpoints are invoked as:

```
POST {BASE}/proc.php?action=<action_name>
Content-Type: application/json
```

> `GET` is accepted for read-only actions that take their parameters from the query string (e.g. `get_request`, `get_requests`, `engineer_my_requests`). Anything that mutates state must be `POST`.

### Authentication

- After `admin_login` or `engineer_login`, the server sets an `HttpOnly` cookie named **`token`** and also returns the token in the JSON body.
- All subsequent requests must include this cookie (`credentials: 'include'` on the browser side), or you can pass the token yourself in a cookie header.
- Admin and engineer sessions live in separate tables, so the same cookie can only be either an admin or an engineer at a time.

### Response shape

Success:
```json
{ "success": true, "message": "...", "...": "payload fields" }
```

Failure:
```json
{ "success": false, "message": "وصف الخطأ" }
```

### Request statuses

`pending → price_offered → accepted → in_progress ↔ on_hold → completed`
plus terminal states `rejected` and `cancelled`.

---

## 1. Admin Authentication

| Action | Method | Auth | Body / Query |
|---|---|---|---|
| `admin_login` | POST | – | `{ email, password }` |
| `admin_logout` | POST | admin | – |
| `admin_me` | POST/GET | admin | – |

---

## 2. Engineer Authentication

| Action | Method | Auth | Body / Query |
|---|---|---|---|
| `engineer_login` | POST | – | `{ phone, password }` |
| `engineer_logout` | POST | engineer | – |
| `engineer_me` | POST/GET | engineer | – |

---

## 3. Geo Zones

| Action | Method | Auth | Body / Query |
|---|---|---|---|
| `get_geo_zones` | GET | admin **or** engineer | – |
| `create_geo_zone` | POST | admin | `{ name, description? }` |
| `update_geo_zone` | POST | admin | `{ id, name, description? }` |
| `delete_geo_zone` | POST | admin | `{ id }` (fails if used by an engineer or a request) |

---

## 4. Admins (super_admin only)

| Action | Method | Auth | Body / Query |
|---|---|---|---|
| `get_admins` | GET | super_admin | – |
| `create_admin` | POST | super_admin | `{ name, email, password, role? }` — `role`: `admin` (default) or `super_admin` |
| `update_admin` | POST | super_admin | `{ id, name?, email?, role?, password? }` |
| `toggle_admin_status` | POST | super_admin | `{ id }` (can't disable self) |

---

## 5. Engineers (admin)

| Action | Method | Auth | Body / Query |
|---|---|---|---|
| `get_engineers` | GET | admin | `?zone_id=&status=` — includes `active_requests` / `completed_requests` counts |
| `get_engineer` | GET | admin | `?id=` |
| `create_engineer` | POST | admin | `{ full_name, phone, password, geo_zone_id, experience_level?, id_card_url?, bio? }` |
| `update_engineer` | POST | admin | `{ id, full_name?, phone?, geo_zone_id?, experience_level?, id_card_url?, bio?, password? }` |
| `toggle_engineer_status` | POST | admin | `{ id }` |

---

## 6. Maintenance Requests — Admin

| Action | Method | Auth | Body / Query |
|---|---|---|---|
| `create_request` | POST | admin | `{ customer_name, customer_phone, full_address, geo_zone_id, summary, full_description? }` → status `pending` |
| `get_requests` | GET | admin | `?status=&zone_id=&engineer_id=&from=YYYY-MM-DD&to=YYYY-MM-DD` |
| `get_request` | GET | admin or assigned engineer | `?id=` — returns request + `activities` + `files` |
| `set_price_range` | POST | admin | `{ id, price_range_from, price_range_to, admin_notes? }` → status `price_offered` |
| `mark_request_accepted` | POST | admin | `{ id }` → auto-assigns engineer via **Round-Robin** (least active workload in matching `geo_zone_id`), status `accepted` |
| `mark_request_rejected` | POST | admin | `{ id, comment? }` → status `rejected` |
| `reassign_engineer` | POST | admin | `{ id, engineer_id? }` — omit `engineer_id` to re-run auto-assign; manual pick must be in the same zone |
| `cancel_request` | POST | admin | `{ id, comment? }` → status `cancelled` |
| `update_admin_notes` | POST | admin | `{ id, admin_notes }` |
| `add_request_file` | POST | admin | `{ request_id, file_type, url }` |
| `delete_request_file` | POST | admin | `{ id }` |

### Round-Robin assignment rule
On `mark_request_accepted` the server picks the active engineer in the request's `geo_zone_id` with the **lowest count of active requests** (statuses `accepted`, `in_progress`, `on_hold`), tie-broken by `engineer.id`.

---

## 7. Maintenance Requests — Engineer

| Action | Method | Auth | Body / Query |
|---|---|---|---|
| `engineer_my_requests` | GET | engineer | `?status=` — sorted by activity then date |
| `engineer_request_details` | GET | engineer | `?id=` — only requests assigned to caller |
| `engineer_update_status` | POST | engineer | `{ id, status, comment?, final_price? }` |
| `engineer_add_notes` | POST | engineer | `{ id, note }` (appended to `engineer_notes`) |

### Allowed status transitions (engineer)
| From | To |
|---|---|
| `accepted` | `in_progress`, `on_hold` |
| `in_progress` | `on_hold`, `completed` |
| `on_hold` | `in_progress` |

When moving to `completed`, `final_price` is required and must fall inside `[price_range_from, price_range_to]` (if a range was set).

---

## 8. Dashboards & Logs

| Action | Method | Auth | Query |
|---|---|---|---|
| `admin_dashboard` | GET | admin | – |
| `engineer_dashboard` | GET | engineer | – |
| `get_admin_logs` | GET | super_admin | `?limit=` (1–1000, default 100) |
| `get_engineer_logs` | GET | admin | `?engineer_id=&limit=` |

### `admin_dashboard` payload
```jsonc
{
  "requests":  { "pending": n, "price_offered": n, "accepted": n,
                 "in_progress": n, "on_hold": n, "completed": n,
                 "rejected": n, "cancelled": n, "total": n },
  "engineers": { "total": n, "active": n },
  "revenue":   { "total_revenue": n, "completed_count": n },
  "recent":    [ { "id", "customer_name", "status", "created_at", "zone_name" } ]
}
```

### `engineer_dashboard` payload
```jsonc
{
  "engineer": { ...profile },
  "counts":   { "new_assigned": n, "in_progress": n, "on_hold": n,
                "completed": n, "total": n },
  "revenue":  { "total_revenue": n },
  "recent":   [ { "id", "customer_name", "status", "created_at", "summary" } ]
}
```

---

## 9. HTTP status codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Validation error / bad input |
| 401 | Not authenticated / session expired |
| 403 | Authenticated but lacks role |
| 404 | Resource or action not found |
| 500 | Database error |

---

## 10. Quick examples

### Admin login (browser, with credentials)
```js
await fetch('https://Solarsector.net/api/maintenance/engineers-ap/proc.php?action=admin_login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@site.com', password: 'secret' }),
});
```

### Set price and accept
```js
// 1. Admin sets price
await api('set_price_range', { id: 12, price_range_from: 200, price_range_to: 350 });

// 2. Customer accepts → auto-assign engineer
await api('mark_request_accepted', { id: 12 });
```

### Engineer completes a request
```js
await api('engineer_update_status', {
  id: 12,
  status: 'completed',
  final_price: 300,
  comment: 'تم إصلاح اللوحة الكهربائية'
});
```
