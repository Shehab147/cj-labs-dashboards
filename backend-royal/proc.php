<?php
require_once 'new/config.php';
/*
 * Royal Doughnuts Restaurant Backend
 * نظام إدارة مطعم رويال دونتس
 * اللغة: العربية
 *
 * جميع الطلبات ترسل بطريقة POST إلى هذا الملف
 * مع معامل "action" في الرابط يحدد نوع العملية
 * والبيانات ترسل في جسم الطلب بصيغة JSON
 * مثال: POST /processor.php?action=login  {"username":"admin","password":"123"}
 *
 * الأدوار:
 *   1 = cashier  (كاشير)
 *   2 = kitchen  (مطبخ)
 *   3 = super_admin (مدير عام)
 */
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '', // IMPORTANT (leave empty unless needed)
    'secure' => true, // REQUIRED for HTTPS
    'httponly' => true,
    'samesite' => 'None' // 🔥 THIS is the key
]);

session_start();
header('Content-Type: application/json; charset=utf-8');

// CORS: allow credentials (cookies) from the frontend origin
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed_origins = ['http://localhost:3000', 'https://localhost:3000'];
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
} else {
    header('Access-Control-Allow-Origin: http://localhost:3000');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function respond(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ok($payload = [], string $msg = ''): void
{
    $out = ['success' => true];
    if ($msg !== '') $out['message'] = $msg;
    if (!empty($payload)) $out = array_merge($out, (array)$payload);
    respond($out);
}

function fail(string $msg, int $code = 400): void
{
    respond(['success' => false, 'message' => $msg], $code);
}

function input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function str_val(array $data, string $key, string $default = ''): string
{
    return isset($data[$key]) ? trim((string)$data[$key]) : $default;
}

function num_val(array $data, string $key, $default = null)
{
    if (!isset($data[$key])) return $default;
    return is_numeric($data[$key]) ? $data[$key] + 0 : $default;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function auth(): array
{
    if (empty($_SESSION['user'])) fail('يجب تسجيل الدخول أولاً', 401);
    return $_SESSION['user'];
}

function role(array $allowed): array
{
    $u = auth();
    if (!in_array($u['role'], $allowed, true)) fail('ليس لديك صلاحية لهذا الإجراء', 403);
    return $u;
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function q(string $sql, array $params = []): mysqli_stmt
{
    global $conn;
    $stmt = $conn->prepare($sql);
    if (!$stmt) fail('خطأ في قاعدة البيانات: ' . $conn->error, 500);
    if ($params) {
        $types = '';
        foreach ($params as $p) {
            if ($p === null)       $types .= 's';
            elseif (is_int($p))    $types .= 'i';
            elseif (is_float($p))  $types .= 'd';
            else                   $types .= 's';
        }
        $stmt->bind_param($types, ...$params);
    }
    if (!$stmt->execute()) fail('خطأ في تنفيذ الاستعلام: ' . $stmt->error, 500);
    return $stmt;
}

function rows(string $sql, array $params = []): array
{
    $stmt = q($sql, $params);
    $res  = $stmt->get_result();
    $out  = [];
    while ($row = $res->fetch_assoc()) $out[] = $row;
    $stmt->close();
    return $out;
}

function row(string $sql, array $params = []): ?array
{
    $stmt = q($sql, $params);
    $res  = $stmt->get_result();
    $row  = $res->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function db_insert(string $sql, array $params = []): int
{
    global $conn;
    q($sql, $params);
    return (int)$conn->insert_id;
}

function exec_q(string $sql, array $params = []): int
{
    global $conn;
    q($sql, $params);
    return (int)$conn->affected_rows;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

$action = $_GET['action'] ?? '';

switch ($action) {

    // =======================================================================
    // AUTH
    // =======================================================================

    case 'login':
        $d        = input();
        $username = str_val($d, 'username');
        $password = str_val($d, 'password');
        if (!$username || !$password) fail('اسم المستخدم وكلمة المرور مطلوبان');

        $u = row(
            'SELECT u.id, u.full_name, u.username, u.password_hash, u.is_active, r.name AS role
             FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.username = ?',
            [$username]
        );

        if (!$u || !password_verify($password, $u['password_hash'])) {
            fail('اسم المستخدم أو كلمة المرور غير صحيحة');
        }
        if (!$u['is_active']) fail('هذا الحساب معطل، تواصل مع المدير');

        $_SESSION['user'] = [
            'id'        => (int)$u['id'],
            'full_name' => $u['full_name'],
            'username'  => $u['username'],
            'role'      => $u['role'],
        ];
        ok(['user' => $_SESSION['user']], 'تم تسجيل الدخول بنجاح');
        break;

    case 'logout':
        auth();
        session_destroy();
        ok([], 'تم تسجيل الخروج');
        break;

    case 'get_profile':
        ok(['user' => auth()]);
        break;

    // =======================================================================
    // CASHIER SHIFTS
    // =======================================================================

    case 'start_cashier_shift':
        $u = role(['cashier', 'super_admin']);
        $d = input();

        $open = row('SELECT id FROM cashier_shifts WHERE user_id = ? AND status = "open"', [$u['id']]);
        if ($open) fail('لديك وردية مفتوحة بالفعل، أغلقها أولاً');

        $id = db_insert(
            'INSERT INTO cashier_shifts (user_id, opening_cash, notes, status) VALUES (?,?,?,"open")',
            [$u['id'], (float)num_val($d, 'opening_cash', 0), str_val($d, 'notes')]
        );
        ok(['shift' => row('SELECT * FROM cashier_shifts WHERE id = ?', [$id])], 'تم بدء الوردية بنجاح');
        break;

    case 'end_cashier_shift':
        $u = role(['cashier', 'super_admin']);
        $d = input();

        $shift = row('SELECT * FROM cashier_shifts WHERE user_id = ? AND status = "open"', [$u['id']]);
        if (!$shift) fail('لا توجد وردية مفتوحة');

        $closing_cash = num_val($d, 'closing_cash');
        if ($closing_cash === null) fail('يجب إدخال النقد الختامي');

        $revenue = row(
            'SELECT COALESCE(SUM(total),0) AS rev FROM orders
             WHERE cashier_shift_id = ? AND payment_method = "cash"
               AND payment_status IN ("paid","partially_refunded") AND order_status != "cancelled"',
            [(int)$shift['id']]
        );
        $expected = (float)$shift['opening_cash'] + (float)$revenue['rev'];
        $diff     = (float)$closing_cash - $expected;

        exec_q(
            'UPDATE cashier_shifts SET status="closed", ended_at=NOW(), closing_cash=?, expected_cash=?, cash_difference=?, notes=? WHERE id=?',
            [(float)$closing_cash, $expected, $diff, str_val($d, 'notes'), (int)$shift['id']]
        );
        ok(['shift' => row('SELECT * FROM v_cashier_shift_summary WHERE shift_id = ?', [(int)$shift['id']])], 'تم إغلاق الوردية بنجاح');
        break;

    case 'get_my_shift':
        $u     = role(['cashier', 'super_admin']);
        $shift = row(
            'SELECT cs.*, u.full_name AS cashier_name FROM cashier_shifts cs
             JOIN users u ON u.id = cs.user_id
             WHERE cs.user_id = ? AND cs.status = "open"',
            [$u['id']]
        );
        ok(['shift' => $shift]);
        break;

    // =======================================================================
    // KITCHEN SHIFTS
    // =======================================================================

    case 'start_kitchen_shift':
        $u = role(['kitchen', 'super_admin']);
        $d = input();

        $open = row('SELECT id FROM kitchen_shifts WHERE user_id = ? AND status = "open"', [$u['id']]);
        if ($open) fail('لديك وردية مفتوحة بالفعل، أغلقها أولاً');

        $shift_id = db_insert(
            'INSERT INTO kitchen_shifts (user_id, notes, status) VALUES (?,?,"open")',
            [$u['id'], str_val($d, 'notes')]
        );

        $items = rows('SELECT id, current_qty FROM stock_items WHERE is_active = 1');
        foreach ($items as $item) {
            db_insert(
                'INSERT INTO kitchen_shift_stock_snapshot (kitchen_shift_id, stock_item_id, moment, qty) VALUES (?,?,?,?)',
                [$shift_id, (int)$item['id'], 'opening', (float)$item['current_qty']]
            );
        }

        ok([
            'shift'                 => row('SELECT * FROM kitchen_shifts WHERE id = ?', [$shift_id]),
            'stock_snapshot_items'  => count($items),
        ], 'تم بدء وردية المطبخ بنجاح');
        break;

    case 'end_kitchen_shift':
        $u = role(['kitchen', 'super_admin']);
        $d = input();

        $shift = row('SELECT * FROM kitchen_shifts WHERE user_id = ? AND status = "open"', [$u['id']]);
        if (!$shift) fail('لا توجد وردية مفتوحة');

        $closing = $d['closing_stock'] ?? [];
        if (empty($closing)) fail('يجب إدخال مخزون الإغلاق');

        global $conn;
        $conn->begin_transaction();
        try {
            foreach ($closing as $entry) {
                $item_id = (int)($entry['stock_item_id'] ?? 0);
                $qty     = (float)($entry['qty'] ?? 0);
                if (!$item_id) continue;

                $exists = row(
                    'SELECT id FROM kitchen_shift_stock_snapshot WHERE kitchen_shift_id=? AND stock_item_id=? AND moment="closing"',
                    [(int)$shift['id'], $item_id]
                );
                if ($exists) {
                    exec_q('UPDATE kitchen_shift_stock_snapshot SET qty=? WHERE id=?', [$qty, (int)$exists['id']]);
                } else {
                    db_insert(
                        'INSERT INTO kitchen_shift_stock_snapshot (kitchen_shift_id, stock_item_id, moment, qty) VALUES (?,?,?,?)',
                        [(int)$shift['id'], $item_id, 'closing', $qty]
                    );
                }
            }
            exec_q(
                'UPDATE kitchen_shifts SET status="closed", ended_at=NOW(), notes=? WHERE id=?',
                [str_val($d, 'notes'), (int)$shift['id']]
            );
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            fail('حدث خطأ أثناء إغلاق الوردية: ' . $e->getMessage(), 500);
        }

        ok(['shift' => row('SELECT * FROM kitchen_shifts WHERE id = ?', [(int)$shift['id']])], 'تم إغلاق وردية المطبخ بنجاح');
        break;

    case 'get_my_kitchen_shift':
        $u     = role(['kitchen', 'super_admin']);
        $shift = row(
            'SELECT ks.*, u.full_name FROM kitchen_shifts ks
             JOIN users u ON u.id = ks.user_id WHERE ks.user_id = ? AND ks.status = "open"',
            [$u['id']]
        );
        if ($shift) {
            $shift['opening_snapshot'] = rows(
                'SELECT ksss.*, si.name, su.name AS unit
                 FROM kitchen_shift_stock_snapshot ksss
                 JOIN stock_items si ON si.id = ksss.stock_item_id
                 JOIN stock_units su ON su.id = si.unit_id
                 WHERE ksss.kitchen_shift_id = ? AND ksss.moment = "opening"',
                [(int)$shift['id']]
            );
        }
        ok(['shift' => $shift]);
        break;

    // =======================================================================
    // MENU  (read: all roles | write: super_admin)
    // =======================================================================

    case 'get_menu':
        auth();
        $active_only = ($_GET['active'] ?? '1') === '1';
        $where_item  = $active_only ? 'AND mi.is_active = 1 AND mi.is_available = 1' : '';
        $where_cat   = $active_only ? 'WHERE mc.is_active = 1' : '';
        $items       = rows(
            "SELECT mi.*, mc.name AS category_name
             FROM menu_items mi JOIN menu_categories mc ON mc.id = mi.category_id
             $where_cat $where_item
             ORDER BY mc.sort_order, mi.name"
        );
        ok(['items' => $items]);
        break;

    case 'get_menu_categories':
        auth();
        ok(['categories' => rows('SELECT * FROM menu_categories ORDER BY sort_order')]);
        break;

    case 'get_menu_item':
        auth();
        $id   = (int)($_GET['id'] ?? 0);
        if (!$id) fail('معرّف الصنف مطلوب');
        $item = row(
            'SELECT mi.*, mc.name AS category_name FROM menu_items mi
             JOIN menu_categories mc ON mc.id = mi.category_id WHERE mi.id = ?',
            [$id]
        );
        if (!$item) fail('الصنف غير موجود', 404);
        $item['ingredients'] = rows(
            'SELECT mii.*, si.name AS stock_name, su.name AS unit
             FROM menu_item_ingredients mii
             JOIN stock_items si ON si.id = mii.stock_item_id
             JOIN stock_units su ON su.id = si.unit_id
             WHERE mii.menu_item_id = ?',
            [$id]
        );
        ok(['item' => $item]);
        break;

    case 'create_menu_category':
        role(['super_admin']);
        $d    = input();
        $name = str_val($d, 'name');
        if (!$name) fail('اسم التصنيف مطلوب');
        $id = db_insert(
            'INSERT INTO menu_categories (name, sort_order) VALUES (?,?)',
            [$name, (int)num_val($d, 'sort_order', 0)]
        );
        ok(['id' => $id], 'تم إضافة التصنيف');
        break;

    case 'create_menu_item':
        role(['super_admin']);
        $d           = input();
        $name        = str_val($d, 'name');
        $category_id = (int)num_val($d, 'category_id', 0);
        $price       = num_val($d, 'price', 0);
        if (!$name || !$category_id || !$price) fail('الاسم والتصنيف والسعر مطلوبة');

        $id = db_insert(
            'INSERT INTO menu_items (category_id, name, description, price, cost_estimate, prep_time_min, image_url)
             VALUES (?,?,?,?,?,?,?)',
            [
                $category_id,
                $name,
                str_val($d, 'description'),
                (float)$price,
                (float)num_val($d, 'cost_estimate', 0),
                num_val($d, 'prep_time_min') !== null ? (int)num_val($d, 'prep_time_min') : null,
                str_val($d, 'image_url'),
            ]
        );
        ok(['id' => $id], 'تم إضافة الصنف بنجاح');
        break;

    case 'update_menu_item':
        role(['super_admin']);
        $d  = input();
        $id = (int)num_val($d, 'id', 0);
        if (!$id) fail('معرّف الصنف مطلوب');
        if (!row('SELECT id FROM menu_items WHERE id = ?', [$id])) fail('الصنف غير موجود', 404);

        exec_q(
            'UPDATE menu_items SET category_id=?, name=?, description=?, price=?, cost_estimate=?, prep_time_min=?, image_url=? WHERE id=?',
            [
                (int)num_val($d, 'category_id'),
                str_val($d, 'name'),
                str_val($d, 'description'),
                (float)num_val($d, 'price'),
                (float)num_val($d, 'cost_estimate', 0),
                num_val($d, 'prep_time_min') !== null ? (int)num_val($d, 'prep_time_min') : null,
                str_val($d, 'image_url'),
                $id,
            ]
        );
        ok([], 'تم تحديث الصنف بنجاح');
        break;

    case 'toggle_menu_item_availability':
        role(['super_admin', 'kitchen']);
        $d  = input();
        $id = (int)num_val($d, 'id', 0);
        if (!$id) fail('معرّف الصنف مطلوب');
        exec_q('UPDATE menu_items SET is_available = NOT is_available WHERE id = ?', [$id]);
        ok(['item' => row('SELECT id, name, is_available FROM menu_items WHERE id = ?', [$id])]);
        break;

    case 'toggle_menu_item_active':
        role(['super_admin']);
        $d  = input();
        $id = (int)num_val($d, 'id', 0);
        if (!$id) fail('معرّف الصنف مطلوب');
        exec_q('UPDATE menu_items SET is_active = NOT is_active WHERE id = ?', [$id]);
        ok(['item' => row('SELECT id, name, is_active FROM menu_items WHERE id = ?', [$id])]);
        break;

    case 'set_menu_item_ingredients':
        role(['super_admin']);
        $d       = input();
        $item_id = (int)num_val($d, 'menu_item_id', 0);
        if (!$item_id) fail('معرّف الصنف مطلوب');
        $ingredients = $d['ingredients'] ?? [];

        global $conn;
        $conn->begin_transaction();
        try {
            exec_q('DELETE FROM menu_item_ingredients WHERE menu_item_id = ?', [$item_id]);
            foreach ($ingredients as $ing) {
                $stock_id = (int)($ing['stock_item_id'] ?? 0);
                $qty      = (float)($ing['qty_needed'] ?? 0);
                if (!$stock_id || $qty <= 0) continue;
                db_insert(
                    'INSERT INTO menu_item_ingredients (menu_item_id, stock_item_id, qty_needed) VALUES (?,?,?)',
                    [$item_id, $stock_id, $qty]
                );
            }
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            fail('خطأ في حفظ المكونات', 500);
        }
        ok([], 'تم حفظ مكونات الصنف');
        break;

    // =======================================================================
    // ORDERS – CASHIER
    // =======================================================================

    case 'place_order':
        $u = role(['cashier', 'super_admin']);
        $d = input();

        $shift = row('SELECT id FROM cashier_shifts WHERE user_id = ? AND status = "open"', [$u['id']]);
        if (!$shift) fail('لا توجد وردية مفتوحة، ابدأ وردية أولاً');

        $items_in = $d['items'] ?? [];
        if (empty($items_in)) fail('يجب إضافة صنف واحد على الأقل');

        // --- order type validation ---
        $order_type    = str_val($d, 'type') ?: 'onsite';
        $allowed_types = ['takeaway', 'onsite', 'delivery'];
        if (!in_array($order_type, $allowed_types, true))
            fail('نوع الطلب غير صالح، القيم المسموح بها: takeaway | onsite | delivery');

        $address       = str_val($d, 'address');
        $delivery_cost = (float)num_val($d, 'delivery_cost', 0);

        if ($order_type === 'delivery') {
            if ($address === '') fail('عنوان التوصيل مطلوب عند اختيار نوع الطلب "delivery"');
            if ($delivery_cost < 0) fail('تكلفة التوصيل يجب أن تكون صفراً أو أكثر');
        } else {
            // force-clear delivery fields for non-delivery orders
            $address       = '';
            $delivery_cost = 0.0;
        }

        global $conn;
        $conn->begin_transaction();
        try {
            $subtotal = 0.0;
            $resolved = [];

            foreach ($items_in as $entry) {
                $menu_id = (int)($entry['menu_item_id'] ?? 0);
                $qty     = max(1, (int)($entry['quantity'] ?? 1));
                if (!$menu_id) throw new Exception('معرّف الصنف غير صالح');

                $mi = row('SELECT id, name, price, is_available, is_active FROM menu_items WHERE id = ?', [$menu_id]);
                if (!$mi)                 throw new Exception("الصنف رقم {$menu_id} غير موجود");
                if (!$mi['is_active'])    throw new Exception("الصنف \"{$mi['name']}\" غير نشط");
                if (!$mi['is_available']) throw new Exception("الصنف \"{$mi['name']}\" غير متاح حالياً");

                $line      = round((float)$mi['price'] * $qty, 2);
                $subtotal += $line;
                $resolved[] = [
                    'menu_item_id'    => $menu_id,
                    'item_name'       => $mi['name'],
                    'unit_price'      => (float)$mi['price'],
                    'quantity'        => $qty,
                    'line_total'      => $line,
                    'special_request' => trim($entry['special_request'] ?? ''),
                ];
            }

            $discount = min((float)num_val($d, 'discount_amount', 0), $subtotal);
            $tax      = (float)num_val($d, 'tax_amount', 0);
            // delivery_cost is added on top of the order total
            $total    = round($subtotal - $discount + $tax + $delivery_cost, 2);

            $order_num = $conn->query('SELECT generate_order_number() AS n')->fetch_assoc()['n'];

            $order_id = db_insert(
                'INSERT INTO orders
                 (order_number, cashier_shift_id, cashier_id, customer_name, customer_phone,
                  subtotal, discount_amount, tax_amount, total,
                  payment_method, payment_status, order_status, estimated_pickup, notes,
                  type, address, delivery_cost)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [
                    $order_num,
                    (int)$shift['id'],
                    $u['id'],
                    str_val($d, 'customer_name'),
                    str_val($d, 'customer_phone'),
                    $subtotal,
                    $discount,
                    $tax,
                    $total,
                    str_val($d, 'payment_method') ?: 'cash',
                    str_val($d, 'payment_status') ?: 'pending',
                    'pending',
                    str_val($d, 'estimated_pickup') ?: null,
                    str_val($d, 'notes'),
                    $order_type,
                    $address,
                    $delivery_cost,
                ]
            );

            foreach ($resolved as $ri) {
                db_insert(
                    'INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total, special_request)
                     VALUES (?,?,?,?,?,?,?)',
                    [$order_id, $ri['menu_item_id'], $ri['item_name'], $ri['unit_price'], $ri['quantity'], $ri['line_total'], $ri['special_request']]
                );
            }

            db_insert(
                'INSERT INTO order_status_log (order_id, old_status, new_status, changed_by) VALUES (?,NULL,?,?)',
                [$order_id, 'pending', $u['id']]
            );

            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            fail('حدث خطأ أثناء إنشاء الطلب: ' . $e->getMessage(), 500);
        }

        $order          = row('SELECT * FROM orders WHERE id = ?', [$order_id]);
        $order['items'] = rows('SELECT * FROM order_items WHERE order_id = ?', [$order_id]);
        ok(['order' => $order], 'تم إنشاء الطلب بنجاح');
        break;

    // Edit order type/address/delivery cost on an existing order
    case 'update_order_type':
        $u  = role(['cashier', 'super_admin']);
        $d  = input();
        $id = (int)num_val($d, 'order_id', 0);
        if (!$id) fail('معرّف الطلب مطلوب');

        $order = row('SELECT id, order_status, type FROM orders WHERE id = ?', [$id]);
        if (!$order) fail('الطلب غير موجود', 404);
        if (in_array($order['order_status'], ['picked_up', 'cancelled']))
            fail('لا يمكن تعديل طلب مكتمل أو ملغى');

        $order_type    = str_val($d, 'type') ?: $order['type'];
        $allowed_types = ['takeaway', 'onsite', 'delivery'];
        if (!in_array($order_type, $allowed_types, true))
            fail('نوع الطلب غير صالح، القيم المسموح بها: takeaway | onsite | delivery');

        $address       = str_val($d, 'address');
        $delivery_cost = (float)num_val($d, 'delivery_cost', 0);

        if ($order_type === 'delivery') {
            if ($address === '') fail('عنوان التوصيل مطلوب عند اختيار نوع الطلب "delivery"');
            if ($delivery_cost < 0) fail('تكلفة التوصيل يجب أن تكون صفراً أو أكثر');
        } else {
            $address       = '';
            $delivery_cost = 0.0;
        }

        // recalculate total with the new delivery cost
        $base = row('SELECT subtotal, discount_amount, tax_amount FROM orders WHERE id = ?', [$id]);
        $new_total = round(
            (float)$base['subtotal'] - (float)$base['discount_amount'] + (float)$base['tax_amount'] + $delivery_cost,
            2
        );

        exec_q(
            'UPDATE orders SET type=?, address=?, delivery_cost=?, total=? WHERE id=?',
            [$order_type, $address, $delivery_cost, $new_total, $id]
        );
        ok([
            'order' => row('SELECT id, order_number, type, address, delivery_cost, total FROM orders WHERE id = ?', [$id])
        ], 'تم تحديث نوع الطلب بنجاح');
        break;

    case 'get_orders':
        $u = role(['cashier', 'super_admin']);

        if ($u['role'] === 'cashier') {
            $shift    = row('SELECT id FROM cashier_shifts WHERE user_id = ? AND status = "open"', [$u['id']]);
            $shift_id = $shift ? (int)$shift['id'] : 0;
        } else {
            $shift_id = (int)($_GET['shift_id'] ?? 0);
        }

        $status = $_GET['status'] ?? '';
        $sql    = 'SELECT o.*, u.full_name AS cashier_name FROM orders o JOIN users u ON u.id = o.cashier_id WHERE 1=1';
        $params = [];

        if ($shift_id) { $sql .= ' AND o.cashier_shift_id = ?'; $params[] = $shift_id; }
        if ($status)   { $sql .= ' AND o.order_status = ?';     $params[] = $status; }
        $sql .= ' ORDER BY o.created_at DESC';

        ok(['orders' => rows($sql, $params)]);
        break;

    case 'get_order':
        auth();
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) fail('معرّف الطلب مطلوب');
        $order = row(
            'SELECT o.*, u.full_name AS cashier_name FROM orders o JOIN users u ON u.id = o.cashier_id WHERE o.id = ?',
            [$id]
        );
        if (!$order) fail('الطلب غير موجود', 404);
        $order['items']      = rows('SELECT * FROM order_items WHERE order_id = ?', [$id]);
        $order['status_log'] = rows(
            'SELECT osl.*, u.full_name AS changed_by_name FROM order_status_log osl
             JOIN users u ON u.id = osl.changed_by WHERE osl.order_id = ? ORDER BY osl.created_at',
            [$id]
        );
        ok(['order' => $order]);
        break;

    case 'update_order_payment':
        $u = role(['cashier', 'super_admin']);
        $d = input();
        $id = (int)num_val($d, 'order_id', 0);
        if (!$id) fail('معرّف الطلب مطلوب');
        if (!row('SELECT id FROM orders WHERE id = ?', [$id])) fail('الطلب غير موجود', 404);

        $new_status = str_val($d, 'payment_status');
        if (!in_array($new_status, ['pending', 'paid', 'refunded', 'partially_refunded'])) fail('حالة دفع غير صالحة');

        $method = str_val($d, 'payment_method');
        $sql    = 'UPDATE orders SET payment_status = ?';
        $params = [$new_status];
        if ($method && in_array($method, ['cash', 'card', 'online', 'other'])) {
            $sql .= ', payment_method = ?'; $params[] = $method;
        }
        $sql .= ' WHERE id = ?'; $params[] = $id;
        exec_q($sql, $params);
        ok([], 'تم تحديث حالة الدفع');
        break;

    case 'cancel_order':
        $u = role(['cashier', 'super_admin']);
        $d = input();
        $id = (int)num_val($d, 'order_id', 0);
        if (!$id) fail('معرّف الطلب مطلوب');
        $order = row('SELECT id, order_status FROM orders WHERE id = ?', [$id]);
        if (!$order) fail('الطلب غير موجود', 404);
        if ($order['order_status'] === 'cancelled') fail('الطلب ملغى بالفعل');
        if ($order['order_status'] === 'picked_up') fail('لا يمكن إلغاء طلب تم استلامه');

        $old = $order['order_status'];
        exec_q('UPDATE orders SET order_status="cancelled", payment_status="refunded" WHERE id=?', [$id]);
        db_insert(
            'INSERT INTO order_status_log (order_id, old_status, new_status, changed_by) VALUES (?,?,?,?)',
            [$id, $old, 'cancelled', $u['id']]
        );
        ok([], 'تم إلغاء الطلب');
        break;

    // =======================================================================
    // ORDERS – KITCHEN
    // =======================================================================

    case 'get_active_orders':
        role(['kitchen', 'super_admin', 'cashier']);
        $statuses_raw = explode(',', $_GET['statuses'] ?? 'pending,preparing');
        $allowed_st   = ['pending', 'preparing', 'ready'];
        $statuses     = array_values(array_filter($statuses_raw, function($s) use ($allowed_st) {
            return in_array(trim($s), $allowed_st, true);
        }));
        if (empty($statuses)) fail('حالات الطلبات غير صالحة');

        $placeholders = implode(',', array_fill(0, count($statuses), '?'));
        $orders = rows(
            "SELECT o.*, u.full_name AS cashier_name FROM orders o JOIN users u ON u.id = o.cashier_id
             WHERE o.order_status IN ($placeholders) ORDER BY o.created_at ASC",
            $statuses
        );
        foreach ($orders as &$o) {
            $o['items'] = rows('SELECT * FROM order_items WHERE order_id = ?', [(int)$o['id']]);
        }
        ok(['orders' => $orders]);
        break;

    case 'update_order_status':
        $u = role(['kitchen', 'super_admin', 'cashier']);
        $d = input();
        $id = (int)num_val($d, 'order_id', 0);
        if (!$id) fail('معرّف الطلب مطلوب');

        $order = row('SELECT id, order_status FROM orders WHERE id = ?', [$id]);
        if (!$order) fail('الطلب غير موجود', 404);

        $new_status = str_val($d, 'order_status');
        if (!in_array($new_status, ['preparing', 'ready', 'picked_up', 'cancelled'])) fail('حالة غير صالحة');

        $flow = ['pending' => 0, 'preparing' => 1, 'ready' => 2, 'picked_up' => 3, 'cancelled' => 99];
        if ($new_status !== 'cancelled' && ($flow[$new_status] ?? -1) <= ($flow[$order['order_status']] ?? -1)) {
            fail("لا يمكن الانتقال من \"{$order['order_status']}\" إلى \"{$new_status}\"");
        }

        $old = $order['order_status'];

        global $conn;
        $conn->begin_transaction();
        try {
            $payment_extra = ($new_status === 'picked_up') ? ', payment_status="paid"' : '';
            exec_q("UPDATE orders SET order_status = ? {$payment_extra} WHERE id = ?", [$new_status, $id]);

            // deduct stock when kitchen starts preparing
            if ($new_status === 'preparing') {
                $kshift   = row('SELECT id FROM kitchen_shifts WHERE user_id = ? AND status = "open"', [$u['id']]);
                $oi_rows  = rows('SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?', [$id]);
                foreach ($oi_rows as $oi) {
                    $ings = rows(
                        'SELECT stock_item_id, qty_needed FROM menu_item_ingredients WHERE menu_item_id = ?',
                        [(int)$oi['menu_item_id']]
                    );
                    foreach ($ings as $ing) {
                        $deduct  = (float)$ing['qty_needed'] * (int)$oi['quantity'];
                        $current = (float)row('SELECT current_qty FROM stock_items WHERE id = ?', [(int)$ing['stock_item_id']])['current_qty'];
                        $new_qty = max(0, $current - $deduct);
                        exec_q('UPDATE stock_items SET current_qty = ? WHERE id = ?', [$new_qty, (int)$ing['stock_item_id']]);
                        db_insert(
                            'INSERT INTO stock_transactions (stock_item_id, user_id, kitchen_shift_id, type, qty_change, qty_after, reference_note)
                             VALUES (?,?,?,?,?,?,?)',
                            [
                                (int)$ing['stock_item_id'],
                                $u['id'],
                                $kshift ? (int)$kshift['id'] : null,
                                'usage',
                                -$deduct,
                                $new_qty,
                                "طلب رقم #{$id}",
                            ]
                        );
                    }
                }
            }

            db_insert(
                'INSERT INTO order_status_log (order_id, old_status, new_status, changed_by) VALUES (?,?,?,?)',
                [$id, $old, $new_status, $u['id']]
            );
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            fail('حدث خطأ: ' . $e->getMessage(), 500);
        }

        ok([], 'تم تحديث حالة الطلب');
        break;

    // =======================================================================
    // STOCK – KITCHEN & ADMIN
    // =======================================================================

    case 'get_stock':
        role(['kitchen', 'super_admin']);
        ok(['items' => rows(
            'SELECT si.*, su.name AS unit FROM stock_items si JOIN stock_units su ON su.id = si.unit_id
             WHERE si.is_active = 1 ORDER BY si.name'
        )]);
        break;

    case 'get_all_stock':
        role(['super_admin']);
        ok(['items' => rows(
            'SELECT si.*, su.name AS unit FROM stock_items si JOIN stock_units su ON su.id = si.unit_id ORDER BY si.name'
        )]);
        break;

    case 'get_low_stock':
        role(['kitchen', 'super_admin']);
        ok(['items' => rows('SELECT * FROM v_low_stock ORDER BY name')]);
        break;

    case 'get_stock_units':
        auth();
        ok(['units' => rows('SELECT * FROM stock_units ORDER BY name')]);
        break;

    case 'create_stock_item':
        role(['super_admin']);
        $d       = input();
        $name    = str_val($d, 'name');
        $unit_id = (int)num_val($d, 'unit_id', 0);
        if (!$name || !$unit_id) fail('الاسم والوحدة مطلوبان');
        $id = db_insert(
            'INSERT INTO stock_items (name, unit_id, current_qty, min_qty, cost_per_unit) VALUES (?,?,?,?,?)',
            [$name, $unit_id, (float)num_val($d, 'current_qty', 0), (float)num_val($d, 'min_qty', 0), (float)num_val($d, 'cost_per_unit', 0)]
        );
        ok(['id' => $id], 'تم إضافة الصنف');
        break;

    case 'update_stock_item':
        role(['super_admin']);
        $d  = input();
        $id = (int)num_val($d, 'id', 0);
        if (!$id) fail('معرّف الصنف مطلوب');
        exec_q(
            'UPDATE stock_items SET name=?, unit_id=?, min_qty=?, cost_per_unit=? WHERE id=?',
            [str_val($d, 'name'), (int)num_val($d, 'unit_id'), (float)num_val($d, 'min_qty', 0), (float)num_val($d, 'cost_per_unit', 0), $id]
        );
        ok([], 'تم تحديث الصنف');
        break;

    case 'toggle_stock_item':
        role(['super_admin']);
        $d  = input();
        $id = (int)num_val($d, 'id', 0);
        if (!$id) fail('معرّف الصنف مطلوب');
        exec_q('UPDATE stock_items SET is_active = NOT is_active WHERE id = ?', [$id]);
        ok(['item' => row('SELECT id, name, is_active FROM stock_items WHERE id = ?', [$id])]);
        break;

    case 'add_stock_transaction':
        $u = role(['kitchen', 'super_admin']);
        $d = input();

        $stock_id = (int)num_val($d, 'stock_item_id', 0);
        $type     = str_val($d, 'type');
        $qty      = (float)num_val($d, 'qty', 0);

        if (!$stock_id) fail('معرّف الصنف مطلوب');
        if (!in_array($type, ['purchase', 'waste', 'adjustment'])) fail('نوع العملية غير صالح (purchase | waste | adjustment)');
        if ($qty == 0) fail('الكمية يجب أن تكون مختلفة عن صفر');

        global $conn;
        $conn->begin_transaction();
        try {
            $stock = row('SELECT id, current_qty FROM stock_items WHERE id = ? AND is_active = 1', [$stock_id]);
            if (!$stock) throw new Exception('صنف المخزون غير موجود');

            $change  = ($type === 'purchase') ? abs($qty) : (($type === 'waste') ? -abs($qty) : $qty);
            $new_qty = max(0, (float)$stock['current_qty'] + $change);

            exec_q('UPDATE stock_items SET current_qty = ? WHERE id = ?', [$new_qty, $stock_id]);

            $kshift = row('SELECT id FROM kitchen_shifts WHERE user_id = ? AND status = "open"', [$u['id']]);
            db_insert(
                'INSERT INTO stock_transactions (stock_item_id, user_id, kitchen_shift_id, type, qty_change, qty_after, unit_cost, reference_note)
                 VALUES (?,?,?,?,?,?,?,?)',
                [
                    $stock_id,
                    $u['id'],
                    $kshift ? (int)$kshift['id'] : null,
                    $type,
                    $change,
                    $new_qty,
                    num_val($d, 'unit_cost') !== null ? (float)num_val($d, 'unit_cost') : null,
                    str_val($d, 'reference_note'),
                ]
            );
            $conn->commit();
        } catch (Exception $e) {
            $conn->rollback();
            fail('خطأ: ' . $e->getMessage(), 500);
        }

        ok([
            'item' => row('SELECT si.*, su.name AS unit FROM stock_items si JOIN stock_units su ON su.id = si.unit_id WHERE si.id = ?', [$stock_id])
        ], 'تم تسجيل العملية');
        break;

    case 'get_stock_transactions':
        role(['kitchen', 'super_admin']);
        $item_id = (int)($_GET['stock_item_id'] ?? 0);
        $type    = $_GET['type'] ?? '';
        $sql     = 'SELECT st.*, si.name AS stock_name, su.name AS unit, u.full_name AS user_name
                    FROM stock_transactions st
                    JOIN stock_items si ON si.id = st.stock_item_id
                    JOIN stock_units su ON su.id = si.unit_id
                    JOIN users u ON u.id = st.user_id WHERE 1=1';
        $params  = [];
        if ($item_id) { $sql .= ' AND st.stock_item_id = ?'; $params[] = $item_id; }
        if ($type)    { $sql .= ' AND st.type = ?';          $params[] = $type; }
        $sql .= ' ORDER BY st.created_at DESC LIMIT 200';
        ok(['transactions' => rows($sql, $params)]);
        break;

    // =======================================================================
    // EXPENSES – ADMIN
    // =======================================================================

    case 'get_expense_categories':
        role(['super_admin']);
        ok(['categories' => rows('SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name')]);
        break;

    case 'get_expenses':
        role(['super_admin']);
        $from = $_GET['from'] ?? date('Y-m-01');
        $to   = $_GET['to']   ?? date('Y-m-d');
        ok(['expenses' => rows(
            'SELECT e.*, ec.name AS category_name, u.full_name AS recorded_by_name
             FROM expenses e
             JOIN expense_categories ec ON ec.id = e.category_id
             JOIN users u ON u.id = e.recorded_by
             WHERE e.expense_date BETWEEN ? AND ? ORDER BY e.expense_date DESC',
            [$from, $to]
        )]);
        break;

    case 'add_expense':
        $u = role(['super_admin']);
        $d = input();

        $cat_id = (int)num_val($d, 'category_id', 0);
        $amount = (float)num_val($d, 'amount', 0);
        $date   = str_val($d, 'expense_date') ?: date('Y-m-d');
        if (!$cat_id || $amount <= 0) fail('التصنيف والمبلغ مطلوبان');

        $id = db_insert(
            'INSERT INTO expenses (category_id, recorded_by, amount, description, expense_date, receipt_url) VALUES (?,?,?,?,?,?)',
            [$cat_id, $u['id'], $amount, str_val($d, 'description'), $date, str_val($d, 'receipt_url')]
        );
        ok(['id' => $id], 'تم تسجيل المصروف');
        break;

    case 'delete_expense':
        role(['super_admin']);
        $d  = input();
        $id = (int)num_val($d, 'id', 0);
        if (!$id) fail('معرّف المصروف مطلوب');
        exec_q('DELETE FROM expenses WHERE id = ?', [$id]);
        ok([], 'تم حذف المصروف');
        break;

    // =======================================================================
    // USERS – ADMIN
    // =======================================================================

    case 'get_users':
        role(['super_admin']);
        ok(['users' => rows(
            'SELECT u.id, u.full_name, u.username, u.phone, u.is_active, r.name AS role, u.created_at
             FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.full_name'
        )]);
        break;

    case 'create_user':
        role(['super_admin']);
        $d        = input();
        $username = str_val($d, 'username');
        $password = str_val($d, 'password');
        $name     = str_val($d, 'full_name');
        $role_id  = (int)num_val($d, 'role_id', 0);
        if (!$username || !$password || !$name || !$role_id) fail('جميع الحقول الأساسية مطلوبة');
        if (row('SELECT id FROM users WHERE username = ?', [$username])) fail('اسم المستخدم مستخدم بالفعل');

        $id = db_insert(
            'INSERT INTO users (role_id, full_name, username, password_hash, phone) VALUES (?,?,?,?,?)',
            [$role_id, $name, $username, password_hash($password, PASSWORD_BCRYPT), str_val($d, 'phone')]
        );
        ok(['id' => $id], 'تم إنشاء المستخدم');
        break;

    case 'update_user':
        role(['super_admin']);
        $d  = input();
        $id = (int)num_val($d, 'id', 0);
        if (!$id) fail('معرّف المستخدم مطلوب');

        $sql    = 'UPDATE users SET full_name=?, phone=?, role_id=?';
        $params = [str_val($d, 'full_name'), str_val($d, 'phone'), (int)num_val($d, 'role_id')];
        if (str_val($d, 'password')) {
            $sql .= ', password_hash=?';
            $params[] = password_hash(str_val($d, 'password'), PASSWORD_BCRYPT);
        }
        $sql .= ' WHERE id=?'; $params[] = $id;
        exec_q($sql, $params);
        ok([], 'تم تحديث المستخدم');
        break;

    case 'toggle_user_status':
        role(['super_admin']);
        $d  = input();
        $id = (int)num_val($d, 'id', 0);
        if (!$id) fail('معرّف المستخدم مطلوب');
        if ($id === auth()['id']) fail('لا يمكنك تعطيل حسابك الخاص');
        exec_q('UPDATE users SET is_active = NOT is_active WHERE id = ?', [$id]);
        ok(['user' => row('SELECT id, full_name, is_active FROM users WHERE id = ?', [$id])]);
        break;

    // =======================================================================
    // REPORTS & DASHBOARD – ADMIN
    // =======================================================================

    case 'get_dashboard':
        role(['super_admin']);
        $today = date('Y-m-d');
        $today_report = row('SELECT * FROM v_daily_profit WHERE report_date = ?', [$today]);
        if (!$today_report) {
            $today_report = row(
                'SELECT ? AS report_date,
                        COUNT(*) AS total_orders,
                        COALESCE(SUM(CASE WHEN order_status != "cancelled" THEN subtotal ELSE 0 END), 0) AS gross_income,
                        COALESCE(SUM(CASE WHEN order_status != "cancelled" THEN discount_amount ELSE 0 END), 0) AS total_discounts,
                        COALESCE(SUM(CASE WHEN order_status != "cancelled" THEN total ELSE 0 END), 0) AS net_income,
                        COALESCE(SUM(CASE WHEN order_status != "cancelled" THEN total ELSE 0 END), 0) AS net_profit,
                        COUNT(CASE WHEN order_status = "cancelled" THEN 1 END) AS cancelled_orders
                 FROM orders WHERE DATE(created_at) = ?',
                [$today, $today]
            );
        }
        // Today's expenses
        $expenses_row = row(
            'SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses WHERE expense_date = ?',
            [$today]
        );
        $today_report['total_expenses'] = $expenses_row['total_expenses'] ?? '0.00';

        ok([
            'today_report'        => $today_report,
            'low_stock_items'     => rows('SELECT * FROM v_low_stock ORDER BY name'),
            'open_cashier_shifts' => rows(
                'SELECT cs.*, u.full_name AS cashier_name FROM cashier_shifts cs JOIN users u ON u.id = cs.user_id WHERE cs.status = "open"'
            ),
            'open_kitchen_shifts' => rows(
                'SELECT ks.*, u.full_name FROM kitchen_shifts ks JOIN users u ON u.id = ks.user_id WHERE ks.status = "open"'
            ),
            'order_counts' => rows(
                'SELECT order_status, COUNT(*) AS cnt FROM orders WHERE order_status IN ("pending","preparing","ready") GROUP BY order_status'
            ),
        ]);
        break;

    case 'get_daily_report':
        role(['super_admin']);
        $from = $_GET['from'] ?? date('Y-m-d');
        $to   = $_GET['to']   ?? date('Y-m-d');
        ok(['report' => rows('SELECT * FROM v_daily_profit WHERE report_date BETWEEN ? AND ? ORDER BY report_date DESC', [$from, $to])]);
        break;

    case 'get_income_report':
        role(['super_admin']);
        $from = $_GET['from'] ?? date('Y-m-d');
        $to   = $_GET['to']   ?? date('Y-m-d');
        ok(['report' => rows('SELECT * FROM v_daily_income WHERE report_date BETWEEN ? AND ? ORDER BY report_date DESC', [$from, $to])]);
        break;

    case 'get_top_selling':
        role(['super_admin']);
        $limit = min(50, max(1, (int)($_GET['limit'] ?? 10)));
        $from  = $_GET['from'] ?? '';
        $to    = $_GET['to']   ?? '';
        if ($from && $to) {
            $data = rows(
                'SELECT oi.menu_item_id, oi.item_name,
                        SUM(oi.quantity) AS total_qty_sold,
                        SUM(oi.line_total) AS total_revenue,
                        COUNT(DISTINCT oi.order_id) AS order_appearances
                 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                 WHERE o.order_status != "cancelled" AND DATE(o.created_at) BETWEEN ? AND ?
                 GROUP BY oi.menu_item_id, oi.item_name
                 ORDER BY total_qty_sold DESC LIMIT ' . $limit,
                [$from, $to]
            );
        } else {
            $data = rows('SELECT * FROM v_top_selling_items LIMIT ' . $limit);
        }
        ok(['items' => $data]);
        break;

    case 'get_cashier_shifts':
        role(['super_admin']);
        $from = $_GET['from'] ?? date('Y-m-01');
        $to   = $_GET['to']   ?? date('Y-m-d');
        $uid  = (int)($_GET['user_id'] ?? 0);
        $sql  = 'SELECT vcs.* FROM v_cashier_shift_summary vcs WHERE DATE(vcs.started_at) BETWEEN ? AND ?';
        $p    = [$from, $to];
        if ($uid) {
            $sql .= ' AND vcs.shift_id IN (SELECT id FROM cashier_shifts WHERE user_id=?)';
            $p[] = $uid;
        }
        $sql .= ' ORDER BY vcs.started_at DESC';
        ok(['shifts' => rows($sql, $p)]);
        break;

    case 'get_kitchen_shifts':
        role(['super_admin']);
        $from = $_GET['from'] ?? date('Y-m-01');
        $to   = $_GET['to']   ?? date('Y-m-d');
        ok(['shifts' => rows(
            'SELECT ks.*, u.full_name FROM kitchen_shifts ks JOIN users u ON u.id = ks.user_id
             WHERE DATE(ks.started_at) BETWEEN ? AND ? ORDER BY ks.started_at DESC',
            [$from, $to]
        )]);
        break;

    case 'get_kitchen_shift_details':
        role(['super_admin', 'kitchen']);
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) fail('معرّف الوردية مطلوب');
        $shift = row('SELECT ks.*, u.full_name FROM kitchen_shifts ks JOIN users u ON u.id = ks.user_id WHERE ks.id = ?', [$id]);
        if (!$shift) fail('الوردية غير موجودة', 404);
        $shift['snapshots'] = rows(
            'SELECT ksss.*, si.name AS stock_name, su.name AS unit
             FROM kitchen_shift_stock_snapshot ksss
             JOIN stock_items si ON si.id = ksss.stock_item_id
             JOIN stock_units su ON su.id = si.unit_id
             WHERE ksss.kitchen_shift_id = ? ORDER BY ksss.moment, si.name',
            [$id]
        );
        ok(['shift' => $shift]);
        break;

    case 'get_all_orders':
        role(['super_admin', 'cashier']);
        $from   = $_GET['from']   ?? date('Y-m-d');
        $to     = $_GET['to']     ?? date('Y-m-d');
        $status = $_GET['status'] ?? '';
        $sql    = 'SELECT o.*, u.full_name AS cashier_name FROM orders o JOIN users u ON u.id = o.cashier_id
                   WHERE DATE(o.created_at) BETWEEN ? AND ?';
        $params = [$from, $to];
        if ($status) { $sql .= ' AND o.order_status = ?'; $params[] = $status; }
        $sql .= ' ORDER BY o.created_at DESC';
        ok(['orders' => rows($sql, $params)]);
        break;

    // =======================================================================
    // DEFAULT
    // =======================================================================

    default:
        fail("الإجراء \"{$action}\" غير معروف", 404);
        break;
}
