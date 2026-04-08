<?php
//this endpopoint url is http://royal-donuts.labs.cloudjet.org/proc.php
require_once 'config.php';
try {
    $action = isset($_GET['action']) ? $_GET['action'] : null;
    $allowedActions = [
        // Auth
        'login', 'logout', 'validateSession', 'getProfile',
        // Shifts
        'startShift', 'endShift', 'getCurrentShift', 'getMyShiftHistory', 'addShiftExpense', 'getShiftExpenses', 'getShiftSummary', 'deleteShiftExpense', 'getAllShifts', 'getShiftReport',
        // Payments
        'processPayment', 'getOrderPayments', 'getOrderReceipt',
        // Tables
        'getTables', 'addTable', 'updateTable', 'deleteTable', 'getAvailableTables', 'getTablesProfitByDate', 'getTableOrdersAnalysis', 'checkoutTableOrder', 'getTableOrderTime',
        // Users
        'addUser', 'getUsers', 'updateUser', 'deleteUser',
        // Kitchen
        'addKitchenLog', 'addkitchenlogs', 'getKitchenLogs', 'quickStockUpdate', 'getLowStockProducts', 'getKitchenDailySummary', 'getKitchenOrders',
        // Categories
        'getCategory', 'addCategory', 'updateCategory', 'deleteCategory',
        // Products
        'addProduct', 'updateProduct', 'deleteProduct', 'getProducts',
        // Refunds
        'addRefund', 'getRefunds',
        // Orders
        'createOrder', 'getOrders', 'getOrderById', 'updateOrder', 'deleteOrder', 'addOrderItem', 'updateOrderItem', 'deleteOrderItem', 'updateOrderStatus',
        // Reports & Analytics
        'getDailySalesReport', 'getSalesAnalytics', 'getTopProducts', 'getCategoryAnalytics', 'getCashierPerformance', 'getAdminDashboard', 'getEndOfDayReport', 'exportReport',
        // Inventory
        'adjustInventory', 'getInventoryAdjustments'
    ];
    if (!$action || !in_array($action, $allowedActions)) {
        respond('error', 'Invalid action specified.');
    }
    $action();
}
catch (Exception $e) {
    respond('error', $e->getMessage());
}
function login()
{
    global $conn;
    $input = requireParams(['email', 'password']);
    $email = $input['email'];
    $password = $input['password'];
    $stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
      respond(401, ['error' => 'Invalid email or password']);
    }
    $user = $result->fetch_assoc();
   $hashedpass = md5($password);
    if ($user['password'] !== $hashedpass) {
      respond(401, ['error' => 'Invalid email or password']);
    }
    // Generate a token
    $token = bin2hex(random_bytes(16));
    // Store the token in sessions table
    $expire_at = date('Y-m-d H:i:s', strtotime('+24 hours'));
    $created_at = date('Y-m-d H:i:s');
    $status = 'active';
    $stmt = $conn->prepare("INSERT INTO sessions (user_id, token, status, created_at, expire_at) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("issss", $user['id'], $token, $status, $created_at, $expire_at);
    $stmt->execute();
    
    // Return token and user data (without password)
    unset($user['password']);
    respond(200, ['token' => $token, 'admin' => $user]);
}
function logout()
{
    global $conn;
    $token = getToken();
    if (!$token) {
        respond(401, ['error' => 'No token provided']);
    }
    $userid = validateToken();
    if (!$userid) {
        respond(401, ['error' => 'Invalid token']);
    }
    // Auto-end shift if the user is a cashier with an open shift
    $stmt = $conn->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->bind_param("i", $userid);
    $stmt->execute();
    $userRow = $stmt->get_result()->fetch_assoc();
    if ($userRow && $userRow['role'] === 'cashier') {
        $stmt = $conn->prepare("SELECT id, opening_cash FROM cashier_shifts WHERE user_id = ? AND status = 'open'");
        $stmt->bind_param("i", $userid);
        $stmt->execute();
        $shiftResult = $stmt->get_result();
        if ($shiftResult->num_rows > 0) {
            $shift = $shiftResult->fetch_assoc();
            $input = json_decode(file_get_contents('php://input'), true);
            $closing_cash = isset($input['closing_cash']) ? (float)$input['closing_cash'] : 0.0;
            $notes = isset($input['notes']) ? $input['notes'] : null;
            closeShiftById($shift['id'], (float)$shift['opening_cash'], $closing_cash, $userid, $notes);
        }
    }
    // Invalidate the token
    $stmt = $conn->prepare("DELETE FROM sessions WHERE token = ? AND user_id = ?");
    $stmt->bind_param("si", $token, $userid);
    $stmt->execute();
    respond(200, ['message' => 'Logged out successfully']);
}

function validateSession()
{
    global $conn;
    $token = getToken();
    if (!$token) {
        respond(200, ['valid' => false]);
    }
    $userid = validateToken();
    if (!$userid) {
        respond(200, ['valid' => false]);
    }
    // Get user data
    $stmt = $conn->prepare("SELECT id, name, email, role FROM users WHERE id = ?");
    $stmt->bind_param("i", $userid);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond(200, ['valid' => false]);
    }
    $admin = $result->fetch_assoc();
    respond(200, ['valid' => true, 'admin' => $admin]);
}

function getProfile()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(401, ['error' => 'Unauthorized']);
    }
    respond(200, $admin);
}

//cashier_shifts functions

/**
 * Start a new shift
 * Required: opening_cash
 */
function startShift()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers can start shifts']);
    }
    
    // Check if user already has an open shift
    $stmt = $conn->prepare("SELECT id FROM cashier_shifts WHERE user_id = ? AND status = 'open'");
    $stmt->bind_param("i", $admin['id']);
    $stmt->execute();
    $existingShift = $stmt->get_result();
    if ($existingShift->num_rows > 0) {
        respond('error', 'You already have an open shift. Please close it first.');
    }
    
    $input = requireParams(['opening_cash']);
    $opening_cash = (float)$input['opening_cash'];
    $user_id = $admin['id'];
    
    if ($opening_cash < 0) {
        respond('error', 'Opening cash cannot be negative.');
    }
    
    $stmt = $conn->prepare("INSERT INTO cashier_shifts (user_id, opening_cash, expected_cash) VALUES (?, ?, ?)");
    $stmt->bind_param("idd", $user_id, $opening_cash, $opening_cash);
    
    if ($stmt->execute()) {
        $shift_id = $conn->insert_id;
        respond('success', [
            'message' => 'Shift started successfully.',
            'shift_id' => $shift_id,
            'opening_cash' => $opening_cash,
            'start_time' => date('Y-m-d H:i:s')
        ]);
    } else {
        respond('error', 'Failed to start shift.');
    }
}
// Helper: close a shift by ID and compute all summary fields
function closeShiftById($shift_id, $opening_cash, $closing_cash, $user_id, $notes = null)
{
    global $conn;
    // Total sales from non-cancelled orders in this shift
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(total), 0) AS total_sales
         FROM orders WHERE shift_id = ? AND status != 'cancelled'"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $total_sales = (float)$stmt->get_result()->fetch_assoc()['total_sales'];
    // Total cash payments for orders in this shift
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.shift_id = ? AND p.payment_method = 'cash'"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $total_cash_payments = (float)$stmt->get_result()->fetch_assoc()['total'];
    // Total card payments for orders in this shift
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.shift_id = ? AND p.payment_method = 'card'"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $total_card_payments = (float)$stmt->get_result()->fetch_assoc()['total'];
    // Total shift expenses
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(amount), 0) AS total
         FROM shift_expenses WHERE shift_id = ?"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $total_expenses = (float)$stmt->get_result()->fetch_assoc()['total'];
    // Derived fields
    $expected_cash = $opening_cash + $total_cash_payments - $total_expenses;
    $difference    = $closing_cash - $expected_cash;
    // Persist everything
    $stmt = $conn->prepare(
        "UPDATE cashier_shifts
         SET closing_cash = ?, status = 'closed', end_time = NOW(),
             total_sales = ?, total_cash_payments = ?, total_card_payments = ?,
             expected_cash = ?, difference = ?, notes = ?
         WHERE id = ?"
    );
    $stmt->bind_param("ddddddsi", $closing_cash, $total_sales, $total_cash_payments,
                                   $total_card_payments, $expected_cash, $difference, $notes, $shift_id);
    return $stmt->execute();
}

// shift_expenses functions
/**
 * Add an expense to current shift
 * Required: amount, reason
 */
function addShiftExpense()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers can add shift expenses']);
    }
    
    $input  = requireParams(['amount', 'reason']);
    $amount = (float)$input['amount'];
    $reason = $input['reason'];
    
    if ($amount <= 0) {
        respond('error', 'Amount must be greater than 0.');
    }
    
    // Find the cashier's active shift
    $stmt = $conn->prepare("SELECT id FROM cashier_shifts WHERE user_id = ? AND status = 'open'");
    $stmt->bind_param("i", $admin['id']);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'No active shift found. Please start a shift first.');
    }
    $shift_id = $result->fetch_assoc()['id'];
    
    $stmt = $conn->prepare("INSERT INTO shift_expenses (shift_id, amount, reason) VALUES (?, ?, ?)");
    $stmt->bind_param("ids", $shift_id, $amount, $reason);
    if ($stmt->execute()) {
        respond('success', [
            'message' => 'Expense added successfully.',
            'expense_id' => $conn->insert_id,
            'amount' => $amount,
            'reason' => $reason
        ]);
    } else {
        respond('error', 'Failed to add expense.');
    }
}

/**
 * Get expenses for current shift
 */
function getShiftExpenses()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers can view shift expenses']);
    }
    // Find the cashier's active shift
    $stmt = $conn->prepare("SELECT id FROM cashier_shifts WHERE user_id = ? AND status = 'open'");
    $stmt->bind_param("i", $admin['id']);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'No active shift found.');
    }
    $shift_id = $result->fetch_assoc()['id'];
    $stmt = $conn->prepare("SELECT id, amount, reason, created_at FROM shift_expenses WHERE shift_id = ? ORDER BY created_at ASC");
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $result   = $stmt->get_result();
    $expenses = [];
    $total = 0;
    while ($row = $result->fetch_assoc()) {
        $expenses[] = $row;
        $total += (float)$row['amount'];
    }
    respond('success', ['expenses' => $expenses, 'total' => $total, 'count' => count($expenses)]);
}

/**
 * Get shift history for the current user
 */
function getMyShiftHistory()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers can view their shift history']);
    }
    // Fetch all shifts for this cashier, newest first
    $stmt = $conn->prepare(
        "SELECT id, start_time, end_time, opening_cash, closing_cash,
                total_sales, total_cash_payments, total_card_payments,
                expected_cash, difference, status, notes
         FROM cashier_shifts WHERE user_id = ? ORDER BY start_time DESC"
    );
    $stmt->bind_param("i", $admin['id']);
    $stmt->execute();
    $result = $stmt->get_result();
    $shifts = [];
    while ($shift = $result->fetch_assoc()) {
        // Attach expenses for each shift
        $expStmt = $conn->prepare(
            "SELECT id, amount, reason, created_at FROM shift_expenses WHERE shift_id = ? ORDER BY created_at ASC"
        );
        $expStmt->bind_param("i", $shift['id']);
        $expStmt->execute();
        $expResult = $expStmt->get_result();
        $expenses  = [];
        while ($row = $expResult->fetch_assoc()) {
            $expenses[] = $row;
        }
        $shift['expenses'] = $expenses;
        $shifts[] = $shift;
    }
    respond('success', ['shifts' => $shifts, 'count' => count($shifts)]);
}

/**
 * End/Close the current shift
 * Required: closing_cash
 * Optional: notes
 */
function endShift()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers can end shifts']);
    }
    
    $input = requireParams(['closing_cash']);
    $closing_cash = (float)$input['closing_cash'];
    $notes = isset($input['notes']) ? $input['notes'] : null;
    
    // Get cashier's active shift
    $stmt = $conn->prepare("SELECT * FROM cashier_shifts WHERE user_id = ? AND status = 'open'");
    $stmt->bind_param("i", $admin['id']);
    $stmt->execute();
    $shiftResult = $stmt->get_result();
    
    if ($shiftResult->num_rows === 0) {
        respond('error', 'No active shift found.');
    }
    
    $shift = $shiftResult->fetch_assoc();
    $shift_id = $shift['id'];
    $opening_cash = (float)$shift['opening_cash'];
    
    // Calculate totals using helper
    if (closeShiftById($shift_id, $opening_cash, $closing_cash, $admin['id'], $notes)) {
        // Get the updated shift data
        $stmt = $conn->prepare("SELECT * FROM cashier_shifts WHERE id = ?");
        $stmt->bind_param("i", $shift_id);
        $stmt->execute();
        $closedShift = $stmt->get_result()->fetch_assoc();
        
        respond('success', [
            'message' => 'Shift closed successfully.',
            'shift_id' => $shift_id,
            'summary' => [
                'opening_cash' => (float)$closedShift['opening_cash'],
                'closing_cash' => (float)$closedShift['closing_cash'],
                'total_sales' => (float)$closedShift['total_sales'],
                'total_cash_payments' => (float)$closedShift['total_cash_payments'],
                'total_card_payments' => (float)$closedShift['total_card_payments'],
                'expected_cash' => (float)$closedShift['expected_cash'],
                'difference' => (float)$closedShift['difference'],
                'start_time' => $closedShift['start_time'],
                'end_time' => $closedShift['end_time']
            ]
        ]);
    } else {
        respond('error', 'Failed to close shift.');
    }
}

/**
 * Get current active shift details
 */
function getCurrentShift()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers can view shift details']);
    }
    
    // Get active shift
    $stmt = $conn->prepare("SELECT * FROM cashier_shifts WHERE user_id = ? AND status = 'open'");
    $stmt->bind_param("i", $admin['id']);
    $stmt->execute();
    $shiftResult = $stmt->get_result();
    
    if ($shiftResult->num_rows === 0) {
        respond('success', ['shift' => null, 'message' => 'No active shift.']);
    }
    
    $shift = $shiftResult->fetch_assoc();
    $shift_id = $shift['id'];
    
    // Get current totals (real-time)
    // Total sales
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(total), 0) AS total_sales,
                COUNT(*) AS orders_count
         FROM orders WHERE shift_id = ? AND status != 'cancelled'"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $salesData = $stmt->get_result()->fetch_assoc();
    
    // Total cash payments
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.shift_id = ? AND p.payment_method = 'cash'"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $total_cash = (float)$stmt->get_result()->fetch_assoc()['total'];
    
    // Total card payments
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.shift_id = ? AND p.payment_method = 'card'"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $total_card = (float)$stmt->get_result()->fetch_assoc()['total'];
    
    // Total expenses
    $stmt = $conn->prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM shift_expenses WHERE shift_id = ?");
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $total_expenses = (float)$stmt->get_result()->fetch_assoc()['total'];
    
    // Calculate expected cash
    $opening_cash = (float)$shift['opening_cash'];
    $expected_cash = $opening_cash + $total_cash - $total_expenses;
    
    respond('success', [
        'shift' => [
            'id' => $shift['id'],
            'start_time' => $shift['start_time'],
            'opening_cash' => $opening_cash,
            'status' => $shift['status'],
            'current_totals' => [
                'total_sales' => (float)$salesData['total_sales'],
                'orders_count' => (int)$salesData['orders_count'],
                'total_cash_payments' => $total_cash,
                'total_card_payments' => $total_card,
                'total_expenses' => $total_expenses,
                'expected_cash' => $expected_cash
            ]
        ]
    ]);
}

/**
 * Get detailed shift summary (for closing)
 */
function getShiftSummary()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers can view shift summary']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Get shift_id from input or use current active shift
    if (isset($input['shift_id'])) {
        $shift_id = (int)$input['shift_id'];
        $stmt = $conn->prepare("SELECT * FROM cashier_shifts WHERE id = ?");
        $stmt->bind_param("i", $shift_id);
    } else {
        $stmt = $conn->prepare("SELECT * FROM cashier_shifts WHERE user_id = ? AND status = 'open'");
        $stmt->bind_param("i", $admin['id']);
    }
    
    $stmt->execute();
    $shiftResult = $stmt->get_result();
    
    if ($shiftResult->num_rows === 0) {
        respond('error', 'Shift not found.');
    }
    
    $shift = $shiftResult->fetch_assoc();
    $shift_id = $shift['id'];
    
    // Get orders summary by type
    $stmt = $conn->prepare(
        "SELECT order_type, 
                COUNT(*) as count,
                COALESCE(SUM(total), 0) as total
         FROM orders 
         WHERE shift_id = ? AND status != 'cancelled'
         GROUP BY order_type"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $ordersByType = [];
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $ordersByType[$row['order_type']] = [
            'count' => (int)$row['count'],
            'total' => (float)$row['total']
        ];
    }
    
    // Get orders by status
    $stmt = $conn->prepare(
        "SELECT status, COUNT(*) as count
         FROM orders WHERE shift_id = ?
         GROUP BY status"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $ordersByStatus = [];
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $ordersByStatus[$row['status']] = (int)$row['count'];
    }
    
    // Get payment methods breakdown
    $stmt = $conn->prepare(
        "SELECT p.payment_method, 
                COUNT(*) as count,
                COALESCE(SUM(p.amount), 0) as total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.shift_id = ?
         GROUP BY p.payment_method"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $paymentsByMethod = [];
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $paymentsByMethod[$row['payment_method']] = [
            'count' => (int)$row['count'],
            'total' => (float)$row['total']
        ];
    }
    
    // Get expenses
    $stmt = $conn->prepare(
        "SELECT id, amount, reason, created_at 
         FROM shift_expenses WHERE shift_id = ? ORDER BY created_at ASC"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $expenses = [];
    $total_expenses = 0;
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $expenses[] = $row;
        $total_expenses += (float)$row['amount'];
    }
    
    // Get refunds
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(r.refund_amount), 0) as total_refunds, COUNT(*) as count
         FROM returns r
         JOIN orders o ON r.order_id = o.id
         WHERE o.shift_id = ?"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $refundsData = $stmt->get_result()->fetch_assoc();
    
    // Calculate totals
    $total_sales = 0;
    foreach ($ordersByType as $type) {
        $total_sales += $type['total'];
    }
    
    $total_cash = isset($paymentsByMethod['cash']) ? $paymentsByMethod['cash']['total'] : 0;
    $total_card = isset($paymentsByMethod['card']) ? $paymentsByMethod['card']['total'] : 0;
    $opening_cash = (float)$shift['opening_cash'];
    $expected_cash = $opening_cash + $total_cash - $total_expenses;
    
    respond('success', [
        'shift' => [
            'id' => $shift['id'],
            'user_id' => $shift['user_id'],
            'status' => $shift['status'],
            'start_time' => $shift['start_time'],
            'end_time' => $shift['end_time'],
            'opening_cash' => $opening_cash,
            'closing_cash' => $shift['closing_cash']
        ],
        'summary' => [
            'total_sales' => $total_sales,
            'total_cash_payments' => $total_cash,
            'total_card_payments' => $total_card,
            'total_expenses' => $total_expenses,
            'total_refunds' => (float)$refundsData['total_refunds'],
            'refunds_count' => (int)$refundsData['count'],
            'expected_cash' => $expected_cash
        ],
        'orders_by_type' => $ordersByType,
        'orders_by_status' => $ordersByStatus,
        'payments_by_method' => $paymentsByMethod,
        'expenses' => $expenses
    ]);
}

/**
 * Process payment for an order
 * Required: order_id, payment_method (cash|card), amount
 * Optional: change (for cash payments, calculated automatically)
 */
function processPayment()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers can process payments']);
    }
    
    $input = requireParams(['order_id', 'payment_method', 'amount']);
    $order_id = (int)$input['order_id'];
    $payment_method = $input['payment_method'];
    $amount = (float)$input['amount'];
    
    // Validate payment method
    if (!in_array($payment_method, ['cash', 'card'])) {
        respond('error', 'Invalid payment method. Must be cash or card.');
    }
    
    // Get order
    $stmt = $conn->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $order = $orderResult->fetch_assoc();
    
    // Check if order is cancelled
    if ($order['status'] === 'cancelled') {
        respond('error', 'Cannot process payment for a cancelled order.');
    }
    
    // Get existing payments for this order
    $stmt = $conn->prepare("SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE order_id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $paid = (float)$stmt->get_result()->fetch_assoc()['paid'];
    
    $remaining = (float)$order['total'] - $paid;
    
    if ($remaining <= 0) {
        respond('error', 'Order is already fully paid.');
    }
    
    // For cash, allow payment to be more than remaining (change will be given)
    // For card, payment should be exact or less
    $actual_payment = $amount;
    $change = 0;
    
    if ($payment_method === 'cash') {
        if ($amount < $remaining) {
            // Partial payment
            $actual_payment = $amount;
        } else {
            // Full payment or overpayment
            $actual_payment = $remaining;
            $change = $amount - $remaining;
        }
    } else {
        // Card payment
        if ($amount > $remaining) {
            $actual_payment = $remaining;
        }
    }
    
    // Record payment
    $stmt = $conn->prepare("INSERT INTO payments (order_id, payment_method, amount) VALUES (?, ?, ?)");
    $stmt->bind_param("isd", $order_id, $payment_method, $actual_payment);
    
    if (!$stmt->execute()) {
        respond('error', 'Failed to process payment.');
    }
    
    $payment_id = $conn->insert_id;
    $new_paid = $paid + $actual_payment;
    $new_remaining = (float)$order['total'] - $new_paid;
    
    $is_fully_paid = $new_remaining <= 0;
    
    respond('success', [
        'message' => 'Payment processed successfully.',
        'payment_id' => $payment_id,
        'payment_method' => $payment_method,
        'amount_received' => $amount,
        'amount_applied' => $actual_payment,
        'change' => $change,
        'order_total' => (float)$order['total'],
        'total_paid' => $new_paid,
        'remaining' => $new_remaining,
        'is_fully_paid' => $is_fully_paid
    ]);
}

/**
 * Get all payments for an order
 * Required: order_id
 */
function getOrderPayments()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    
    $input = requireParams(['order_id']);
    $order_id = (int)$input['order_id'];
    
    // Get order
    $stmt = $conn->prepare("SELECT id, total FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $order = $orderResult->fetch_assoc();
    
    // Get payments
    $stmt = $conn->prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at ASC");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $payments = [];
    $total_paid = 0;
    while ($row = $result->fetch_assoc()) {
        $payments[] = $row;
        $total_paid += (float)$row['amount'];
    }
    
    respond('success', [
        'order_id' => $order_id,
        'order_total' => (float)$order['total'],
        'total_paid' => $total_paid,
        'remaining' => (float)$order['total'] - $total_paid,
        'is_fully_paid' => $total_paid >= (float)$order['total'],
        'payments' => $payments
    ]);
}

/**
 * Get formatted receipt data for an order
 * Required: order_id
 */
function getOrderReceipt()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    
    $input = requireParams(['order_id']);
    $order_id = (int)$input['order_id'];
    
    // Get order with cashier name
    $stmt = $conn->prepare(
        "SELECT o.*, u.name as cashier_name, t.table_number
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN tables t ON o.table_id = t.id
         WHERE o.id = ?"
    );
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $order = $orderResult->fetch_assoc();
    
    // Get order items
    $stmt = $conn->prepare(
        "SELECT oi.quantity, oi.price, p.name as product_name,
                (oi.quantity * oi.price) as item_total
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?"
    );
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $itemsResult = $stmt->get_result();
    
    $items = [];
    $subtotal = 0;
    while ($item = $itemsResult->fetch_assoc()) {
        $items[] = [
            'name' => $item['product_name'],
            'quantity' => (int)$item['quantity'],
            'unit_price' => (float)$item['price'],
            'total' => (float)$item['item_total']
        ];
        $subtotal += (float)$item['item_total'];
    }
    
    // Get payments
    $stmt = $conn->prepare(
        "SELECT payment_method, amount, paid_at FROM payments WHERE order_id = ?"
    );
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $paymentsResult = $stmt->get_result();
    
    $payments = [];
    $total_paid = 0;
    while ($payment = $paymentsResult->fetch_assoc()) {
        $payments[] = [
            'method' => $payment['payment_method'],
            'amount' => (float)$payment['amount'],
            'time' => $payment['paid_at']
        ];
        $total_paid += (float)$payment['amount'];
    }
    
    // Build receipt
    $receipt = [
        'receipt_number' => str_pad($order_id, 6, '0', STR_PAD_LEFT),
        'order_id' => $order_id,
        'order_type' => $order['order_type'],
        'order_type_display' => [
            'dine_in' => 'Dine In',
            'takeaway' => 'Takeaway',
            'delivery' => 'Delivery'
        ][$order['order_type']] ?? $order['order_type'],
        'date' => date('Y-m-d', strtotime($order['created_at'])),
        'time' => date('H:i:s', strtotime($order['created_at'])),
        'cashier' => $order['cashier_name'],
        'items' => $items,
        'subtotal' => $subtotal,
        'delivery_cost' => (int)$order['deleivery_cost'],
        'table_tax' => (float)$order['table_tax'],
        'total' => (float)$order['total'],
        'payments' => $payments,
        'total_paid' => $total_paid,
        'change' => $total_paid > (float)$order['total'] ? $total_paid - (float)$order['total'] : 0,
        'is_paid' => $total_paid >= (float)$order['total'],
        'status' => $order['status']
    ];
    
    // Add type-specific info
    if ($order['order_type'] === 'dine_in') {
        $receipt['table_number'] = $order['table_number'];
        $receipt['start_at'] = $order['start_at'];
        $receipt['end_at'] = $order['end_at'];
        
        // Calculate time spent if both times exist
        if ($order['start_at'] && $order['end_at']) {
            $start = new DateTime($order['start_at']);
            $end = new DateTime($order['end_at']);
            $diff = $start->diff($end);
            
            $receipt['time_spent'] = [
                'hours' => $diff->h + ($diff->days * 24),
                'minutes' => $diff->i,
                'seconds' => $diff->s,
                'total_minutes' => ($diff->h + ($diff->days * 24)) * 60 + $diff->i,
                'formatted' => sprintf('%02d:%02d:%02d', $diff->h + ($diff->days * 24), $diff->i, $diff->s)
            ];
        }
    } elseif ($order['order_type'] === 'delivery') {
        $receipt['customer_name'] = $order['customer_name'];
        $receipt['customer_phone'] = $order['customer_phone'];
        $receipt['address'] = $order['address'];
    } elseif ($order['order_type'] === 'takeaway') {
        if ($order['customer_name']) {
            $receipt['customer_name'] = $order['customer_name'];
        }
        if ($order['customer_phone']) {
            $receipt['customer_phone'] = $order['customer_phone'];
        }
    }
    
    respond('success', ['receipt' => $receipt]);
}

/**
 * Checkout/Close a table order - sets end time, calculates time spent and table tax
 * Required: order_id
 * Optional: table_tax (if not provided, calculated based on hourly_rate)
 * Optional: hourly_rate (rate per hour for table usage, default 0)
 */
function checkoutTableOrder()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers or admins can checkout table orders']);
    }
    
    $input = requireParams(['order_id']);
    $order_id = (int)$input['order_id'];
    $custom_table_tax = isset($input['table_tax']) ? (float)$input['table_tax'] : null;
    $hourly_rate = isset($input['hourly_rate']) ? (float)$input['hourly_rate'] : 0;
    
    // Get order
    $stmt = $conn->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $order = $orderResult->fetch_assoc();
    
    // Must be dine_in order
    if ($order['order_type'] !== 'dine_in') {
        respond('error', 'This function is only for dine_in orders.');
    }
    
    // Cannot checkout cancelled order
    if ($order['status'] === 'cancelled') {
        respond('error', 'Cannot checkout a cancelled order.');
    }
    
    // Check if already checked out
    if ($order['end_at'] !== null) {
        respond('error', 'Order has already been checked out.');
    }
    
    // Calculate time spent
    $start_at = new DateTime($order['start_at']);
    $end_at = new DateTime(); // NOW
    $diff = $start_at->diff($end_at);
    
    $total_minutes = ($diff->h + ($diff->days * 24)) * 60 + $diff->i;
    $total_hours = $total_minutes / 60;
    
    // Calculate table tax
    if ($custom_table_tax !== null) {
        // Use provided table tax
        $table_tax = $custom_table_tax;
    } elseif ($hourly_rate > 0) {
        // Calculate based on hourly rate (round up to nearest hour or use actual hours)
        $table_tax = ceil($total_hours) * $hourly_rate;
    } else {
        // Keep existing table tax or 0
        $table_tax = (float)$order['table_tax'];
    }
    
    // Calculate new total
    // First get items total
    $stmt = $conn->prepare("SELECT COALESCE(SUM(quantity * price), 0) as items_total FROM order_items WHERE order_id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $items_total = (float)$stmt->get_result()->fetch_assoc()['items_total'];
    
    $new_total = $items_total + (int)$order['deleivery_cost'] + $table_tax;
    
    // Update order with end_at, table_tax, and new total
    $end_at_str = $end_at->format('Y-m-d H:i:s');
    $stmt = $conn->prepare("UPDATE orders SET end_at = ?, table_tax = ?, total = ? WHERE id = ?");
    $stmt->bind_param("sddi", $end_at_str, $table_tax, $new_total, $order_id);
    
    if (!$stmt->execute()) {
        respond('error', 'Failed to checkout order.');
    }
    
    // Free the table
    if ($order['table_id']) {
        $stmt = $conn->prepare("UPDATE tables SET status = 'available' WHERE id = ?");
        $stmt->bind_param("i", $order['table_id']);
        $stmt->execute();
    }
    
    respond('success', [
        'message' => 'Table order checked out successfully.',
        'order_id' => $order_id,
        'start_at' => $order['start_at'],
        'end_at' => $end_at_str,
        'time_spent' => [
            'hours' => $diff->h + ($diff->days * 24),
            'minutes' => $diff->i,
            'total_minutes' => $total_minutes,
            'total_hours_decimal' => round($total_hours, 2),
            'formatted' => sprintf('%02d:%02d:%02d', $diff->h + ($diff->days * 24), $diff->i, $diff->s)
        ],
        'items_total' => $items_total,
        'table_tax' => $table_tax,
        'new_total' => $new_total,
        'table_freed' => $order['table_id'] ? true : false
    ]);
}

/**
 * Get current time info for an active table order (without closing it)
 * Required: order_id
 * Optional: hourly_rate (to preview table tax)
 */
function getTableOrderTime()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    
    $input = requireParams(['order_id']);
    $order_id = (int)$input['order_id'];
    $hourly_rate = isset($input['hourly_rate']) ? (float)$input['hourly_rate'] : 0;
    
    // Get order
    $stmt = $conn->prepare(
        "SELECT o.*, t.table_number 
         FROM orders o 
         LEFT JOIN tables t ON o.table_id = t.id 
         WHERE o.id = ?"
    );
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $order = $orderResult->fetch_assoc();
    
    if ($order['order_type'] !== 'dine_in') {
        respond('error', 'This function is only for dine_in orders.');
    }
    
    // Calculate time from start to now (or to end_at if already closed)
    $start_at = new DateTime($order['start_at']);
    $end_at = $order['end_at'] ? new DateTime($order['end_at']) : new DateTime();
    $diff = $start_at->diff($end_at);
    
    $total_minutes = ($diff->h + ($diff->days * 24)) * 60 + $diff->i;
    $total_hours = $total_minutes / 60;
    
    // Calculate estimated table tax
    $estimated_table_tax = $hourly_rate > 0 ? ceil($total_hours) * $hourly_rate : (float)$order['table_tax'];
    
    // Get current items total
    $stmt = $conn->prepare("SELECT COALESCE(SUM(quantity * price), 0) as items_total FROM order_items WHERE order_id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $items_total = (float)$stmt->get_result()->fetch_assoc()['items_total'];
    
    $estimated_total = $items_total + (int)$order['deleivery_cost'] + $estimated_table_tax;
    
    respond('success', [
        'order_id' => $order_id,
        'table_number' => $order['table_number'],
        'status' => $order['status'],
        'is_checked_out' => $order['end_at'] !== null,
        'start_at' => $order['start_at'],
        'end_at' => $order['end_at'],
        'current_time' => date('Y-m-d H:i:s'),
        'time_spent' => [
            'hours' => $diff->h + ($diff->days * 24),
            'minutes' => $diff->i,
            'seconds' => $diff->s,
            'total_minutes' => $total_minutes,
            'total_hours_decimal' => round($total_hours, 2),
            'formatted' => sprintf('%02d:%02d:%02d', $diff->h + ($diff->days * 24), $diff->i, $diff->s)
        ],
        'items_total' => $items_total,
        'current_table_tax' => (float)$order['table_tax'],
        'estimated_table_tax' => $estimated_table_tax,
        'hourly_rate_used' => $hourly_rate,
        'current_total' => (float)$order['total'],
        'estimated_total' => $estimated_total
    ]);
}

/**
 * Delete a shift expense
 * Required: expense_id
 */
function deleteShiftExpense()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers can delete expenses']);
    }
    
    $input = requireParams(['expense_id']);
    $expense_id = (int)$input['expense_id'];
    
    // Get expense
    $stmt = $conn->prepare(
        "SELECT se.*, cs.user_id, cs.status 
         FROM shift_expenses se
         JOIN cashier_shifts cs ON se.shift_id = cs.id
         WHERE se.id = ?"
    );
    $stmt->bind_param("i", $expense_id);
    $stmt->execute();
    $expenseResult = $stmt->get_result();
    
    if ($expenseResult->num_rows === 0) {
        respond('error', 'Expense not found.');
    }
    
    $expense = $expenseResult->fetch_assoc();
    
    // Check if shift is still open
    if ($expense['status'] !== 'open') {
        respond('error', 'Cannot delete expense from a closed shift.');
    }
    
    // Check if user owns this shift or is admin
    if ($admin['role'] !== 'admin' && $expense['user_id'] != $admin['id']) {
        respond('error', 'You can only delete expenses from your own shift.');
    }
    
    // Delete expense
    $stmt = $conn->prepare("DELETE FROM shift_expenses WHERE id = ?");
    $stmt->bind_param("i", $expense_id);
    
    if ($stmt->execute()) {
        respond('success', ['message' => 'Expense deleted successfully.']);
    } else {
        respond('error', 'Failed to delete expense.');
    }
}

function addUser()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to add user
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can add users']);
    }
    $input = requireParams(['name', 'email', 'password', 'role']);
    $name = $input['name'];
    $email = $input['email'];
    $password = md5($input['password']);
    $role = $input['role'];
    if (!in_array($role, ['admin', 'kitchen', 'cashier'])) {
        respond(400, ['error' => 'Invalid role. Must be admin, kitchen, or cashier']);
    }
    $stmt = $conn->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $name, $email, $password, $role);
    if ($stmt->execute()) {
        respond(201, ['message' => 'User added successfully']);
    } else {
        respond(500, ['error' => 'Failed to add user']);
    }
}
function getUsers()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to get users
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view users']);
    }
    $result = $conn->query("SELECT id, name, email, role FROM users");
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    respond(200, ['users' => $users]);
}
function updateUser()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to update user
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can update users']);
    }
    $input = requireParams(['id']);
    $id = $input['id'];

    // Fetch current user data
    $stmt = $conn->prepare("SELECT name, email, password, role FROM users WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'User not found.');
    }
    $current = $result->fetch_assoc();

    // Use provided values or fall back to existing ones
    $name     = isset($input['name'])     ? $input['name']              : $current['name'];
    $email    = isset($input['email'])    ? $input['email']             : $current['email'];
    $password = isset($input['password']) ? md5($input['password'])     : $current['password'];
    $role     = isset($input['role'])     ? $input['role']              : $current['role'];

    $stmt = $conn->prepare("UPDATE users SET name = ?, email = ?, password = ?, role = ? WHERE id = ?");
    $stmt->bind_param("ssssi", $name, $email, $password, $role, $id);
    if ($stmt->execute()) {
        respond('success', ['message' => 'User updated successfully']);
    } else {
        respond('error', 'Failed to update user');
    }
}
function deleteUser(){
    global $conn;
     $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to delete user
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can DELETE users']);
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    // Fetch current user data
    $stmt = $conn->prepare("SELECT name, email, password, role FROM users WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'User not found.');
    }
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        respond('success', ['message' => 'User deleted successfully']);
    } else {
        respond('error', 'Failed to delete user');
    }
}
/**
 * Add kitchen production log and update product stock
 * Required: product_id, quantity
 * Kitchen staff logs how many items they produced
 */
function addKitchenLog(){
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'kitchen' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only kitchen staff can add kitchen logs']);
    }
    
    $input = requireParams(['product_id', 'quantity']);
    $product_id = (int)$input['product_id'];
    $quantity = (int)$input['quantity'];
    $user_id = $admin['id'];
    
    if ($quantity <= 0) {
        respond('error', 'Quantity must be greater than 0.');
    }
    
    // Verify product exists
    $stmt = $conn->prepare("SELECT id, name, stock FROM products WHERE id = ?");
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    $productResult = $stmt->get_result();
    if ($productResult->num_rows === 0) {
        respond('error', 'Product not found.');
    }
    $product = $productResult->fetch_assoc();
    
    // Insert kitchen log
    $stmt = $conn->prepare("INSERT INTO kitchen_logs (product_id, quantity, user_id) VALUES (?, ?, ?)");
    $stmt->bind_param("iii", $product_id, $quantity, $user_id);
    
    if (!$stmt->execute()) {
        respond('error', 'Failed to add kitchen log.');
    }
    
    $log_id = $conn->insert_id;
    
    // Update product stock
    $stmt = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    $stmt->bind_param("ii", $quantity, $product_id);
    $stmt->execute();
    
    $new_stock = $product['stock'] + $quantity;
    
    respond('success', [
        'message' => 'Kitchen log added successfully.',
        'log_id' => $log_id,
        'product_name' => $product['name'],
        'quantity_produced' => $quantity,
        'new_stock' => $new_stock
    ]);
}

// Keep old function name for backward compatibility
function addkitchenlogs(){
    addKitchenLog();
}

/**
 * Get kitchen production logs
 * Optional: product_id, start_date, end_date, user_id
 */
function getKitchenLogs(){
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'kitchen' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only kitchen staff or admin can view kitchen logs']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $where = [];
    $params = [];
    $types = "";
    
    if (isset($input['product_id']) && $input['product_id']) {
        $where[] = "kl.product_id = ?";
        $params[] = (int)$input['product_id'];
        $types .= "i";
    }
    
    if (isset($input['user_id']) && $input['user_id']) {
        $where[] = "kl.user_id = ?";
        $params[] = (int)$input['user_id'];
        $types .= "i";
    }
    
    if (isset($input['start_date']) && $input['start_date']) {
        $where[] = "DATE(kl.created_at) >= ?";
        $params[] = $input['start_date'];
        $types .= "s";
    }
    
    if (isset($input['end_date']) && $input['end_date']) {
        $where[] = "DATE(kl.created_at) <= ?";
        $params[] = $input['end_date'];
        $types .= "s";
    }
    
    $sql = "SELECT kl.id, kl.product_id, kl.quantity, kl.user_id, kl.created_at,
                   p.name as product_name, u.name as user_name
            FROM kitchen_logs kl
            JOIN products p ON kl.product_id = p.id
            JOIN users u ON kl.user_id = u.id";
    
    if (count($where) > 0) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    
    $sql .= " ORDER BY kl.created_at DESC";
    
    if (count($params) > 0) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $conn->query($sql);
    }
    
    $logs = [];
    $total_quantity = 0;
    while ($row = $result->fetch_assoc()) {
        $logs[] = $row;
        $total_quantity += (int)$row['quantity'];
    }
    
    respond('success', [
        'logs' => $logs,
        'count' => count($logs),
        'total_quantity_produced' => $total_quantity
    ]);
}

/**
 * Quick stock update for kitchen
 * Required: items (array of {product_id, quantity})
 * Allows updating multiple products at once
 */
function quickStockUpdate(){
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'kitchen' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only kitchen staff or admin can update stock']);
    }
    
    $input = requireParams(['items']);
    $items = $input['items']; // array of {product_id, quantity}
    
    if (!is_array($items) || count($items) === 0) {
        respond('error', 'Items must be a non-empty array.');
    }
    
    $updated_items = [];
    $user_id = $admin['id'];
    
    foreach ($items as $item) {
        if (!isset($item['product_id']) || !isset($item['quantity'])) {
            respond('error', 'Each item must have product_id and quantity.');
        }
        
        $product_id = (int)$item['product_id'];
        $quantity = (int)$item['quantity'];
        
        if ($quantity <= 0) {
            respond('error', 'Quantity must be greater than 0.');
        }
        
        // Get product
        $stmt = $conn->prepare("SELECT id, name, stock FROM products WHERE id = ?");
        $stmt->bind_param("i", $product_id);
        $stmt->execute();
        $productResult = $stmt->get_result();
        
        if ($productResult->num_rows === 0) {
            respond('error', "Product with ID $product_id not found.");
        }
        
        $product = $productResult->fetch_assoc();
        
        // Update stock
        $stmt = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
        $stmt->bind_param("ii", $quantity, $product_id);
        $stmt->execute();
        
        // Log the production
        $stmt = $conn->prepare("INSERT INTO kitchen_logs (product_id, quantity, user_id) VALUES (?, ?, ?)");
        $stmt->bind_param("iii", $product_id, $quantity, $user_id);
        $stmt->execute();
        
        $updated_items[] = [
            'product_id' => $product_id,
            'product_name' => $product['name'],
            'quantity_added' => $quantity,
            'old_stock' => (int)$product['stock'],
            'new_stock' => (int)$product['stock'] + $quantity
        ];
    }
    
    respond('success', [
        'message' => 'Stock updated successfully.',
        'updated_items' => $updated_items,
        'items_count' => count($updated_items)
    ]);
}

/**
 * Get products with low stock
 * Optional: threshold (default 10)
 */
function getLowStockProducts(){
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'kitchen' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only kitchen staff or admin can view low stock products']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $threshold = isset($input['threshold']) ? (int)$input['threshold'] : 10;
    
    $stmt = $conn->prepare(
        "SELECT p.id, p.name, p.category_id, p.stock, p.is_active, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.stock <= ? AND p.is_active = 1
         ORDER BY p.stock ASC"
    );
    $stmt->bind_param("i", $threshold);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $products = [];
    $out_of_stock = 0;
    $critical = 0; // stock <= 5
    
    while ($row = $result->fetch_assoc()) {
        if ((int)$row['stock'] === 0) {
            $row['status'] = 'out_of_stock';
            $out_of_stock++;
        } elseif ((int)$row['stock'] <= 5) {
            $row['status'] = 'critical';
            $critical++;
        } else {
            $row['status'] = 'low';
        }
        $products[] = $row;
    }
    
    respond('success', [
        'products' => $products,
        'count' => count($products),
        'threshold' => $threshold,
        'summary' => [
            'out_of_stock' => $out_of_stock,
            'critical' => $critical,
            'low' => count($products) - $out_of_stock - $critical
        ]
    ]);
}

/**
 * Get today's kitchen production summary
 */
function getKitchenDailySummary(){
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'kitchen' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only kitchen staff or admin can view kitchen summary']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $date = isset($input['date']) ? $input['date'] : date('Y-m-d');
    
    // Get production by product
    $stmt = $conn->prepare(
        "SELECT p.id, p.name, p.stock as current_stock, 
                COALESCE(SUM(kl.quantity), 0) as produced_today
         FROM products p
         LEFT JOIN kitchen_logs kl ON p.id = kl.product_id AND DATE(kl.created_at) = ?
         WHERE p.is_active = 1
         GROUP BY p.id
         ORDER BY produced_today DESC"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $products = [];
    $total_produced = 0;
    while ($row = $result->fetch_assoc()) {
        $products[] = $row;
        $total_produced += (int)$row['produced_today'];
    }
    
    // Get production by user
    $stmt = $conn->prepare(
        "SELECT u.id, u.name, COALESCE(SUM(kl.quantity), 0) as quantity_produced
         FROM users u
         LEFT JOIN kitchen_logs kl ON u.id = kl.user_id AND DATE(kl.created_at) = ?
         WHERE u.role = 'kitchen'
         GROUP BY u.id
         ORDER BY quantity_produced DESC"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $userResult = $stmt->get_result();
    
    $users_production = [];
    while ($row = $userResult->fetch_assoc()) {
        $users_production[] = $row;
    }
    
    respond('success', [
        'date' => $date,
        'total_produced' => $total_produced,
        'products' => $products,
        'users_production' => $users_production
    ]);
}

function getCategory(){
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin or kitchen to get category
    $result = $conn->query("SELECT id, name FROM categories");
    $categories = [];
    while ($row = $result->fetch_assoc()) {
        $categories[] = $row;
    }
    respond(200, ['categories' => $categories]);
}
function addCategory(){
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to add category
    if ($admin['role'] !== 'admin' && $admin['role'] !== 'kitchen') {
        respond(403, ['error' => 'Only admins can add categories']);
    }
    $input = requireParams(['name']);
    $name = $input['name'];
    $stmt = $conn->prepare("INSERT INTO categories (name) VALUES (?)");
    $stmt->bind_param("s", $name);
    if ($stmt->execute()) {
        respond(201, ['message' => 'Category added successfully']);
    } else {
        respond(500, ['error' => 'Failed to add category']);
    }
}
function updateCategory(){
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to update category
    if ($admin['role'] !== 'admin' && $admin['role'] !== 'kitchen') {
        respond(403, ['error' => 'Only admins can update categories']);
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    // Fetch current category data
    $stmt = $conn->prepare("SELECT name FROM categories WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'Category not found.');
    }
    $current = $result->fetch_assoc();
    // Use provided value or fall back to existing one
    $name = isset($input['name']) ? $input['name'] : $current['name'];
    $stmt = $conn->prepare("UPDATE categories SET name = ? WHERE id = ?");
    $stmt->bind_param("si", $name, $id);
    if ($stmt->execute()) {
        respond('success', ['message' => 'Category updated successfully']);
    } else {
        respond('error', 'Failed to update category');
    }
}
function deleteCategory(){
    global $conn;
     $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to delete category
    if ($admin['role'] !== 'admin' && $admin['role'] !== 'kitchen') {
        respond(403, ['error' => 'Only admins can delete categories']);
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    // Fetch current category data
    $stmt = $conn->prepare("SELECT name FROM categories WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'Category not found.');
    }
    $stmt = $conn->prepare("DELETE FROM categories WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        respond('success', ['message' => 'Category deleted successfully']);
    } else {
        respond('error', 'Failed to delete category');
    }
}
//functions for products 
function addProduct()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to add product
    if ($admin['role'] !== 'admin' && $admin['role'] !== 'kitchen') {
        respond(403, ['error' => 'Only admins can add products']);
    }
    $input = requireParams(['name', 'category_id', 'price', 'cost', 'stock']);
    $name = $input['name'];
    $category_id = $input['category_id'];
    $price = $input['price'];
    $cost = $input['cost'];
    $stock = $input['stock'];
    $description = isset($input['description']) ? $input['description'] : null;
    $stmt = $conn->prepare("INSERT INTO products (name, category_id, price, cost, stock, description) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("siddis", $name, $category_id, $price, $cost, $stock, $description);
    if ($stmt->execute()) {
        respond(201, ['message' => 'Product added successfully']);
    } else {
        respond(500, ['error' => 'Failed to add product']);
    }
}

function updateProduct()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to update product
    if ($admin['role'] !== 'admin' && $admin['role'] !== 'kitchen') {
        respond(403, ['error' => 'Only admins can update products']);
    }
    $input = requireParams(['id']);
    $id = $input['id'];

    // Fetch current product data
    $stmt = $conn->prepare("SELECT name, category_id, price, cost, stock, description FROM products WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'Product not found.');
    }
    $current = $result->fetch_assoc();

    // Use provided values or fall back to existing ones
    $name        = isset($input['name'])        ? $input['name']         : $current['name'];
    $category_id = isset($input['category_id']) ? $input['category_id'] : $current['category_id'];
    $price       = isset($input['price'])       ? $input['price']       : $current['price'];
    $cost        = isset($input['cost'])        ? $input['cost']        : $current['cost'];
    $stock       = isset($input['stock'])       ? $input['stock']       : $current['stock'];
    $description = isset($input['description']) ? $input['description'] : $current['description'];

    $stmt = $conn->prepare("UPDATE products SET name = ?, category_id = ?, price = ?, cost = ?, stock = ?, description = ? WHERE id = ?");
    $stmt->bind_param("siddisi", $name, $category_id, $price, $cost, $stock, $description, $id);
    if ($stmt->execute()) {
        // If stock increased, log the added quantity to kitchen_logs
        $addedStock = $stock - $current['stock'];
        if ($addedStock > 0) {
            $userId = $admin['id'];
            $logStmt = $conn->prepare("INSERT INTO kitchen_logs (product_id, quantity, user_id) VALUES (?, ?, ?)");
            $logStmt->bind_param("iii", $id, $addedStock, $userId);
            $logStmt->execute();
        }
        respond('success', ['message' => 'Product updated successfully']);
    } else {
        respond('error', 'Failed to update product');
    }
}
function deleteProduct(){
    global $conn;
     $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);  
    }
    //role have to be admin to delete product
    if ($admin['role'] !== 'admin' &&  $admin['role'] !== 'kitchen') {
        respond(403, ['error' => 'Only admins can delete products']);
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    // Fetch current product data
    $stmt = $conn->prepare("SELECT name, category_id, price, cost, stock FROM products WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'Product not found.');
    }
    $stmt = $conn->prepare("DELETE FROM products WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        respond('success', ['message' => 'Product deleted successfully']);
    } else {
        respond('error', 'Failed to delete product');
    }
}
function getProducts()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    // cashier sees price only; admin and kitchen see cost too
    if ($admin['role'] === 'cashier') {
        $result = $conn->query("SELECT id, name, category_id, price, stock, description FROM products WHERE is_active = 1");
    } elseif ($admin['role'] === 'admin' || $admin['role'] === 'kitchen') {
        $result = $conn->query("SELECT id, name, category_id, price, cost, stock, is_active, description FROM products");
    } else {
        respond(403, ['error' => 'Unauthorized']);
    }
    $products = [];
    while ($row = $result->fetch_assoc()) {
        $products[] = $row;
    }
    respond(200, ['products' => $products]);
}
//tables functions
function getTables()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    $result = $conn->query("SELECT id, table_number, status FROM tables");
    $tables = [];
    while ($row = $result->fetch_assoc()) {
        $tables[] = $row;
    }
    respond(200, ['tables' => $tables]);
}
function addTable()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    //role have to be admin to add table
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can add tables']);
    }
    $input = requireParams(['table_number']);
    $table_number = $input['table_number'];
    $stmt = $conn->prepare("INSERT INTO tables (table_number) VALUES (?)");
    $stmt->bind_param("i", $table_number);
    if ($stmt->execute()) {
        respond(201, ['message' => 'Table added successfully']);
    } else {
        respond(500, ['error' => 'Failed to add table']);
    }
}
function updateTable()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);          
    }
    //role have to be admin to update table
    if ($admin['role'] !== 'admin') {       
        respond(403, ['error' => 'Only admins can update tables']);
    }
    $input = requireParams(['id']);     
    $id = $input['id'];
    // Fetch current table data
    $stmt = $conn->prepare("SELECT table_number FROM tables WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'Table not found.');
    }
    $current = $result->fetch_assoc();
    // Use provided value or fall back to existing one
    $table_number = isset($input['table_number']) ? $input['table_number'] : $current['table_number'];
    $stmt = $conn->prepare("UPDATE tables SET table_number = ? WHERE id = ?");
    $stmt->bind_param("ii", $table_number, $id);
    if ($stmt->execute()) {     
        respond('success', ['message' => 'Table updated successfully']);
    } else {
        respond('error', 'Failed to update table');
    }
}
function deleteTable(){
    global $conn;
     $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }       
    //role have to be admin to delete table
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can delete tables']);
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    // Fetch current table data
    $stmt = $conn->prepare("SELECT table_number FROM tables WHERE id = ?");
    $stmt->bind_param("i", $id);

    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        respond('error', 'Table not found.');
    }
    $stmt = $conn->prepare("DELETE FROM tables WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        respond('success', ['message' => 'Table deleted successfully']);
    } else {
        respond('error', 'Failed to delete table');
    }
}
function getAvailableTables()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    $result = $conn->query("SELECT id, table_number FROM tables WHERE status = 'available'");
    $tables = [];
    while ($row = $result->fetch_assoc()) {
        $tables[] = $row;
    }
    respond(200, ['available_tables' => $tables]);
}
//analysis for admin dashboard for tables and by table id
function getTablesProfitByDate()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view analytics']);
    }
    $input = requireParams(['date']);
    $date = $input['date']; // format: YYYY-MM-DD
    // Get profit from dine_in orders on that date (profit = price - cost per item)
    $stmt = $conn->prepare(
        "SELECT 
            COALESCE(SUM(oi.quantity * (oi.price - p.cost)), 0) AS total_profit,
            COALESCE(SUM(oi.quantity * oi.price), 0) AS total_revenue,
            COALESCE(SUM(oi.quantity * p.cost), 0) AS total_cost,
            COUNT(DISTINCT o.id) AS total_orders,
            COALESCE(SUM(o.table_tax), 0) AS total_table_tax
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN products p ON oi.product_id = p.id
         WHERE o.order_type = 'dine_in'
           AND o.status != 'cancelled'
           AND DATE(o.created_at) = ?"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    respond(200, [
        'date'           => $date,
        'total_orders'   => (int)$result['total_orders'],
        'total_revenue'  => (float)$result['total_revenue'],
        'total_cost'     => (float)$result['total_cost'],
        'total_profit'   => (float)$result['total_profit'],
        'total_table_tax'=> (float)$result['total_table_tax']
    ]);
}
function getTableOrdersAnalysis()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view analytics']);
    }
    $input      = requireParams(['table_id', 'start_date', 'end_date']);
    $table_id   = (int)$input['table_id'];
    $start_date = $input['start_date']; // YYYY-MM-DD
    $end_date   = $input['end_date'];   // YYYY-MM-DD
    // Fetch all orders for this table in the date range
    $stmt = $conn->prepare(
        "SELECT o.id, o.order_type, o.status, o.total, o.table_tax, o.created_at, o.start_at, o.end_at
         FROM orders o
         WHERE o.table_id = ?
           AND DATE(o.created_at) BETWEEN ? AND ?
         ORDER BY o.created_at DESC"
    );
    $stmt->bind_param("iss", $table_id, $start_date, $end_date);
    $stmt->execute();
    $ordersResult = $stmt->get_result();
    $orders = [];
    while ($order = $ordersResult->fetch_assoc()) {
        // Fetch items for each order
        $itemStmt = $conn->prepare(
            "SELECT oi.id, oi.product_id, p.name AS product_name, oi.quantity, oi.price,
                    p.cost, (oi.quantity * (oi.price - p.cost)) AS item_profit
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?"
        );
        $itemStmt->bind_param("i", $order['id']);
        $itemStmt->execute();
        $itemsResult = $itemStmt->get_result();
        $items = [];
        while ($item = $itemsResult->fetch_assoc()) {
            $items[] = $item;
        }
        $order['items'] = $items;
        $orders[] = $order;
    }
    // Summary stats
    $summaryStmt = $conn->prepare(
        "SELECT 
            COALESCE(SUM(oi.quantity * (oi.price - p.cost)), 0) AS total_profit,
            COALESCE(SUM(oi.quantity * oi.price), 0) AS total_revenue,
            COUNT(DISTINCT o.id) AS total_orders
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN products p ON oi.product_id = p.id
         WHERE o.table_id = ?
           AND o.status != 'cancelled'
           AND DATE(o.created_at) BETWEEN ? AND ?"
    );
    $summaryStmt->bind_param("iss", $table_id, $start_date, $end_date);
    $summaryStmt->execute();
    $summary = $summaryStmt->get_result()->fetch_assoc();
    respond(200, [
        'table_id'      => $table_id,
        'start_date'    => $start_date,
        'end_date'      => $end_date,
        'summary'       => [
            'total_orders'  => (int)$summary['total_orders'],
            'total_revenue' => (float)$summary['total_revenue'],
            'total_profit'  => (float)$summary['total_profit']
        ],
        'orders'        => $orders
    ]);
}

//function refunds 
function addRefund()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers or admins can process refunds']);
    }
    $input = requireParams(['order_id', 'items', 'is_returnable']);
    $order_id     = (int)$input['order_id'];
    $items        = $input['items']; // array of {order_item_id, quantity}
    $is_returnable = (bool)$input['is_returnable']; // true = good condition, false = damaged
    $custom_reason = isset($input['reason']) ? $input['reason'] : null;
    
    // Check order exists and is done
    $stmt = $conn->prepare("SELECT id, status, total FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    if ($orderResult->num_rows === 0) {
        respond(400, ['error' => 'الطلب غير موجود']);
    }
    $order = $orderResult->fetch_assoc();
    
    $refund_amount = 0.0;
    $refunded_items = [];
    
    foreach ($items as $item) {
        $order_item_id = (int)$item['order_item_id'];
        $refund_qty    = (int)$item['quantity'];
        
        // Get the order item
        $stmt = $conn->prepare(
            "SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.name AS product_name
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.id = ? AND oi.order_id = ?"
        );
        $stmt->bind_param("ii", $order_item_id, $order_id);
        $stmt->execute();
        $itemResult = $stmt->get_result();
        if ($itemResult->num_rows === 0) {
            respond(400, ['error' => 'عنصر الطلب غير موجود']);
        }
        $orderItem = $itemResult->fetch_assoc();
        
        if ($refund_qty > $orderItem['quantity']) {
            respond(400, ['error' => 'الكمية المسترجعة أكبر من الكمية الأصلية']);
        }
        
        $item_refund = $refund_qty * (float)$orderItem['price'];
        $refund_amount += $item_refund;
        
        // Update order_items quantity (reduce or delete if 0)
        $new_qty = $orderItem['quantity'] - $refund_qty;
        if ($new_qty <= 0) {
            $stmt = $conn->prepare("DELETE FROM order_items WHERE id = ?");
            $stmt->bind_param("i", $order_item_id);
        } else {
            $stmt = $conn->prepare("UPDATE order_items SET quantity = ? WHERE id = ?");
            $stmt->bind_param("ii", $new_qty, $order_item_id);
        }
        $stmt->execute();
        
        // If returnable (good condition), add back to stock
        if ($is_returnable) {
            $stmt = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
            $stmt->bind_param("ii", $refund_qty, $orderItem['product_id']);
            $stmt->execute();
        }
        
        $refunded_items[] = [
            'product_name' => $orderItem['product_name'],
            'quantity'     => $refund_qty,
            'amount'       => $item_refund
        ];
    }
    
    // Update order total
    $new_total = (float)$order['total'] - $refund_amount;
    if ($new_total < 0) $new_total = 0;
    $stmt = $conn->prepare("UPDATE orders SET total = ? WHERE id = ?");
    $stmt->bind_param("di", $new_total, $order_id);
    $stmt->execute();
    
    // Build reason
    if ($is_returnable) {
        $reason = "استرجاع - المنتج بحالة جيدة";
    } else {
        $reason = "استرجاع - المنتج تالف أو غير صالح للاستهلاك";
    }
    if ($custom_reason) {
        $reason .= " | ملاحظة: " . $custom_reason;
    }
    
    // Insert into returns table
    $stmt = $conn->prepare("INSERT INTO returns (order_id, reason, refund_amount) VALUES (?, ?, ?)");
    $stmt->bind_param("isd", $order_id, $reason, $refund_amount);
    $stmt->execute();
    $return_id = $conn->insert_id;
    
    respond(200, [
        'message'        => 'تم الاسترجاع بنجاح',
        'return_id'      => $return_id,
        'refund_amount'  => $refund_amount,
        'returned_to_stock' => $is_returnable,
        'refunded_items' => $refunded_items,
        'reason'         => $reason
    ]);
}

function getRefunds()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $start_date = isset($input['start_date']) ? $input['start_date'] : null;
    $end_date   = isset($input['end_date']) ? $input['end_date'] : null;
    
    if ($start_date && $end_date) {
        $stmt = $conn->prepare(
            "SELECT r.id, r.order_id, r.reason, r.refund_amount, r.created_at
             FROM returns r
             WHERE DATE(r.created_at) BETWEEN ? AND ?
             ORDER BY r.created_at DESC"
        );
        $stmt->bind_param("ss", $start_date, $end_date);
    } else {
        $stmt = $conn->prepare(
            "SELECT r.id, r.order_id, r.reason, r.refund_amount, r.created_at
             FROM returns r
             ORDER BY r.created_at DESC"
        );
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $refunds = [];
    while ($row = $result->fetch_assoc()) {
        $refunds[] = $row;
    }
    // Summary
    $total_refunds = 0;
    foreach ($refunds as $r) {
        $total_refunds += (float)$r['refund_amount'];
    }
    respond(200, [
        'refunds'       => $refunds,
        'total_refunds' => $total_refunds,
        'count'         => count($refunds)
    ]);
}
//orders functions

/**
 * Create a new order
 * Required: order_type (dine_in|takeaway|delivery), items (array of {product_id, quantity})
 * For dine_in: table_id required, table_tax optional
 * For takeaway: customer_name optional, customer_phone optional
 * For delivery: customer_name, customer_phone, address required, delivery_cost optional
 */
function createOrder()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers or admins can create orders']);
    }
    
    $input = requireParams(['order_type', 'items']);
    $order_type = $input['order_type'];
    $items = $input['items']; // array of {product_id, quantity}
    
    // Validate order_type
    if (!in_array($order_type, ['dine_in', 'takeaway', 'delivery'])) {
        respond('error', 'Invalid order type. Must be dine_in, takeaway, or delivery.');
    }
    
    // Initialize variables
    $table_id = null;
    $table_tax = 0.00;
    $customer_name = isset($input['customer_name']) ? $input['customer_name'] : null;
    $customer_phone = isset($input['customer_phone']) ? $input['customer_phone'] : null;
    $address = null;
    $delivery_cost = 0;
    
    // Validate based on order type
    if ($order_type === 'dine_in') {
        if (!isset($input['table_id'])) {
            respond('error', 'table_id is required for dine_in orders.');
        }
        $table_id = (int)$input['table_id'];
        $table_tax = isset($input['table_tax']) ? (float)$input['table_tax'] : 0.00;
        
        // Check if table exists and is available
        $stmt = $conn->prepare("SELECT id, status FROM tables WHERE id = ?");
        $stmt->bind_param("i", $table_id);
        $stmt->execute();
        $tableResult = $stmt->get_result();
        if ($tableResult->num_rows === 0) {
            respond('error', 'Table not found.');
        }
        $table = $tableResult->fetch_assoc();
        if ($table['status'] === 'occupied') {
            respond('error', 'Table is already occupied.');
        }
        
        // Mark table as occupied
        $stmt = $conn->prepare("UPDATE tables SET status = 'occupied' WHERE id = ?");
        $stmt->bind_param("i", $table_id);
        $stmt->execute();
        
    } elseif ($order_type === 'delivery') {
        if (!isset($input['customer_name']) || !isset($input['customer_phone']) || !isset($input['address'])) {
            respond('error', 'customer_name, customer_phone, and address are required for delivery orders.');
        }
        $customer_name = $input['customer_name'];
        $customer_phone = $input['customer_phone'];
        $address = $input['address'];
        $delivery_cost = isset($input['delivery_cost']) ? (int)$input['delivery_cost'] : 0;
    }
    // For takeaway, customer info is optional (already initialized)
    
    // Get user's active shift
    $shift_id = null;
    $shiftStmt = $conn->prepare("SELECT id FROM cashier_shifts WHERE user_id = ? AND status = 'open' LIMIT 1");
    $shiftStmt->bind_param("i", $admin['id']);
    $shiftStmt->execute();
    $shiftResult = $shiftStmt->get_result();
    if ($shiftResult->num_rows > 0) {
        $shift = $shiftResult->fetch_assoc();
        $shift_id = $shift['id'];
    }
    
    // Calculate total and validate items
    $total = 0.00;
    $validated_items = [];
    
    foreach ($items as $item) {
        if (!isset($item['product_id']) || !isset($item['quantity'])) {
            respond('error', 'Each item must have product_id and quantity.');
        }
        $product_id = (int)$item['product_id'];
        $quantity = (int)$item['quantity'];
        
        if ($quantity <= 0) {
            respond('error', 'Quantity must be greater than 0.');
        }
        
        // Get product details and check stock
        $stmt = $conn->prepare("SELECT id, name, price, stock, is_active FROM products WHERE id = ?");
        $stmt->bind_param("i", $product_id);
        $stmt->execute();
        $productResult = $stmt->get_result();
        if ($productResult->num_rows === 0) {
            respond('error', "Product with ID $product_id not found.");
        }
        $product = $productResult->fetch_assoc();
        
        if (!$product['is_active']) {
            respond('error', "Product '{$product['name']}' is not available.");
        }
        
        if ($product['stock'] < $quantity) {
            respond('error', "Insufficient stock for '{$product['name']}'. Available: {$product['stock']}");
        }
        
        $item_total = $quantity * (float)$product['price'];
        $total += $item_total;
        
        $validated_items[] = [
            'product_id' => $product_id,
            'quantity' => $quantity,
            'price' => (float)$product['price'],
            'name' => $product['name']
        ];
    }
    
    // Add delivery cost and table tax to total
    $total += $delivery_cost + $table_tax;
    
    // Create order
    $user_id = $admin['id'];
    $stmt = $conn->prepare(
        "INSERT INTO orders (order_type, table_id, customer_name, customer_phone, address, deleivery_cost, status, total, user_id, shift_id, table_tax, start_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, NOW())"
    );
    $stmt->bind_param("sisssiidid", $order_type, $table_id, $customer_name, $customer_phone, $address, $delivery_cost, $total, $user_id, $shift_id, $table_tax);
    
    if (!$stmt->execute()) {
        respond('error', 'Failed to create order.');
    }
    
    $order_id = $conn->insert_id;
    
    // Insert order items and update stock
    foreach ($validated_items as $item) {
        // Insert order item
        $stmt = $conn->prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiid", $order_id, $item['product_id'], $item['quantity'], $item['price']);
        $stmt->execute();
        
        // Decrease stock
        $stmt = $conn->prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
        $stmt->bind_param("ii", $item['quantity'], $item['product_id']);
        $stmt->execute();
    }
    
    respond('success', [
        'message' => 'Order created successfully.',
        'order_id' => $order_id,
        'order_type' => $order_type,
        'total' => $total,
        'items_count' => count($validated_items)
    ]);
}

/**
 * Get all orders with optional filters
 * Optional: status, order_type, start_date, end_date, table_id
 */
function getOrders()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $where = [];
    $params = [];
    $types = "";
    
    if (isset($input['status']) && $input['status']) {
        $where[] = "o.status = ?";
        $params[] = $input['status'];
        $types .= "s";
    }
    
    if (isset($input['order_type']) && $input['order_type']) {
        $where[] = "o.order_type = ?";
        $params[] = $input['order_type'];
        $types .= "s";
    }
    
    if (isset($input['table_id']) && $input['table_id']) {
        $where[] = "o.table_id = ?";
        $params[] = (int)$input['table_id'];
        $types .= "i";
    }
    
    if (isset($input['start_date']) && $input['start_date']) {
        $where[] = "DATE(o.created_at) >= ?";
        $params[] = $input['start_date'];
        $types .= "s";
    }
    
    if (isset($input['end_date']) && $input['end_date']) {
        $where[] = "DATE(o.created_at) <= ?";
        $params[] = $input['end_date'];
        $types .= "s";
    }
    
    $sql = "SELECT o.*, u.name as cashier_name, t.table_number 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
            LEFT JOIN tables t ON o.table_id = t.id";
    
    if (count($where) > 0) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    
    $sql .= " ORDER BY o.created_at DESC";
    
    if (count($params) > 0) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $conn->query($sql);
    }
    
    $orders = [];
    while ($row = $result->fetch_assoc()) {
        $orders[] = $row;
    }
    
    respond('success', ['orders' => $orders, 'count' => count($orders)]);
}

/**
 * Get single order with all items
 * Required: id (order_id)
 */
function getOrderById()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    
    $input = requireParams(['id']);
    $order_id = (int)$input['id'];
    
    // Get order details
    $stmt = $conn->prepare(
        "SELECT o.*, u.name as cashier_name, t.table_number 
         FROM orders o 
         LEFT JOIN users u ON o.user_id = u.id 
         LEFT JOIN tables t ON o.table_id = t.id 
         WHERE o.id = ?"
    );
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $order = $orderResult->fetch_assoc();
    
    // Get order items
    $stmt = $conn->prepare(
        "SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.name as product_name, p.stock as current_stock,
                (oi.quantity * oi.price) as item_total
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?"
    );
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $itemsResult = $stmt->get_result();
    
    $items = [];
    while ($item = $itemsResult->fetch_assoc()) {
        $items[] = $item;
    }
    
    $order['items'] = $items;
    
    // Get payments if any
    $stmt = $conn->prepare("SELECT * FROM payments WHERE order_id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $paymentsResult = $stmt->get_result();
    
    $payments = [];
    while ($payment = $paymentsResult->fetch_assoc()) {
        $payments[] = $payment;
    }
    $order['payments'] = $payments;
    
    respond('success', ['order' => $order]);
}

/**
 * Update order details (not items)
 * Required: id
 * Optional: order_type, table_id, customer_name, customer_phone, address, delivery_cost, table_tax, status
 */
function updateOrder()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers or admins can update orders']);
    }
    
    $input = requireParams(['id']);
    $order_id = (int)$input['id'];
    
    // Get current order
    $stmt = $conn->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $current = $orderResult->fetch_assoc();
    
    // Cannot update cancelled or done orders (unless changing status)
    if (($current['status'] === 'cancelled' || $current['status'] === 'done') && !isset($input['status'])) {
        respond('error', 'Cannot update a cancelled or completed order.');
    }
    
    // Get values (use current if not provided)
    $order_type = isset($input['order_type']) ? $input['order_type'] : $current['order_type'];
    $table_id = isset($input['table_id']) ? (int)$input['table_id'] : $current['table_id'];
    $customer_name = isset($input['customer_name']) ? $input['customer_name'] : $current['customer_name'];
    $customer_phone = isset($input['customer_phone']) ? $input['customer_phone'] : $current['customer_phone'];
    $address = isset($input['address']) ? $input['address'] : $current['address'];
    $delivery_cost = isset($input['delivery_cost']) ? (int)$input['delivery_cost'] : $current['deleivery_cost'];
    $table_tax = isset($input['table_tax']) ? (float)$input['table_tax'] : $current['table_tax'];
    $status = isset($input['status']) ? $input['status'] : $current['status'];
    
    // Validate status
    if (!in_array($status, ['pending', 'preparing', 'done', 'cancelled'])) {
        respond('error', 'Invalid status.');
    }
    
    // Handle table changes for dine_in
    if ($order_type === 'dine_in') {
        // If table changed, update both tables
        if ($table_id != $current['table_id']) {
            // Free old table
            if ($current['table_id']) {
                $stmt = $conn->prepare("UPDATE tables SET status = 'available' WHERE id = ?");
                $stmt->bind_param("i", $current['table_id']);
                $stmt->execute();
            }
            // Occupy new table
            $stmt = $conn->prepare("SELECT id, status FROM tables WHERE id = ?");
            $stmt->bind_param("i", $table_id);
            $stmt->execute();
            $tableResult = $stmt->get_result();
            if ($tableResult->num_rows === 0) {
                respond('error', 'Table not found.');
            }
            $table = $tableResult->fetch_assoc();
            if ($table['status'] === 'occupied') {
                respond('error', 'New table is already occupied.');
            }
            $stmt = $conn->prepare("UPDATE tables SET status = 'occupied' WHERE id = ?");
            $stmt->bind_param("i", $table_id);
            $stmt->execute();
        }
    } else {
        // If changing from dine_in to another type, free the table
        if ($current['order_type'] === 'dine_in' && $current['table_id']) {
            $stmt = $conn->prepare("UPDATE tables SET status = 'available' WHERE id = ?");
            $stmt->bind_param("i", $current['table_id']);
            $stmt->execute();
        }
        $table_id = null;
        $table_tax = 0.00;
    }
    
    // Handle status changes
    $end_at = $current['end_at'];
    if ($status === 'done' && $current['status'] !== 'done') {
        $end_at = date('Y-m-d H:i:s');
        // Free table if dine_in
        if ($order_type === 'dine_in' && $table_id) {
            $stmt = $conn->prepare("UPDATE tables SET status = 'available' WHERE id = ?");
            $stmt->bind_param("i", $table_id);
            $stmt->execute();
        }
    }
    
    // Handle cancellation - restore stock
    if ($status === 'cancelled' && $current['status'] !== 'cancelled') {
        // Restore stock for all items
        $stmt = $conn->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
        $stmt->bind_param("i", $order_id);
        $stmt->execute();
        $itemsResult = $stmt->get_result();
        while ($item = $itemsResult->fetch_assoc()) {
            $restoreStmt = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
            $restoreStmt->bind_param("ii", $item['quantity'], $item['product_id']);
            $restoreStmt->execute();
        }
        // Free table if dine_in
        if ($order_type === 'dine_in' && $table_id) {
            $stmt = $conn->prepare("UPDATE tables SET status = 'available' WHERE id = ?");
            $stmt->bind_param("i", $table_id);
            $stmt->execute();
        }
    }
    
    // Recalculate total based on items + delivery_cost + table_tax
    $stmt = $conn->prepare("SELECT SUM(quantity * price) as items_total FROM order_items WHERE order_id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $totalResult = $stmt->get_result()->fetch_assoc();
    $items_total = (float)$totalResult['items_total'];
    $total = $items_total + $delivery_cost + $table_tax;
    
    // Update order
    $stmt = $conn->prepare(
        "UPDATE orders SET order_type = ?, table_id = ?, customer_name = ?, customer_phone = ?, 
         address = ?, deleivery_cost = ?, table_tax = ?, status = ?, total = ?, end_at = ?
         WHERE id = ?"
    );
    $stmt->bind_param("sisssiidssi", $order_type, $table_id, $customer_name, $customer_phone, 
                      $address, $delivery_cost, $table_tax, $status, $total, $end_at, $order_id);
    
    if ($stmt->execute()) {
        respond('success', ['message' => 'Order updated successfully.', 'total' => $total]);
    } else {
        respond('error', 'Failed to update order.');
    }
}

/**
 * Delete an order completely
 * Required: id
 * Only admin can delete, stock is restored
 */
function deleteOrder()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can delete orders']);
    }
    
    $input = requireParams(['id']);
    $order_id = (int)$input['id'];
    
    // Get order
    $stmt = $conn->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $order = $orderResult->fetch_assoc();
    
    // Restore stock for all items (only if not already cancelled)
    if ($order['status'] !== 'cancelled') {
        $stmt = $conn->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
        $stmt->bind_param("i", $order_id);
        $stmt->execute();
        $itemsResult = $stmt->get_result();
        while ($item = $itemsResult->fetch_assoc()) {
            $restoreStmt = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
            $restoreStmt->bind_param("ii", $item['quantity'], $item['product_id']);
            $restoreStmt->execute();
        }
    }
    
    // Free table if dine_in and table is occupied by this order
    if ($order['order_type'] === 'dine_in' && $order['table_id'] && $order['status'] !== 'done' && $order['status'] !== 'cancelled') {
        $stmt = $conn->prepare("UPDATE tables SET status = 'available' WHERE id = ?");
        $stmt->bind_param("i", $order['table_id']);
        $stmt->execute();
    }
    
    // Delete payments
    $stmt = $conn->prepare("DELETE FROM payments WHERE order_id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    
    // Delete returns
    $stmt = $conn->prepare("DELETE FROM returns WHERE order_id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    
    // Delete order items
    $stmt = $conn->prepare("DELETE FROM order_items WHERE order_id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    
    // Delete order
    $stmt = $conn->prepare("DELETE FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    if ($stmt->execute()) {
        respond('success', ['message' => 'Order deleted successfully.']);
    } else {
        respond('error', 'Failed to delete order.');
    }
}

/**
 * Add item(s) to an existing order
 * Required: order_id, items (array of {product_id, quantity})
 */
function addOrderItem()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers or admins can add order items']);
    }
    
    $input = requireParams(['order_id', 'items']);
    $order_id = (int)$input['order_id'];
    $items = $input['items'];
    
    // Get order
    $stmt = $conn->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $order = $orderResult->fetch_assoc();
    
    // Cannot add items to cancelled or done orders
    if ($order['status'] === 'cancelled' || $order['status'] === 'done') {
        respond('error', 'Cannot add items to a cancelled or completed order.');
    }
    
    $added_items = [];
    $added_total = 0.00;
    
    foreach ($items as $item) {
        if (!isset($item['product_id']) || !isset($item['quantity'])) {
            respond('error', 'Each item must have product_id and quantity.');
        }
        $product_id = (int)$item['product_id'];
        $quantity = (int)$item['quantity'];
        
        if ($quantity <= 0) {
            respond('error', 'Quantity must be greater than 0.');
        }
        
        // Get product
        $stmt = $conn->prepare("SELECT id, name, price, stock, is_active FROM products WHERE id = ?");
        $stmt->bind_param("i", $product_id);
        $stmt->execute();
        $productResult = $stmt->get_result();
        
        if ($productResult->num_rows === 0) {
            respond('error', "Product with ID $product_id not found.");
        }
        
        $product = $productResult->fetch_assoc();
        
        if (!$product['is_active']) {
            respond('error', "Product '{$product['name']}' is not available.");
        }
        
        if ($product['stock'] < $quantity) {
            respond('error', "Insufficient stock for '{$product['name']}'. Available: {$product['stock']}");
        }
        
        // Check if item already exists in order
        $stmt = $conn->prepare("SELECT id, quantity FROM order_items WHERE order_id = ? AND product_id = ?");
        $stmt->bind_param("ii", $order_id, $product_id);
        $stmt->execute();
        $existingResult = $stmt->get_result();
        
        if ($existingResult->num_rows > 0) {
            // Update existing item
            $existing = $existingResult->fetch_assoc();
            $new_quantity = $existing['quantity'] + $quantity;
            $stmt = $conn->prepare("UPDATE order_items SET quantity = ? WHERE id = ?");
            $stmt->bind_param("ii", $new_quantity, $existing['id']);
            $stmt->execute();
        } else {
            // Insert new item
            $stmt = $conn->prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("iiid", $order_id, $product_id, $quantity, $product['price']);
            $stmt->execute();
        }
        
        // Decrease stock
        $stmt = $conn->prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
        $stmt->bind_param("ii", $quantity, $product_id);
        $stmt->execute();
        
        $item_total = $quantity * (float)$product['price'];
        $added_total += $item_total;
        
        $added_items[] = [
            'product_name' => $product['name'],
            'quantity' => $quantity,
            'price' => (float)$product['price'],
            'item_total' => $item_total
        ];
    }
    
    // Update order total
    $new_total = (float)$order['total'] + $added_total;
    $stmt = $conn->prepare("UPDATE orders SET total = ? WHERE id = ?");
    $stmt->bind_param("di", $new_total, $order_id);
    $stmt->execute();
    
    respond('success', [
        'message' => 'Items added successfully.',
        'added_items' => $added_items,
        'added_total' => $added_total,
        'new_order_total' => $new_total
    ]);
}

/**
 * Update an order item quantity
 * Required: order_item_id, quantity
 */
function updateOrderItem()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers or admins can update order items']);
    }
    
    $input = requireParams(['order_item_id', 'quantity']);
    $order_item_id = (int)$input['order_item_id'];
    $new_quantity = (int)$input['quantity'];
    
    if ($new_quantity <= 0) {
        respond('error', 'Quantity must be greater than 0. Use deleteOrderItem to remove.');
    }
    
    // Get order item
    $stmt = $conn->prepare(
        "SELECT oi.*, o.status as order_status, p.stock as current_stock, p.name as product_name
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE oi.id = ?"
    );
    $stmt->bind_param("i", $order_item_id);
    $stmt->execute();
    $itemResult = $stmt->get_result();
    
    if ($itemResult->num_rows === 0) {
        respond('error', 'Order item not found.');
    }
    
    $item = $itemResult->fetch_assoc();
    
    // Cannot update items in cancelled or done orders
    if ($item['order_status'] === 'cancelled' || $item['order_status'] === 'done') {
        respond('error', 'Cannot update items in a cancelled or completed order.');
    }
    
    $old_quantity = (int)$item['quantity'];
    $quantity_diff = $new_quantity - $old_quantity;
    
    // Check stock if increasing quantity
    if ($quantity_diff > 0 && $item['current_stock'] < $quantity_diff) {
        respond('error', "Insufficient stock for '{$item['product_name']}'. Available: {$item['current_stock']}");
    }
    
    // Update stock
    $stmt = $conn->prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
    $stmt->bind_param("ii", $quantity_diff, $item['product_id']);
    $stmt->execute();
    
    // Update order item
    $stmt = $conn->prepare("UPDATE order_items SET quantity = ? WHERE id = ?");
    $stmt->bind_param("ii", $new_quantity, $order_item_id);
    $stmt->execute();
    
    // Recalculate order total
    $stmt = $conn->prepare("SELECT SUM(quantity * price) as items_total FROM order_items WHERE order_id = ?");
    $stmt->bind_param("i", $item['order_id']);
    $stmt->execute();
    $totalResult = $stmt->get_result()->fetch_assoc();
    
    // Get order for delivery_cost and table_tax
    $stmt = $conn->prepare("SELECT deleivery_cost, table_tax FROM orders WHERE id = ?");
    $stmt->bind_param("i", $item['order_id']);
    $stmt->execute();
    $orderData = $stmt->get_result()->fetch_assoc();
    
    $new_total = (float)$totalResult['items_total'] + (int)$orderData['deleivery_cost'] + (float)$orderData['table_tax'];
    
    $stmt = $conn->prepare("UPDATE orders SET total = ? WHERE id = ?");
    $stmt->bind_param("di", $new_total, $item['order_id']);
    $stmt->execute();
    
    respond('success', [
        'message' => 'Order item updated successfully.',
        'old_quantity' => $old_quantity,
        'new_quantity' => $new_quantity,
        'new_order_total' => $new_total
    ]);
}

/**
 * Delete an order item
 * Required: order_item_id
 */
function deleteOrderItem()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'cashier' && $admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only cashiers or admins can delete order items']);
    }
    
    $input = requireParams(['order_item_id']);
    $order_item_id = (int)$input['order_item_id'];
    
    // Get order item
    $stmt = $conn->prepare(
        "SELECT oi.*, o.status as order_status, p.name as product_name
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE oi.id = ?"
    );
    $stmt->bind_param("i", $order_item_id);
    $stmt->execute();
    $itemResult = $stmt->get_result();
    
    if ($itemResult->num_rows === 0) {
        respond('error', 'Order item not found.');
    }
    
    $item = $itemResult->fetch_assoc();
    
    // Cannot delete items from cancelled or done orders
    if ($item['order_status'] === 'cancelled' || $item['order_status'] === 'done') {
        respond('error', 'Cannot delete items from a cancelled or completed order.');
    }
    
    // Restore stock
    $stmt = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    $stmt->bind_param("ii", $item['quantity'], $item['product_id']);
    $stmt->execute();
    
    // Delete order item
    $stmt = $conn->prepare("DELETE FROM order_items WHERE id = ?");
    $stmt->bind_param("i", $order_item_id);
    $stmt->execute();
    
    // Recalculate order total
    $stmt = $conn->prepare("SELECT SUM(quantity * price) as items_total FROM order_items WHERE order_id = ?");
    $stmt->bind_param("i", $item['order_id']);
    $stmt->execute();
    $totalResult = $stmt->get_result()->fetch_assoc();
    $items_total = $totalResult['items_total'] ? (float)$totalResult['items_total'] : 0;
    
    // Get order for delivery_cost and table_tax
    $stmt = $conn->prepare("SELECT deleivery_cost, table_tax FROM orders WHERE id = ?");
    $stmt->bind_param("i", $item['order_id']);
    $stmt->execute();
    $orderData = $stmt->get_result()->fetch_assoc();
    
    $new_total = $items_total + (int)$orderData['deleivery_cost'] + (float)$orderData['table_tax'];
    
    $stmt = $conn->prepare("UPDATE orders SET total = ? WHERE id = ?");
    $stmt->bind_param("di", $new_total, $item['order_id']);
    $stmt->execute();
    
    respond('success', [
        'message' => 'Order item deleted successfully.',
        'deleted_item' => $item['product_name'],
        'quantity_restored' => $item['quantity'],
        'new_order_total' => $new_total
    ]);
}

/**
 * Update order status only
 * Required: id, status (pending|preparing|done|cancelled)
 */
function updateOrderStatus()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    
    $input = requireParams(['id', 'status']);
    $order_id = (int)$input['id'];
    $status = $input['status'];
    
    // Validate status
    if (!in_array($status, ['pending', 'preparing', 'done', 'cancelled'])) {
        respond('error', 'Invalid status. Must be pending, preparing, done, or cancelled.');
    }
    
    // Get order
    $stmt = $conn->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $orderResult = $stmt->get_result();
    
    if ($orderResult->num_rows === 0) {
        respond('error', 'Order not found.');
    }
    
    $order = $orderResult->fetch_assoc();
    
    // Cannot change status of already cancelled order
    if ($order['status'] === 'cancelled') {
        respond('error', 'Cannot change status of a cancelled order.');
    }
    
    $end_at = $order['end_at'];
    
    // Handle status to done
    if ($status === 'done' && $order['status'] !== 'done') {
        $end_at = date('Y-m-d H:i:s');
        // Free table if dine_in
        if ($order['order_type'] === 'dine_in' && $order['table_id']) {
            $stmt = $conn->prepare("UPDATE tables SET status = 'available' WHERE id = ?");
            $stmt->bind_param("i", $order['table_id']);
            $stmt->execute();
        }
    }
    
    // Handle cancellation - restore stock
    if ($status === 'cancelled' && $order['status'] !== 'cancelled') {
        $stmt = $conn->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?");
        $stmt->bind_param("i", $order_id);
        $stmt->execute();
        $itemsResult = $stmt->get_result();
        while ($item = $itemsResult->fetch_assoc()) {
            $restoreStmt = $conn->prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
            $restoreStmt->bind_param("ii", $item['quantity'], $item['product_id']);
            $restoreStmt->execute();
        }
        // Free table if dine_in
        if ($order['order_type'] === 'dine_in' && $order['table_id']) {
            $stmt = $conn->prepare("UPDATE tables SET status = 'available' WHERE id = ?");
            $stmt->bind_param("i", $order['table_id']);
            $stmt->execute();
        }
    }
    
    // Update status
    $stmt = $conn->prepare("UPDATE orders SET status = ?, end_at = ? WHERE id = ?");
    $stmt->bind_param("ssi", $status, $end_at, $order_id);
    
    if ($stmt->execute()) {
        respond('success', ['message' => 'Order status updated successfully.', 'new_status' => $status]);
    } else {
        respond('error', 'Failed to update order status.');
    }
}

/**
 * Get orders for kitchen display (pending and preparing orders)
 */
function getKitchenOrders()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    
    $stmt = $conn->prepare(
        "SELECT o.id, o.order_type, o.table_id, o.customer_name, o.status, o.created_at, t.table_number
         FROM orders o
         LEFT JOIN tables t ON o.table_id = t.id
         WHERE o.status IN ('pending', 'preparing')
         ORDER BY o.created_at ASC"
    );
    $stmt->execute();
    $ordersResult = $stmt->get_result();
    
    $orders = [];
    while ($order = $ordersResult->fetch_assoc()) {
        // Get items for each order
        $itemStmt = $conn->prepare(
            "SELECT oi.id, oi.quantity, p.name as product_name
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?"
        );
        $itemStmt->bind_param("i", $order['id']);
        $itemStmt->execute();
        $itemsResult = $itemStmt->get_result();
        
        $items = [];
        while ($item = $itemsResult->fetch_assoc()) {
            $items[] = $item;
        }
        $order['items'] = $items;
        $orders[] = $order;
    }
    
    respond('success', ['orders' => $orders, 'count' => count($orders)]);
}

// ============================================
// ADMIN ANALYTICS & REPORTS FUNCTIONS
// ============================================

/**
 * Get daily sales report
 * Optional: date (default today)
 */
function getDailySalesReport()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view sales reports']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $date = isset($input['date']) ? $input['date'] : date('Y-m-d');
    
    // Get orders summary
    $stmt = $conn->prepare(
        "SELECT 
            COUNT(*) as total_orders,
            COUNT(CASE WHEN status = 'done' THEN 1 END) as completed_orders,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
            COUNT(CASE WHEN status IN ('pending', 'preparing') THEN 1 END) as active_orders,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN deleivery_cost ELSE 0 END), 0) as total_delivery_fees,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN table_tax ELSE 0 END), 0) as total_table_tax
         FROM orders WHERE DATE(created_at) = ?"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $ordersSummary = $stmt->get_result()->fetch_assoc();
    
    // Get revenue by order type
    $stmt = $conn->prepare(
        "SELECT order_type, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
         FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'
         GROUP BY order_type"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $result = $stmt->get_result();
    $revenueByType = [];
    while ($row = $result->fetch_assoc()) {
        $revenueByType[$row['order_type']] = [
            'count' => (int)$row['count'],
            'revenue' => (float)$row['revenue']
        ];
    }
    
    // Get profit calculation (revenue - cost)
    $stmt = $conn->prepare(
        "SELECT 
            COALESCE(SUM(oi.quantity * oi.price), 0) as items_revenue,
            COALESCE(SUM(oi.quantity * p.cost), 0) as items_cost
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE DATE(o.created_at) = ? AND o.status != 'cancelled'"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $profitData = $stmt->get_result()->fetch_assoc();
    $items_profit = (float)$profitData['items_revenue'] - (float)$profitData['items_cost'];
    
    // Get payments breakdown
    $stmt = $conn->prepare(
        "SELECT payment_method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE DATE(p.paid_at) = ?
         GROUP BY payment_method"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $result = $stmt->get_result();
    $paymentsByMethod = [];
    while ($row = $result->fetch_assoc()) {
        $paymentsByMethod[$row['payment_method']] = [
            'count' => (int)$row['count'],
            'total' => (float)$row['total']
        ];
    }
    
    // Get refunds
    $stmt = $conn->prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(refund_amount), 0) as total
         FROM returns WHERE DATE(created_at) = ?"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $refundsData = $stmt->get_result()->fetch_assoc();
    
    // Get expenses (from all shifts on this day)
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(se.amount), 0) as total
         FROM shift_expenses se
         JOIN cashier_shifts cs ON se.shift_id = cs.id
         WHERE DATE(se.created_at) = ?"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $expensesTotal = (float)$stmt->get_result()->fetch_assoc()['total'];
    
    // Get hourly breakdown
    $stmt = $conn->prepare(
        "SELECT HOUR(created_at) as hour, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
         FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'
         GROUP BY HOUR(created_at) ORDER BY hour"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $result = $stmt->get_result();
    $hourlyBreakdown = [];
    while ($row = $result->fetch_assoc()) {
        $hourlyBreakdown[] = [
            'hour' => (int)$row['hour'],
            'hour_formatted' => sprintf('%02d:00', $row['hour']),
            'orders' => (int)$row['orders'],
            'revenue' => (float)$row['revenue']
        ];
    }
    
    // Calculate net profit
    $net_profit = $items_profit + (float)$ordersSummary['total_delivery_fees'] + (float)$ordersSummary['total_table_tax'] 
                  - $expensesTotal - (float)$refundsData['total'];
    
    respond('success', [
        'date' => $date,
        'orders' => [
            'total' => (int)$ordersSummary['total_orders'],
            'completed' => (int)$ordersSummary['completed_orders'],
            'cancelled' => (int)$ordersSummary['cancelled_orders'],
            'active' => (int)$ordersSummary['active_orders']
        ],
        'revenue' => [
            'total' => (float)$ordersSummary['total_revenue'],
            'items' => (float)$profitData['items_revenue'],
            'delivery_fees' => (float)$ordersSummary['total_delivery_fees'],
            'table_tax' => (float)$ordersSummary['total_table_tax'],
            'by_type' => $revenueByType
        ],
        'costs' => [
            'items_cost' => (float)$profitData['items_cost'],
            'expenses' => $expensesTotal,
            'refunds' => (float)$refundsData['total']
        ],
        'profit' => [
            'items_profit' => $items_profit,
            'net_profit' => $net_profit
        ],
        'payments' => $paymentsByMethod,
        'refunds' => [
            'count' => (int)$refundsData['count'],
            'total' => (float)$refundsData['total']
        ],
        'hourly_breakdown' => $hourlyBreakdown
    ]);
}

/**
 * Get sales analytics for a date range
 * Required: start_date, end_date
 */
function getSalesAnalytics()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view analytics']);
    }
    
    $input = requireParams(['start_date', 'end_date']);
    $start_date = $input['start_date'];
    $end_date = $input['end_date'];
    
    // Summary totals
    $stmt = $conn->prepare(
        "SELECT 
            COUNT(*) as total_orders,
            COUNT(CASE WHEN status = 'done' THEN 1 END) as completed_orders,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as total_revenue
         FROM orders WHERE DATE(created_at) BETWEEN ? AND ?"
    );
    $stmt->bind_param("ss", $start_date, $end_date);
    $stmt->execute();
    $summary = $stmt->get_result()->fetch_assoc();
    
    // Profit calculation
    $stmt = $conn->prepare(
        "SELECT 
            COALESCE(SUM(oi.quantity * oi.price), 0) as items_revenue,
            COALESCE(SUM(oi.quantity * p.cost), 0) as items_cost
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.status != 'cancelled'"
    );
    $stmt->bind_param("ss", $start_date, $end_date);
    $stmt->execute();
    $profitData = $stmt->get_result()->fetch_assoc();
    
    // Daily breakdown
    $stmt = $conn->prepare(
        "SELECT DATE(created_at) as date, 
                COUNT(*) as orders,
                COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as revenue
         FROM orders WHERE DATE(created_at) BETWEEN ? AND ?
         GROUP BY DATE(created_at) ORDER BY date"
    );
    $stmt->bind_param("ss", $start_date, $end_date);
    $stmt->execute();
    $result = $stmt->get_result();
    $dailyBreakdown = [];
    while ($row = $result->fetch_assoc()) {
        $dailyBreakdown[] = [
            'date' => $row['date'],
            'orders' => (int)$row['orders'],
            'revenue' => (float)$row['revenue']
        ];
    }
    
    // By order type
    $stmt = $conn->prepare(
        "SELECT order_type, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
         FROM orders WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
         GROUP BY order_type"
    );
    $stmt->bind_param("ss", $start_date, $end_date);
    $stmt->execute();
    $result = $stmt->get_result();
    $byOrderType = [];
    while ($row = $result->fetch_assoc()) {
        $byOrderType[$row['order_type']] = [
            'count' => (int)$row['count'],
            'revenue' => (float)$row['revenue']
        ];
    }
    
    // By payment method
    $stmt = $conn->prepare(
        "SELECT payment_method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE DATE(p.paid_at) BETWEEN ? AND ?
         GROUP BY payment_method"
    );
    $stmt->bind_param("ss", $start_date, $end_date);
    $stmt->execute();
    $result = $stmt->get_result();
    $byPaymentMethod = [];
    while ($row = $result->fetch_assoc()) {
        $byPaymentMethod[$row['payment_method']] = [
            'count' => (int)$row['count'],
            'total' => (float)$row['total']
        ];
    }
    
    // Expenses
    $stmt = $conn->prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM shift_expenses WHERE DATE(created_at) BETWEEN ? AND ?"
    );
    $stmt->bind_param("ss", $start_date, $end_date);
    $stmt->execute();
    $totalExpenses = (float)$stmt->get_result()->fetch_assoc()['total'];
    
    // Refunds
    $stmt = $conn->prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(refund_amount), 0) as total
         FROM returns WHERE DATE(created_at) BETWEEN ? AND ?"
    );
    $stmt->bind_param("ss", $start_date, $end_date);
    $stmt->execute();
    $refunds = $stmt->get_result()->fetch_assoc();
    
    // Calculate averages
    $days_count = count($dailyBreakdown) > 0 ? count($dailyBreakdown) : 1;
    $avg_daily_orders = (int)$summary['total_orders'] / $days_count;
    $avg_daily_revenue = (float)$summary['total_revenue'] / $days_count;
    $avg_order_value = (int)$summary['completed_orders'] > 0 
        ? (float)$summary['total_revenue'] / (int)$summary['completed_orders'] 
        : 0;
    
    $items_profit = (float)$profitData['items_revenue'] - (float)$profitData['items_cost'];
    $net_profit = $items_profit - $totalExpenses - (float)$refunds['total'];
    
    respond('success', [
        'period' => [
            'start_date' => $start_date,
            'end_date' => $end_date,
            'days' => $days_count
        ],
        'summary' => [
            'total_orders' => (int)$summary['total_orders'],
            'completed_orders' => (int)$summary['completed_orders'],
            'cancelled_orders' => (int)$summary['cancelled_orders'],
            'total_revenue' => (float)$summary['total_revenue'],
            'items_cost' => (float)$profitData['items_cost'],
            'items_profit' => $items_profit,
            'expenses' => $totalExpenses,
            'refunds' => (float)$refunds['total'],
            'net_profit' => $net_profit
        ],
        'averages' => [
            'daily_orders' => round($avg_daily_orders, 2),
            'daily_revenue' => round($avg_daily_revenue, 2),
            'order_value' => round($avg_order_value, 2)
        ],
        'by_order_type' => $byOrderType,
        'by_payment_method' => $byPaymentMethod,
        'daily_breakdown' => $dailyBreakdown,
        'refunds_count' => (int)$refunds['count']
    ]);
}

/**
 * Get all shifts with details (for admin)
 * Optional: start_date, end_date, user_id, status
 */
function getAllShifts()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view all shifts']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $where = [];
    $params = [];
    $types = "";
    
    if (isset($input['user_id']) && $input['user_id']) {
        $where[] = "cs.user_id = ?";
        $params[] = (int)$input['user_id'];
        $types .= "i";
    }
    
    if (isset($input['status']) && $input['status']) {
        $where[] = "cs.status = ?";
        $params[] = $input['status'];
        $types .= "s";
    }
    
    if (isset($input['start_date']) && $input['start_date']) {
        $where[] = "DATE(cs.start_time) >= ?";
        $params[] = $input['start_date'];
        $types .= "s";
    }
    
    if (isset($input['end_date']) && $input['end_date']) {
        $where[] = "DATE(cs.start_time) <= ?";
        $params[] = $input['end_date'];
        $types .= "s";
    }
    
    $sql = "SELECT cs.*, u.name as cashier_name, u.email as cashier_email
            FROM cashier_shifts cs
            JOIN users u ON cs.user_id = u.id";
    
    if (count($where) > 0) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    
    $sql .= " ORDER BY cs.start_time DESC";
    
    if (count($params) > 0) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $conn->query($sql);
    }
    
    $shifts = [];
    $totals = [
        'total_sales' => 0,
        'total_cash' => 0,
        'total_card' => 0,
        'total_difference' => 0
    ];
    
    while ($shift = $result->fetch_assoc()) {
        // Get expenses for this shift
        $expStmt = $conn->prepare(
            "SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total 
             FROM shift_expenses WHERE shift_id = ?"
        );
        $expStmt->bind_param("i", $shift['id']);
        $expStmt->execute();
        $expenses = $expStmt->get_result()->fetch_assoc();
        $shift['expenses_count'] = (int)$expenses['count'];
        $shift['expenses_total'] = (float)$expenses['total'];
        
        // Get orders count for this shift
        $orderStmt = $conn->prepare(
            "SELECT COUNT(*) as count FROM orders WHERE shift_id = ? AND status != 'cancelled'"
        );
        $orderStmt->bind_param("i", $shift['id']);
        $orderStmt->execute();
        $shift['orders_count'] = (int)$orderStmt->get_result()->fetch_assoc()['count'];
        
        $shifts[] = $shift;
        
        if ($shift['status'] === 'closed') {
            $totals['total_sales'] += (float)$shift['total_sales'];
            $totals['total_cash'] += (float)$shift['total_cash_payments'];
            $totals['total_card'] += (float)$shift['total_card_payments'];
            $totals['total_difference'] += (float)$shift['difference'];
        }
    }
    
    respond('success', [
        'shifts' => $shifts,
        'count' => count($shifts),
        'totals' => $totals
    ]);
}

/**
 * Get detailed report for a specific shift
 * Required: shift_id
 */
function getShiftReport()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view shift reports']);
    }
    
    $input = requireParams(['shift_id']);
    $shift_id = (int)$input['shift_id'];
    
    // Get shift details
    $stmt = $conn->prepare(
        "SELECT cs.*, u.name as cashier_name, u.email as cashier_email
         FROM cashier_shifts cs
         JOIN users u ON cs.user_id = u.id
         WHERE cs.id = ?"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $shiftResult = $stmt->get_result();
    
    if ($shiftResult->num_rows === 0) {
        respond('error', 'Shift not found.');
    }
    
    $shift = $shiftResult->fetch_assoc();
    
    // Get orders in this shift
    $stmt = $conn->prepare(
        "SELECT o.*, t.table_number
         FROM orders o
         LEFT JOIN tables t ON o.table_id = t.id
         WHERE o.shift_id = ?
         ORDER BY o.created_at ASC"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $ordersResult = $stmt->get_result();
    
    $orders = [];
    $ordersByStatus = ['pending' => 0, 'preparing' => 0, 'done' => 0, 'cancelled' => 0];
    $ordersByType = ['dine_in' => 0, 'takeaway' => 0, 'delivery' => 0];
    
    while ($order = $ordersResult->fetch_assoc()) {
        $orders[] = $order;
        $ordersByStatus[$order['status']]++;
        $ordersByType[$order['order_type']]++;
    }
    
    // Get payments
    $stmt = $conn->prepare(
        "SELECT p.*, o.id as order_id
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.shift_id = ?
         ORDER BY p.paid_at ASC"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $paymentsResult = $stmt->get_result();
    
    $payments = [];
    $paymentsByMethod = ['cash' => 0, 'card' => 0];
    while ($payment = $paymentsResult->fetch_assoc()) {
        $payments[] = $payment;
        $paymentsByMethod[$payment['payment_method']] += (float)$payment['amount'];
    }
    
    // Get expenses
    $stmt = $conn->prepare(
        "SELECT * FROM shift_expenses WHERE shift_id = ? ORDER BY created_at ASC"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $expensesResult = $stmt->get_result();
    
    $expenses = [];
    $totalExpenses = 0;
    while ($expense = $expensesResult->fetch_assoc()) {
        $expenses[] = $expense;
        $totalExpenses += (float)$expense['amount'];
    }
    
    // Get refunds
    $stmt = $conn->prepare(
        "SELECT r.*
         FROM returns r
         JOIN orders o ON r.order_id = o.id
         WHERE o.shift_id = ?
         ORDER BY r.created_at ASC"
    );
    $stmt->bind_param("i", $shift_id);
    $stmt->execute();
    $refundsResult = $stmt->get_result();
    
    $refunds = [];
    $totalRefunds = 0;
    while ($refund = $refundsResult->fetch_assoc()) {
        $refunds[] = $refund;
        $totalRefunds += (float)$refund['refund_amount'];
    }
    
    // Calculate duration
    $duration = null;
    if ($shift['start_time']) {
        $start = new DateTime($shift['start_time']);
        $end = $shift['end_time'] ? new DateTime($shift['end_time']) : new DateTime();
        $diff = $start->diff($end);
        $duration = [
            'hours' => $diff->h + ($diff->days * 24),
            'minutes' => $diff->i,
            'formatted' => sprintf('%02d:%02d', $diff->h + ($diff->days * 24), $diff->i)
        ];
    }
    
    respond('success', [
        'shift' => [
            'id' => $shift['id'],
            'cashier_name' => $shift['cashier_name'],
            'cashier_email' => $shift['cashier_email'],
            'status' => $shift['status'],
            'start_time' => $shift['start_time'],
            'end_time' => $shift['end_time'],
            'duration' => $duration,
            'opening_cash' => (float)$shift['opening_cash'],
            'closing_cash' => (float)$shift['closing_cash'],
            'expected_cash' => (float)$shift['expected_cash'],
            'difference' => (float)$shift['difference'],
            'notes' => $shift['notes']
        ],
        'summary' => [
            'total_sales' => (float)$shift['total_sales'],
            'total_cash_payments' => (float)$shift['total_cash_payments'],
            'total_card_payments' => (float)$shift['total_card_payments'],
            'total_expenses' => $totalExpenses,
            'total_refunds' => $totalRefunds,
            'orders_count' => count($orders)
        ],
        'orders_by_status' => $ordersByStatus,
        'orders_by_type' => $ordersByType,
        'payments_by_method' => $paymentsByMethod,
        'orders' => $orders,
        'payments' => $payments,
        'expenses' => $expenses,
        'refunds' => $refunds
    ]);
}

/**
 * Get top selling products
 * Optional: start_date, end_date, limit (default 10), by (quantity|revenue)
 */
function getTopProducts()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view top products']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $start_date = isset($input['start_date']) ? $input['start_date'] : date('Y-m-d', strtotime('-30 days'));
    $end_date = isset($input['end_date']) ? $input['end_date'] : date('Y-m-d');
    $limit = isset($input['limit']) ? (int)$input['limit'] : 10;
    $sort_by = isset($input['by']) && $input['by'] === 'revenue' ? 'revenue' : 'quantity';
    
    $order_by = $sort_by === 'revenue' ? 'revenue DESC' : 'total_quantity DESC';
    
    $stmt = $conn->prepare(
        "SELECT p.id, p.name, p.category_id, c.name as category_name, p.price, p.cost, p.stock,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.quantity * oi.price) as revenue,
                SUM(oi.quantity * p.cost) as total_cost,
                SUM(oi.quantity * (oi.price - p.cost)) as profit,
                COUNT(DISTINCT o.id) as orders_count
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.status != 'cancelled'
         GROUP BY p.id
         ORDER BY $order_by
         LIMIT ?"
    );
    $stmt->bind_param("ssi", $start_date, $end_date, $limit);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $products = [];
    $rank = 1;
    while ($row = $result->fetch_assoc()) {
        $products[] = [
            'rank' => $rank++,
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'category' => $row['category_name'],
            'price' => (float)$row['price'],
            'current_stock' => (int)$row['stock'],
            'total_quantity_sold' => (int)$row['total_quantity'],
            'revenue' => (float)$row['revenue'],
            'cost' => (float)$row['total_cost'],
            'profit' => (float)$row['profit'],
            'orders_count' => (int)$row['orders_count']
        ];
    }
    
    // Get worst selling products
    $stmt = $conn->prepare(
        "SELECT p.id, p.name, p.stock, 
                COALESCE(SUM(oi.quantity), 0) as total_quantity
         FROM products p
         LEFT JOIN order_items oi ON p.id = oi.product_id
         LEFT JOIN orders o ON oi.order_id = o.id AND DATE(o.created_at) BETWEEN ? AND ? AND o.status != 'cancelled'
         WHERE p.is_active = 1
         GROUP BY p.id
         ORDER BY total_quantity ASC
         LIMIT ?"
    );
    $stmt->bind_param("ssi", $start_date, $end_date, $limit);
    $stmt->execute();
    $worstResult = $stmt->get_result();
    
    $worst_products = [];
    while ($row = $worstResult->fetch_assoc()) {
        $worst_products[] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'stock' => (int)$row['stock'],
            'total_quantity_sold' => (int)$row['total_quantity']
        ];
    }
    
    respond('success', [
        'period' => [
            'start_date' => $start_date,
            'end_date' => $end_date
        ],
        'sorted_by' => $sort_by,
        'top_products' => $products,
        'worst_products' => $worst_products
    ]);
}

/**
 * Get category performance analytics
 * Optional: start_date, end_date
 */
function getCategoryAnalytics()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view category analytics']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $start_date = isset($input['start_date']) ? $input['start_date'] : date('Y-m-d', strtotime('-30 days'));
    $end_date = isset($input['end_date']) ? $input['end_date'] : date('Y-m-d');
    
    $stmt = $conn->prepare(
        "SELECT c.id, c.name,
                COUNT(DISTINCT p.id) as products_count,
                COALESCE(SUM(oi.quantity), 0) as total_quantity,
                COALESCE(SUM(oi.quantity * oi.price), 0) as revenue,
                COALESCE(SUM(oi.quantity * p.cost), 0) as cost,
                COALESCE(SUM(oi.quantity * (oi.price - p.cost)), 0) as profit
         FROM categories c
         LEFT JOIN products p ON c.id = p.category_id
         LEFT JOIN order_items oi ON p.id = oi.product_id
         LEFT JOIN orders o ON oi.order_id = o.id AND DATE(o.created_at) BETWEEN ? AND ? AND o.status != 'cancelled'
         GROUP BY c.id
         ORDER BY revenue DESC"
    );
    $stmt->bind_param("ss", $start_date, $end_date);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $categories = [];
    $total_revenue = 0;
    while ($row = $result->fetch_assoc()) {
        $categories[] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'products_count' => (int)$row['products_count'],
            'total_quantity_sold' => (int)$row['total_quantity'],
            'revenue' => (float)$row['revenue'],
            'cost' => (float)$row['cost'],
            'profit' => (float)$row['profit']
        ];
        $total_revenue += (float)$row['revenue'];
    }
    
    // Calculate percentages
    foreach ($categories as &$cat) {
        $cat['revenue_percentage'] = $total_revenue > 0 ? round(($cat['revenue'] / $total_revenue) * 100, 2) : 0;
    }
    
    respond('success', [
        'period' => [
            'start_date' => $start_date,
            'end_date' => $end_date
        ],
        'total_revenue' => $total_revenue,
        'categories' => $categories
    ]);
}

/**
 * Get cashier performance analytics
 * Optional: start_date, end_date
 */
function getCashierPerformance()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view cashier performance']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $start_date = isset($input['start_date']) ? $input['start_date'] : date('Y-m-d', strtotime('-30 days'));
    $end_date = isset($input['end_date']) ? $input['end_date'] : date('Y-m-d');
    
    // Get all cashiers
    $result = $conn->query("SELECT id, name, email FROM users WHERE role = 'cashier'");
    
    $cashiers = [];
    while ($user = $result->fetch_assoc()) {
        $user_id = $user['id'];
        
        // Get shifts data
        $stmt = $conn->prepare(
            "SELECT COUNT(*) as shifts_count,
                    COALESCE(SUM(total_sales), 0) as total_sales,
                    COALESCE(SUM(total_cash_payments), 0) as total_cash,
                    COALESCE(SUM(total_card_payments), 0) as total_card,
                    COALESCE(SUM(difference), 0) as total_difference
             FROM cashier_shifts
             WHERE user_id = ? AND DATE(start_time) BETWEEN ? AND ? AND status = 'closed'"
        );
        $stmt->bind_param("iss", $user_id, $start_date, $end_date);
        $stmt->execute();
        $shiftsData = $stmt->get_result()->fetch_assoc();
        
        // Get orders data
        $stmt = $conn->prepare(
            "SELECT COUNT(*) as orders_count,
                    COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as orders_total,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
             FROM orders
             WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?"
        );
        $stmt->bind_param("iss", $user_id, $start_date, $end_date);
        $stmt->execute();
        $ordersData = $stmt->get_result()->fetch_assoc();
        
        $cashiers[] = [
            'id' => $user_id,
            'name' => $user['name'],
            'email' => $user['email'],
            'shifts_count' => (int)$shiftsData['shifts_count'],
            'total_sales' => (float)$shiftsData['total_sales'],
            'total_cash_payments' => (float)$shiftsData['total_cash'],
            'total_card_payments' => (float)$shiftsData['total_card'],
            'cash_difference' => (float)$shiftsData['total_difference'],
            'orders_count' => (int)$ordersData['orders_count'],
            'orders_total' => (float)$ordersData['orders_total'],
            'cancelled_orders' => (int)$ordersData['cancelled_orders'],
            'avg_order_value' => (int)$ordersData['orders_count'] > 0 
                ? round((float)$ordersData['orders_total'] / (int)$ordersData['orders_count'], 2) 
                : 0
        ];
    }
    
    // Sort by total sales
    usort($cashiers, function($a, $b) {
        return $b['total_sales'] - $a['total_sales'];
    });
    
    respond('success', [
        'period' => [
            'start_date' => $start_date,
            'end_date' => $end_date
        ],
        'cashiers' => $cashiers
    ]);
}

/**
 * Get dashboard overview for admin
 * Shows today's quick stats
 */
function getAdminDashboard()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    
    $today = date('Y-m-d');
    $yesterday = date('Y-m-d', strtotime('-1 day'));
    $isAdmin = $admin['role'] === 'admin';
    $userId = (int)$admin['id'];
    
    // Today's stats — cashier sees only their own orders
    if ($isAdmin) {
        $stmt = $conn->prepare(
            "SELECT COUNT(*) as orders, 
                    COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as revenue,
                    COUNT(CASE WHEN status = 'pending' OR status = 'preparing' THEN 1 END) as active_orders
             FROM orders WHERE DATE(created_at) = ?"
        );
        $stmt->bind_param("s", $today);
    } else {
        $stmt = $conn->prepare(
            "SELECT COUNT(*) as orders, 
                    COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as revenue,
                    COUNT(CASE WHEN status = 'pending' OR status = 'preparing' THEN 1 END) as active_orders
             FROM orders WHERE DATE(created_at) = ? AND user_id = ?"
        );
        $stmt->bind_param("si", $today, $userId);
    }
    $stmt->execute();
    $todayStats = $stmt->get_result()->fetch_assoc();
    
    // Yesterday's stats for comparison
    if ($isAdmin) {
        $stmtY = $conn->prepare(
            "SELECT COUNT(*) as orders, 
                    COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as revenue
             FROM orders WHERE DATE(created_at) = ?"
        );
        $stmtY->bind_param("s", $yesterday);
    } else {
        $stmtY = $conn->prepare(
            "SELECT COUNT(*) as orders, 
                    COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as revenue
             FROM orders WHERE DATE(created_at) = ? AND user_id = ?"
        );
        $stmtY->bind_param("si", $yesterday, $userId);
    }
    $stmtY->execute();
    $yesterdayStats = $stmtY->get_result()->fetch_assoc();
    
    // Active shifts
    if ($isAdmin) {
        $activeShifts = $conn->query(
            "SELECT cs.id, u.name as cashier_name, cs.start_time, cs.opening_cash
             FROM cashier_shifts cs
             JOIN users u ON cs.user_id = u.id
             WHERE cs.status = 'open'"
        )->fetch_all(MYSQLI_ASSOC);
    } else {
        $stmtS = $conn->prepare(
            "SELECT cs.id, u.name as cashier_name, cs.start_time, cs.opening_cash
             FROM cashier_shifts cs
             JOIN users u ON cs.user_id = u.id
             WHERE cs.status = 'open' AND cs.user_id = ?"
        );
        $stmtS->bind_param("i", $userId);
        $stmtS->execute();
        $activeShifts = $stmtS->get_result()->fetch_all(MYSQLI_ASSOC);
    }
    
    // Low stock alert
    $lowStock = $conn->query(
        "SELECT COUNT(*) as count FROM products WHERE stock <= 10 AND is_active = 1"
    )->fetch_assoc()['count'];
    
    // Today's production
    if ($isAdmin) {
        $stmtP = $conn->prepare(
            "SELECT COALESCE(SUM(quantity), 0) as total FROM kitchen_logs WHERE DATE(created_at) = ?"
        );
        $stmtP->bind_param("s", $today);
    } else {
        $stmtP = $conn->prepare(
            "SELECT COALESCE(SUM(quantity), 0) as total FROM kitchen_logs WHERE DATE(created_at) = ? AND user_id = ?"
        );
        $stmtP->bind_param("si", $today, $userId);
    }
    $stmtP->execute();
    $todayProduction = (int)$stmtP->get_result()->fetch_assoc()['total'];
    
    // Recent orders
    if ($isAdmin) {
        $recentOrders = $conn->query(
            "SELECT o.id, o.order_type, o.status, o.total, o.created_at, t.table_number
             FROM orders o
             LEFT JOIN tables t ON o.table_id = t.id
             ORDER BY o.created_at DESC LIMIT 5"
        )->fetch_all(MYSQLI_ASSOC);
    } elseif ($admin['role'] === 'kitchen') {
        // Kitchen sees today's done orders with their items
        $stmtR = $conn->prepare(
            "SELECT o.id, o.order_type, o.status, o.total, o.created_at, t.table_number
             FROM orders o
             LEFT JOIN tables t ON o.table_id = t.id
             WHERE o.status = 'done' AND DATE(o.created_at) = ?
             ORDER BY o.created_at DESC LIMIT 10"
        );
        $stmtR->bind_param("s", $today);
        $stmtR->execute();
        $recentOrders = $stmtR->get_result()->fetch_all(MYSQLI_ASSOC);
        // Attach items to each order
        foreach ($recentOrders as &$order) {
            $stmtItems = $conn->prepare(
                "SELECT oi.quantity, p.name as product_name
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?"
            );
            $stmtItems->bind_param("i", $order['id']);
            $stmtItems->execute();
            $order['items'] = $stmtItems->get_result()->fetch_all(MYSQLI_ASSOC);
        }
        unset($order);
    } else {
        $stmtR = $conn->prepare(
            "SELECT o.id, o.order_type, o.status, o.total, o.created_at, t.table_number
             FROM orders o
             LEFT JOIN tables t ON o.table_id = t.id
             WHERE o.user_id = ? AND DATE(o.created_at) = ?
             ORDER BY o.created_at DESC LIMIT 5"
        );
        $stmtR->bind_param("is", $userId, $today);
        $stmtR->execute();
        $recentOrders = $stmtR->get_result()->fetch_all(MYSQLI_ASSOC);
    }
    
    // Calculate growth
    $revenue_change = (float)$yesterdayStats['revenue'] > 0 
        ? round((((float)$todayStats['revenue'] - (float)$yesterdayStats['revenue']) / (float)$yesterdayStats['revenue']) * 100, 2)
        : 0;
    
    $orders_change = (int)$yesterdayStats['orders'] > 0 
        ? round((((int)$todayStats['orders'] - (int)$yesterdayStats['orders']) / (int)$yesterdayStats['orders']) * 100, 2)
        : 0;
    
    respond('success', [
        'today' => [
            'date' => $today,
            'orders' => (int)$todayStats['orders'],
            'revenue' => (float)$todayStats['revenue'],
            'active_orders' => (int)$todayStats['active_orders']
        ],
        'comparison' => [
            'revenue_change_percent' => $revenue_change,
            'orders_change_percent' => $orders_change
        ],
        'active_shifts' => $activeShifts,
        'active_shifts_count' => count($activeShifts),
        'alerts' => [
            'low_stock_products' => (int)$lowStock
        ],
        'production_today' => $todayProduction,
        'recent_orders' => $recentOrders
    ]);
}

// ============================================
// INVENTORY MANAGEMENT
// ============================================

/**
 * Adjust inventory with reason
 * Required: product_id, adjustment (positive to add, negative to subtract), reason
 * Optional: notes
 */
function adjustInventory()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin' && $admin['role'] !== 'kitchen') {
        respond(403, ['error' => 'Only admins and kitchen staff can adjust inventory']);
    }
    
    $input = requireParams(['product_id', 'adjustment', 'reason']);
    $product_id = (int)$input['product_id'];
    $adjustment = (int)$input['adjustment'];
    $reason = $input['reason'];
    $notes = isset($input['notes']) ? $input['notes'] : null;
    
    if ($adjustment === 0) {
        respond('error', 'Adjustment cannot be zero.');
    }
    
    // Get current product
    $stmt = $conn->prepare("SELECT id, name, stock FROM products WHERE id = ?");
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    $productResult = $stmt->get_result();
    
    if ($productResult->num_rows === 0) {
        respond('error', 'Product not found.');
    }
    
    $product = $productResult->fetch_assoc();
    $old_stock = (int)$product['stock'];
    $new_stock = $old_stock + $adjustment;
    
    if ($new_stock < 0) {
        respond('error', 'Adjustment would result in negative stock. Current stock: ' . $old_stock);
    }
    
    // Update product stock
    $stmt = $conn->prepare("UPDATE products SET stock = ? WHERE id = ?");
    $stmt->bind_param("ii", $new_stock, $product_id);
    $stmt->execute();
    
    // Log the adjustment
    $adjustment_type = $adjustment > 0 ? 'add' : 'subtract';
    $stmt = $conn->prepare(
        "INSERT INTO inventory_adjustments (product_id, user_id, adjustment_type, quantity, old_stock, new_stock, reason, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $abs_adjustment = abs($adjustment);
    $stmt->bind_param("iisisiss", $product_id, $admin['id'], $adjustment_type, $abs_adjustment, $old_stock, $new_stock, $reason, $notes);
    $stmt->execute();
    $adjustment_id = $conn->insert_id;
    
    respond('success', [
        'message' => 'Inventory adjusted successfully.',
        'adjustment_id' => $adjustment_id,
        'product' => [
            'id' => $product_id,
            'name' => $product['name'],
            'old_stock' => $old_stock,
            'new_stock' => $new_stock,
            'adjustment' => $adjustment
        ]
    ]);
}

/**
 * Get inventory adjustment history
 * Optional: product_id, start_date, end_date, reason, limit
 */
function getInventoryAdjustments()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view inventory adjustments']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $where = [];
    $params = [];
    $types = "";
    
    if (isset($input['product_id']) && $input['product_id']) {
        $where[] = "ia.product_id = ?";
        $params[] = (int)$input['product_id'];
        $types .= "i";
    }
    
    if (isset($input['reason']) && $input['reason']) {
        $where[] = "ia.reason LIKE ?";
        $params[] = '%' . $input['reason'] . '%';
        $types .= "s";
    }
    
    if (isset($input['start_date']) && $input['start_date']) {
        $where[] = "DATE(ia.created_at) >= ?";
        $params[] = $input['start_date'];
        $types .= "s";
    }
    
    if (isset($input['end_date']) && $input['end_date']) {
        $where[] = "DATE(ia.created_at) <= ?";
        $params[] = $input['end_date'];
        $types .= "s";
    }
    
    $limit = isset($input['limit']) ? (int)$input['limit'] : 100;
    
    $sql = "SELECT ia.*, p.name as product_name, u.name as user_name
            FROM inventory_adjustments ia
            JOIN products p ON ia.product_id = p.id
            JOIN users u ON ia.user_id = u.id";
    
    if (count($where) > 0) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    
    $sql .= " ORDER BY ia.created_at DESC LIMIT ?";
    $params[] = $limit;
    $types .= "i";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $adjustments = [];
    while ($row = $result->fetch_assoc()) {
        $adjustments[] = $row;
    }
    
    respond('success', [
        'adjustments' => $adjustments,
        'count' => count($adjustments)
    ]);
}

/**
 * Get comprehensive end of day report
 * Optional: date (default today)
 */
function getEndOfDayReport()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can view end of day reports']);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $date = isset($input['date']) ? $input['date'] : date('Y-m-d');
    
    // ===== SALES SUMMARY =====
    $stmt = $conn->prepare(
        "SELECT 
            COUNT(*) as total_orders,
            COUNT(CASE WHEN status = 'done' THEN 1 END) as completed_orders,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as gross_sales,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN deleivery_cost ELSE 0 END), 0) as delivery_fees,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN table_tax ELSE 0 END), 0) as table_tax
         FROM orders WHERE DATE(created_at) = ?"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $salesSummary = $stmt->get_result()->fetch_assoc();
    
    // ===== BY ORDER TYPE =====
    $stmt = $conn->prepare(
        "SELECT order_type, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
         FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'
         GROUP BY order_type"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $result = $stmt->get_result();
    $byOrderType = [];
    while ($row = $result->fetch_assoc()) {
        $byOrderType[$row['order_type']] = [
            'count' => (int)$row['count'],
            'revenue' => (float)$row['revenue']
        ];
    }
    
    // ===== PAYMENTS =====
    $stmt = $conn->prepare(
        "SELECT payment_method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
         FROM payments WHERE DATE(paid_at) = ?
         GROUP BY payment_method"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $result = $stmt->get_result();
    $payments = ['cash' => 0, 'card' => 0];
    $paymentsCount = ['cash' => 0, 'card' => 0];
    while ($row = $result->fetch_assoc()) {
        $payments[$row['payment_method']] = (float)$row['total'];
        $paymentsCount[$row['payment_method']] = (int)$row['count'];
    }
    
    // ===== REFUNDS =====
    $stmt = $conn->prepare(
        "SELECT COUNT(*) as count, COALESCE(SUM(refund_amount), 0) as total
         FROM returns WHERE DATE(created_at) = ?"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $refunds = $stmt->get_result()->fetch_assoc();
    
    // ===== EXPENSES =====
    $stmt = $conn->prepare(
        "SELECT se.*, cs.user_id, u.name as cashier_name
         FROM shift_expenses se
         JOIN cashier_shifts cs ON se.shift_id = cs.id
         JOIN users u ON cs.user_id = u.id
         WHERE DATE(se.created_at) = ?
         ORDER BY se.created_at"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $expensesResult = $stmt->get_result();
    $expenses = [];
    $totalExpenses = 0;
    while ($exp = $expensesResult->fetch_assoc()) {
        $expenses[] = $exp;
        $totalExpenses += (float)$exp['amount'];
    }
    
    // ===== PROFIT CALCULATION =====
    $stmt = $conn->prepare(
        "SELECT 
            COALESCE(SUM(oi.quantity * oi.price), 0) as items_revenue,
            COALESCE(SUM(oi.quantity * p.cost), 0) as items_cost
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE DATE(o.created_at) = ? AND o.status != 'cancelled'"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $profitData = $stmt->get_result()->fetch_assoc();
    $gross_profit = (float)$profitData['items_revenue'] - (float)$profitData['items_cost'];
    $net_profit = $gross_profit + (float)$salesSummary['delivery_fees'] + (float)$salesSummary['table_tax'] 
                  - $totalExpenses - (float)$refunds['total'];
    
    // ===== SHIFTS SUMMARY =====
    $stmt = $conn->prepare(
        "SELECT cs.*, u.name as cashier_name,
                (SELECT COUNT(*) FROM orders WHERE shift_id = cs.id AND status != 'cancelled') as orders_count,
                (SELECT COALESCE(SUM(amount), 0) FROM shift_expenses WHERE shift_id = cs.id) as expenses
         FROM cashier_shifts cs
         JOIN users u ON cs.user_id = u.id
         WHERE DATE(cs.start_time) = ?
         ORDER BY cs.start_time"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $shiftsResult = $stmt->get_result();
    $shifts = [];
    $totalDifference = 0;
    while ($shift = $shiftsResult->fetch_assoc()) {
        $shifts[] = $shift;
        $totalDifference += (float)$shift['difference'];
    }
    
    // ===== TOP PRODUCTS =====
    $stmt = $conn->prepare(
        "SELECT p.id, p.name, SUM(oi.quantity) as quantity_sold, SUM(oi.quantity * oi.price) as revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE DATE(o.created_at) = ? AND o.status != 'cancelled'
         GROUP BY p.id
         ORDER BY quantity_sold DESC
         LIMIT 10"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $topProducts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    
    // ===== PRODUCTION =====
    $stmt = $conn->prepare(
        "SELECT p.name, SUM(kl.quantity) as produced
         FROM kitchen_logs kl
         JOIN products p ON kl.product_id = p.id
         WHERE DATE(kl.created_at) = ?
         GROUP BY kl.product_id
         ORDER BY produced DESC"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $production = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    
    // ===== INVENTORY ADJUSTMENTS =====
    $stmt = $conn->prepare(
        "SELECT ia.*, p.name as product_name, u.name as user_name
         FROM inventory_adjustments ia
         JOIN products p ON ia.product_id = p.id
         JOIN users u ON ia.user_id = u.id
         WHERE DATE(ia.created_at) = ?
         ORDER BY ia.created_at"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $inventoryAdjustments = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    
    // ===== HOURLY BREAKDOWN =====
    $stmt = $conn->prepare(
        "SELECT HOUR(created_at) as hour, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
         FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'
         GROUP BY HOUR(created_at) ORDER BY hour"
    );
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $hourlyResult = $stmt->get_result();
    $hourlyBreakdown = [];
    $peakHour = null;
    $peakOrders = 0;
    while ($row = $hourlyResult->fetch_assoc()) {
        $hourlyBreakdown[] = [
            'hour' => sprintf('%02d:00', $row['hour']),
            'orders' => (int)$row['orders'],
            'revenue' => (float)$row['revenue']
        ];
        if ((int)$row['orders'] > $peakOrders) {
            $peakOrders = (int)$row['orders'];
            $peakHour = sprintf('%02d:00', $row['hour']);
        }
    }
    
    respond('success', [
        'report_date' => $date,
        'generated_at' => date('Y-m-d H:i:s'),
        'sales' => [
            'total_orders' => (int)$salesSummary['total_orders'],
            'completed_orders' => (int)$salesSummary['completed_orders'],
            'cancelled_orders' => (int)$salesSummary['cancelled_orders'],
            'gross_sales' => (float)$salesSummary['gross_sales'],
            'delivery_fees' => (float)$salesSummary['delivery_fees'],
            'table_tax' => (float)$salesSummary['table_tax'],
            'by_order_type' => $byOrderType
        ],
        'payments' => [
            'cash' => [
                'count' => $paymentsCount['cash'],
                'total' => $payments['cash']
            ],
            'card' => [
                'count' => $paymentsCount['card'],
                'total' => $payments['card']
            ],
            'total_collected' => $payments['cash'] + $payments['card']
        ],
        'refunds' => [
            'count' => (int)$refunds['count'],
            'total' => (float)$refunds['total']
        ],
        'expenses' => [
            'count' => count($expenses),
            'total' => $totalExpenses,
            'details' => $expenses
        ],
        'profit' => [
            'items_revenue' => (float)$profitData['items_revenue'],
            'items_cost' => (float)$profitData['items_cost'],
            'gross_profit' => $gross_profit,
            'net_profit' => $net_profit
        ],
        'shifts' => [
            'count' => count($shifts),
            'total_cash_difference' => $totalDifference,
            'details' => $shifts
        ],
        'top_products' => $topProducts,
        'production' => $production,
        'inventory_adjustments' => $inventoryAdjustments,
        'hourly_breakdown' => $hourlyBreakdown,
        'peak_hour' => $peakHour
    ]);
}

/**
 * Export report data to CSV format
 * Required: report_type (orders|products|shifts|payments|inventory_adjustments)
 * Optional: start_date, end_date
 */
function exportReport()
{
    global $conn;
    $admin = getAdmin();
    if (!$admin) {
        respond(403, ['error' => 'Unauthorized']);
    }
    if ($admin['role'] !== 'admin') {
        respond(403, ['error' => 'Only admins can export reports']);
    }
    
    $input = requireParams(['report_type']);
    $report_type = $input['report_type'];
    $start_date = isset($input['start_date']) ? $input['start_date'] : date('Y-m-d', strtotime('-30 days'));
    $end_date = isset($input['end_date']) ? $input['end_date'] : date('Y-m-d');
    
    $valid_types = ['orders', 'products', 'shifts', 'payments', 'inventory_adjustments'];
    if (!in_array($report_type, $valid_types)) {
        respond('error', 'Invalid report type. Valid types: ' . implode(', ', $valid_types));
    }
    
    $csv_data = [];
    $headers = [];
    
    switch ($report_type) {
        case 'orders':
            $headers = ['ID', 'Order Type', 'Status', 'Table', 'Customer Name', 'Customer Phone', 
                        'Address', 'Delivery Cost', 'Table Tax', 'Total', 'Created At'];
            $stmt = $conn->prepare(
                "SELECT o.id, o.order_type, o.status, t.table_number, o.customer_name, o.customer_phone,
                        o.address, o.deleivery_cost, o.table_tax, o.total, o.created_at
                 FROM orders o
                 LEFT JOIN tables t ON o.table_id = t.id
                 WHERE DATE(o.created_at) BETWEEN ? AND ?
                 ORDER BY o.created_at"
            );
            $stmt->bind_param("ss", $start_date, $end_date);
            $stmt->execute();
            $result = $stmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $csv_data[] = array_values($row);
            }
            break;
            
        case 'products':
            $headers = ['ID', 'Name', 'Category', 'Price', 'Cost', 'Stock', 'Quantity Sold', 'Revenue', 'Profit'];
            $stmt = $conn->prepare(
                "SELECT p.id, p.name, c.name as category, p.price, p.cost, p.stock,
                        COALESCE(SUM(oi.quantity), 0) as quantity_sold,
                        COALESCE(SUM(oi.quantity * oi.price), 0) as revenue,
                        COALESCE(SUM(oi.quantity * (oi.price - p.cost)), 0) as profit
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 LEFT JOIN order_items oi ON p.id = oi.product_id
                 LEFT JOIN orders o ON oi.order_id = o.id AND DATE(o.created_at) BETWEEN ? AND ? AND o.status != 'cancelled'
                 GROUP BY p.id
                 ORDER BY quantity_sold DESC"
            );
            $stmt->bind_param("ss", $start_date, $end_date);
            $stmt->execute();
            $result = $stmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $csv_data[] = array_values($row);
            }
            break;
            
        case 'shifts':
            $headers = ['ID', 'Cashier', 'Start Time', 'End Time', 'Opening Cash', 'Closing Cash', 
                        'Expected Cash', 'Difference', 'Total Sales', 'Cash Payments', 'Card Payments', 'Status'];
            $stmt = $conn->prepare(
                "SELECT cs.id, u.name, cs.start_time, cs.end_time, cs.opening_cash, cs.closing_cash,
                        cs.expected_cash, cs.difference, cs.total_sales, cs.total_cash_payments, 
                        cs.total_card_payments, cs.status
                 FROM cashier_shifts cs
                 JOIN users u ON cs.user_id = u.id
                 WHERE DATE(cs.start_time) BETWEEN ? AND ?
                 ORDER BY cs.start_time"
            );
            $stmt->bind_param("ss", $start_date, $end_date);
            $stmt->execute();
            $result = $stmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $csv_data[] = array_values($row);
            }
            break;
            
        case 'payments':
            $headers = ['ID', 'Order ID', 'Amount', 'Payment Method', 'Paid At'];
            $stmt = $conn->prepare(
                "SELECT p.id, p.order_id, p.amount, p.payment_method, p.paid_at
                 FROM payments p
                 WHERE DATE(p.paid_at) BETWEEN ? AND ?
                 ORDER BY p.paid_at"
            );
            $stmt->bind_param("ss", $start_date, $end_date);
            $stmt->execute();
            $result = $stmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $csv_data[] = array_values($row);
            }
            break;
            
        case 'inventory_adjustments':
            $headers = ['ID', 'Product', 'User', 'Type', 'Quantity', 'Old Stock', 'New Stock', 'Reason', 'Notes', 'Created At'];
            $stmt = $conn->prepare(
                "SELECT ia.id, p.name, u.name, ia.adjustment_type, ia.quantity, ia.old_stock, 
                        ia.new_stock, ia.reason, ia.notes, ia.created_at
                 FROM inventory_adjustments ia
                 JOIN products p ON ia.product_id = p.id
                 JOIN users u ON ia.user_id = u.id
                 WHERE DATE(ia.created_at) BETWEEN ? AND ?
                 ORDER BY ia.created_at"
            );
            $stmt->bind_param("ss", $start_date, $end_date);
            $stmt->execute();
            $result = $stmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $csv_data[] = array_values($row);
            }
            break;
            
    }
    
    // Generate CSV string
    $output = fopen('php://temp', 'r+');
    fputcsv($output, $headers);
    foreach ($csv_data as $row) {
        fputcsv($output, $row);
    }
    rewind($output);
    $csv_string = stream_get_contents($output);
    fclose($output);
    
    respond('success', [
        'report_type' => $report_type,
        'period' => [
            'start_date' => $start_date,
            'end_date' => $end_date
        ],
        'rows' => count($csv_data),
        'filename' => $report_type . '_' . $start_date . '_to_' . $end_date . '.csv',
        'csv' => $csv_string
    ]);
}

/*


-- Database: `royal`
--

-- --------------------------------------------------------

--
-- Table structure for table `cashier_shifts`
--

CREATE TABLE `cashier_shifts` (
  `id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `opening_cash` decimal(10,2) NOT NULL,
  `closing_cash` decimal(10,2) DEFAULT NULL,
  `total_sales` decimal(10,2) DEFAULT '0.00',
  `total_cash_payments` decimal(10,2) DEFAULT '0.00',
  `total_card_payments` decimal(10,2) DEFAULT '0.00',
  `expected_cash` decimal(10,2) DEFAULT '0.00',
  `difference` decimal(10,2) DEFAULT '0.00',
  `status` enum('open','closed') DEFAULT 'open',
  `notes` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int NOT NULL,
  `name` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `kitchen_logs`
--

CREATE TABLE `kitchen_logs` (
  `id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int NOT NULL,
  `order_type` enum('dine_in','takeaway','delivery') DEFAULT NULL,
  `table_id` int DEFAULT NULL,
  `customer_name` varchar(100) DEFAULT NULL,
  `customer_phone` varchar(20) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `deleivery_cost` int DEFAULT '0',
  `status` enum('pending','preparing','done','cancelled') DEFAULT 'pending',
  `total` decimal(10,2) DEFAULT '0.00',
  `user_id` int DEFAULT NULL,
  `shift_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `start_at` timestamp NULL DEFAULT NULL,
  `end_at` timestamp NULL DEFAULT NULL,
  `table_tax` decimal(10,2) DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int NOT NULL,
  `order_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int NOT NULL,
  `order_id` int DEFAULT NULL,
  `payment_method` enum('cash','card') DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `category_id` int DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `cost` decimal(10,2) DEFAULT NULL,
  `stock` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `returns`
--

CREATE TABLE `returns` (
  `id` int NOT NULL,
  `order_id` int DEFAULT NULL,
  `reason` text,
  `refund_amount` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` int NOT NULL,
  `token` text NOT NULL,
  `user_id` int NOT NULL,
  `status` text NOT NULL,
  `created_at` timestamp NOT NULL,
  `expire_at` timestamp NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `shift_expenses`
--

CREATE TABLE `shift_expenses` (
  `id` int NOT NULL,
  `shift_id` int DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `tables`
--

CREATE TABLE `tables` (
  `id` int NOT NULL,
  `table_number` int DEFAULT NULL,
  `status` enum('available','occupied') DEFAULT 'available'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_adjustments`
--

CREATE TABLE `inventory_adjustments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `user_id` int NOT NULL,
  `adjustment_type` enum('add','subtract') NOT NULL,
  `quantity` int NOT NULL,
  `old_stock` int NOT NULL,
  `new_stock` int NOT NULL,
  `reason` varchar(255) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `user_id` (`user_id`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cashier_shifts`
--
ALTER TABLE `cashier_shifts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `kitchen_logs`
--
ALTER TABLE `kitchen_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `returns`
--
ALTER TABLE `returns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `shift_expenses`
--
ALTER TABLE `shift_expenses`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tables`
--
ALTER TABLE `tables`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `table_number` (`table_number`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `cashier_shifts`
--
ALTER TABLE `cashier_shifts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `kitchen_logs`
--
ALTER TABLE `kitchen_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `returns`
--
ALTER TABLE `returns`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sessions`
--
ALTER TABLE `sessions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `shift_expenses`
--
 ALTER TABLE `shift_expenses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tables`
--
ALTER TABLE `tables`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `cashier_shifts`
--
ALTER TABLE `cashier_shifts`
  ADD CONSTRAINT `cashier_shifts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `returns`
--
ALTER TABLE `returns`
  ADD CONSTRAINT `returns_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);
COMMIT;
*/