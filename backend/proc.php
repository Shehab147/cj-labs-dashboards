<?php
/*


   ________                __  _      __     __          __        
  / ____/ /___  __  ______/ / (_)__  / /_   / /   ____ _/ /_  _____
 / /   / / __ \/ / / / __  / / / _ \/ __/  / /   / __ `/ __ \/ ___/
/ /___/ / /_/ / /_/ / /_/ / / /  __/ /_   / /___/ /_/ / /_/ (__  ) 
\____/_/\____/\__,_/\__,_/_/ /\___/\__/  /_____/\__,_/_.___/____/  
                        /___/                                      


                        X-space
            --------------------------------------
    
    All actions sent via GET param: processor.php?action=action_name
    Authentication via X-Authorization header (Bearer token)

*/
require_once 'config.php';

// Action routing
if(!isset($_GET['action'])){
    respond('error', 'No action specified.');
}

$action = $_GET['action'];

if(!function_exists($action)){
    respond('error', 'Invalid action: ' . $action);
}

try {
    $action();
} catch (Exception $e) {
    respond('error', 'Error: ' . $e->getMessage());
}



//admin login 
function login(){
    global $conn;
    $input = requireParams(['email', 'password']);
    $email = $input['email'];
    $password = $input['password'];
    $hashedPassword = md5($password); // Simple MD5 hash for demonstration; use stronger hashing in production

    $stmt = $conn->prepare("SELECT id,name ,email ,role, status FROM admins WHERE email = ? AND password = ?");

    $stmt->bind_param("ss", $email, $hashedPassword);
    $stmt->execute();   
    $result = $stmt->get_result();
    if($result->num_rows == 0){ 
        respond('error', 'Invalid email or password.');
    }
    $admin = $result->fetch_assoc();
    $stmt->close();
    // Create session token

    $token = bin2hex(random_bytes(16));
    $expireAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
    $stmt = $conn->prepare("INSERT INTO session (admin_id, token, expire_at, status) VALUES (?, ?, ?, 'active')");
    $stmt->bind_param("iss", $admin['id'], $token, $expireAt);
    $stmt->execute();
    $stmt->close();
    setcookie('x-authorization', $token, time() + 86400, '/', '', false, true);
if ($admin['role'] == 'superadmin') {
        // For superadmin, we can return all their active sessions
        $stmt = $conn->prepare("SELECT id, token, expire_at FROM session WHERE admin_id = ? AND status = 'active'");
        $stmt->bind_param("i", $admin['id']);
        $stmt->execute();
        $sessionsResult = $stmt->get_result();
        $sessions = [];
        while ($row = $sessionsResult->fetch_assoc()) {
            $sessions[] = [
                'id' => $row['id'],
                'token' => $row['token'],
                'expire_at' => $row['expire_at']
            ];
        }
        $stmt->close();
        
        respond('success', [
            'token' => $token, 
            'admin' => $admin,
            'sessions' => $sessions
        ]);
    }
    // Start shift and get result
    $shiftResult = startShift($admin, false); // false = don't respond, return data
    
    respond('success', [
        'token' => $token, 
        'admin' => $admin,
        'shift' => $shiftResult
    ]);
}
function logout(){
    global $conn;
    $token = getToken();
    if(!$token){
        respond('error', 'No authorization token provided.');
    }
    
    // End shift BEFORE invalidating session (so getAdmin() still works)
    endShift(null, false);
    
    // Now invalidate the session
    $stmt = $conn->prepare("UPDATE session SET status = 'inactive' WHERE token = ?");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $stmt->close();
    setcookie('x-authorization', '', time() - 3600, '/', '', false, true);
    respond('success', 'Logged out successfully.'); 
}

function startShift($admin = null, $shouldRespond = true){
    global $conn;
    if ($admin === null) {
        $adminData = getAdmin();
        $adminId = $adminData['id'];
    } else {
        // If $admin is passed as an array, use it; if it's just an ID, use it directly
        if (is_array($admin)) {
            $adminId = $admin['id'];
        } else {
            $adminId = $admin; // Admin ID passed directly
        }
    }
    
    
    // Check if admin already has an active shift
    $stmt = $conn->prepare("
        SELECT id, started_at 
        FROM shifts 
        WHERE admin_id = ? 
        AND ended_at IS NULL 
        ORDER BY started_at DESC 
        LIMIT 1
    ");
    $stmt->bind_param("i", $adminId);
    $stmt->execute();
    $result = $stmt->get_result();
    $activeShift = $result->fetch_assoc();
    $stmt->close();
    
    if($activeShift){
        // Auto-end the existing active shift before starting a new one
        $current_time = date('Y-m-d H:i:s');
        $shiftId = $activeShift['id'];
        $started_at_old = $activeShift['started_at'];
        
        // Calculate duration and set reasonable defaults
        $start = new DateTime($started_at_old);
        $end = new DateTime($current_time);
        $duration = $start->diff($end);
        $durationHours = $duration->h + ($duration->days * 24) + ($duration->i / 60);
        
        // End the previous shift with default values
        $stmt = $conn->prepare("
            UPDATE shifts 
            SET ended_at = ?,
                closing_cash = opening_cash,
                total_revenue = 0,
                total_orders = 0,
                total_bookings = 0,
                total_discount = 0,
                cash_difference = 0,
                duration_hours = ?,
                notes = CONCAT(COALESCE(notes, ''), '\nAuto-ended due to new login at ', ?),
                status = 'completed'
            WHERE id = ?
        ");
        $stmt->bind_param("sdsi", $current_time, $durationHours, $current_time, $shiftId);
        $stmt->execute();
        $stmt->close();
    }
    
    // Get input for optional start time and opening cash
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $started_at = isset($input['started_at']) ? $input['started_at'] : date('Y-m-d H:i:s');
    $opening_cash = isset($input['opening_cash']) ? (float)$input['opening_cash'] : 0;
    $notes = isset($input['notes']) ? $input['notes'] : '';
    
    // Get admin data for response (if not already available)
    if ($admin === null || !is_array($admin)) {
        $adminData = getAdmin();
    } else {
        $adminData = $admin;
    }
    
    // Create new shift
    $stmt = $conn->prepare("
        INSERT INTO shifts (admin_id, started_at, opening_cash, notes, status) 
        VALUES (?, ?, ?, ?, 'active')
    ");
    $stmt->bind_param("isds", $adminId, $started_at, $opening_cash, $notes);
    $stmt->execute();
    $shiftId = $conn->insert_id;
    $stmt->close();
    
    $result = [
        'message' => 'Shift started successfully.',
        'shift_id' => $shiftId,
        'admin' => [
            'id' => $adminData['id'],
            'name' => $adminData['name'],
            'role' => $adminData['role']
        ],
        'started_at' => $started_at,
        'opening_cash' => $opening_cash,
        'notes' => $notes
    ];
    
    if ($shouldRespond) {
        respond('success', $result);
    } else {
        return $result;
    }
}

/**
 * End current shift
 * Closes the active shift and calculates all income/expenses
 */
function endShift($admin = null, $shouldRespond = true){
    global $conn;
    
    if ($admin === null) {
        $admin = getAdmin();
    }
    $adminId = $admin['id'];
    
    // Get active shift
    $stmt = $conn->prepare("
        SELECT * 
        FROM shifts 
        WHERE admin_id = ? 
        AND ended_at IS NULL 
        ORDER BY started_at DESC 
        LIMIT 1
    ");
    $stmt->bind_param("i", $adminId);
    $stmt->execute();
    $result = $stmt->get_result();
    $shift = $result->fetch_assoc();
    $stmt->close();
    
    if(!$shift){
        if ($shouldRespond) {
            respond('error', 'No active shift found.');
        }
        return; // Silently return if called from logout with no active shift
    }
    
    $shiftId = $shift['id'];
    $started_at = $shift['started_at'];
    
    // Get input for end time and closing cash
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $ended_at = isset($input['ended_at']) ? $input['ended_at'] : date('Y-m-d H:i:s');
    $closing_cash = isset($input['closing_cash']) ? (float)$input['closing_cash'] : 0;
    $notes = isset($input['notes']) ? $input['notes'] : '';
    
    // Calculate shift income from orders during this shift
    $stmt = $conn->prepare("
        SELECT 
            COUNT(*) as order_count,
            COALESCE(SUM(price), 0) as order_revenue,
            COALESCE(SUM(discount), 0) as order_discount
        FROM orders 
        WHERE created_at >= ? AND created_at <= ?
    ");
    $stmt->bind_param("ss", $started_at, $ended_at);
    $stmt->execute();
    $orderStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    // Calculate shift income from room bookings during this shift
    $stmt = $conn->prepare("
        SELECT 
            COUNT(*) as booking_count,
            COALESCE(SUM(price), 0) as booking_revenue
        FROM room_booking 
        WHERE createdAt >= ? AND createdAt <= ?
        AND finished_at IS NOT NULL
    ");
    $stmt->bind_param("ss", $started_at, $ended_at);
    $stmt->execute();
    $bookingStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    // Calculate total income
    $totalRevenue = (float)$orderStats['order_revenue'] + (float)$bookingStats['booking_revenue'];
    $totalDiscount = (float)$orderStats['order_discount'];
    $totalOrders = (int)$orderStats['order_count'];
    $totalBookings = (int)$bookingStats['booking_count'];
    
    // Calculate cash difference
    $expectedCash = (float)$shift['opening_cash'] + $totalRevenue;
    $cashDifference = $closing_cash - $expectedCash;
    
    // Calculate shift duration
    $start = new DateTime($started_at);
    $end = new DateTime($ended_at);
    $duration = $start->diff($end);
    $durationHours = $duration->h + ($duration->days * 24) + ($duration->i / 60);
    
    // Update shift record
    $stmt = $conn->prepare("
        UPDATE shifts 
        SET ended_at = ?,
            closing_cash = ?,
            total_revenue = ?,
            total_orders = ?,
            total_bookings = ?,
            total_discount = ?,
            cash_difference = ?,
            duration_hours = ?,
            notes = CONCAT(COALESCE(notes, ''), '\n', ?),
            status = 'completed'
        WHERE id = ?
    ");
    $stmt->bind_param(
        "sddiiiddsi", 
        $ended_at, 
        $closing_cash, 
        $totalRevenue, 
        $totalOrders, 
        $totalBookings, 
        $totalDiscount,
        $cashDifference,
        $durationHours,
        $notes, 
        $shiftId
    );
    $stmt->execute();
    $stmt->close();
    
    if (!$shouldRespond) {
        return; // Silently return if called from logout
    }
    
    respond('success', [
        'message' => 'Shift ended successfully.',
        'shift_id' => $shiftId,
        'admin' => [
            'id' => $admin['id'],
            'name' => $admin['name'],
            'role' => $admin['role']
        ],
        'started_at' => $started_at,
        'ended_at' => $ended_at,
        'duration_hours' => round($durationHours, 2),
        'opening_cash' => (float)$shift['opening_cash'],
        'closing_cash' => $closing_cash,
        'expected_cash' => round($expectedCash, 2),
        'cash_difference' => round($cashDifference, 2),
        'income_summary' => [
            'total_revenue' => round($totalRevenue, 2),
            'order_revenue' => round((float)$orderStats['order_revenue'], 2),
            'booking_revenue' => round((float)$bookingStats['booking_revenue'], 2),
            'total_discount' => round($totalDiscount, 2),
            'total_orders' => $totalOrders,
            'total_bookings' => $totalBookings,
            'total_transactions' => $totalOrders + $totalBookings
        ]
    ]);
}

function addAdmin(){
    global $conn;
    $admin = getAdmin();
    if($admin['role'] != 'superadmin' ){
        respond('error', 'Unauthorized. Only superadmin can add admins.');
    }
    $input = requireParams(['name', 'email', 'password', 'role']);
    $name = $input['name'];
    $email = $input['email'];
    $password = $input['password'];
    $hashedPassword = md5($password); // Simple MD5 hash for demonstration; use stronger hashing in production
    $role = $input['role'];
    $stmt = $conn->prepare("INSERT INTO admins (name, email, password, role, status) VALUES (?, ?, ?, ?, 'active')");
    $stmt->bind_param("ssss", $name, $email, $hashedPassword, $role);
    $stmt->execute();
    $stmt->close();
    respond('success', 'Admin added successfully.');
}
function listAdmins(){
    global $conn;
    $admin = getAdmin();
    if($admin['role'] != 'superadmin' ){
        respond('error', 'Unauthorized. Only superadmin can view admins.');
    }
    $result = $conn->query("SELECT id, name, email, role, status FROM admins");
    $admins = [];
    while($row = $result->fetch_assoc()){
        $admins[] = $row;
    }
    respond('success', $admins);
}
function updateAdmin(){
    global $conn;
    $admin = getAdmin();
    if($admin['role'] != 'superadmin' ){
        respond('error', 'Unauthorized. Only superadmin can update admins.');
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    
    // Build dynamic update query based on provided fields
    $updates = [];
    $types = "";
    $values = [];
    
    if(isset($input['name'])){
        $updates[] = "name = ?";
        $types .= "s";
        $values[] = $input['name'];
    }
    if(isset($input['email'])){
        $updates[] = "email = ?";
        $types .= "s";
        $values[] = $input['email'];
    }
    if(isset($input['password'])){
        $updates[] = "password = ?";
        $types .= "s";
        $values[] = md5($input['password']);
    }
    if(isset($input['role'])){
        $updates[] = "role = ?";
        $types .= "s";
        $values[] = $input['role'];
    }
    if(isset($input['status'])){
        $updates[] = "status = ?";
        $types .= "s";
        $values[] = $input['status'];
    }
    
    if(empty($updates)){
        respond('error', 'No fields to update.');
    }
    
    $values[] = $id;
    $types .= "i";
    
    $sql = "UPDATE admins SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$values);
    $stmt->execute();
    $stmt->close();
    respond('success', 'Admin updated successfully.');
}
function deleteAdmin(){
    global $conn;
    $admin = getAdmin();
    if($admin['role'] != 'superadmin' ){
        respond('error', 'Unauthorized. Only superadmin can delete admins.');
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    $stmt = $conn->prepare("DELETE FROM admins WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
    respond('success', 'Admin deleted successfully.');
}

function adminAttendance(){
    global $conn;
    $admin = getAdmin();
    
    // If not superadmin, return only their own attendance
    if($admin['role'] != 'superadmin'){
        return getMyAttendance();
    }

    // Get current month and year
    $currentMonth = date('m');
    $currentYear = date('Y');
    $daysInMonth = date('t');

    // Get all non-superadmin admins
    $result = $conn->query("SELECT id, name, email, role, status FROM admins WHERE role != 'superadmin'");
    $admins = [];
    while($row = $result->fetch_assoc()){
        $adminId = $row['id'];
        
        // Get attendance for each day of the month
        $dailyAttendance = [];
        for($day = 1; $day <= $daysInMonth; $day++){
            $date = sprintf('%s-%s-%02d', $currentYear, $currentMonth, $day);
            
            // Get login sessions for this day
            $stmt = $conn->prepare("
                SELECT 
                    MIN(created_at) as first_login,
                    MAX(CASE WHEN status = 'inactive' THEN expire_at ELSE NULL END) as last_logout,
                    COUNT(*) as session_count
                FROM session 
                WHERE admin_id = ? 
                AND DATE(created_at) = ?
            ");
            $stmt->bind_param("is", $adminId, $date);
            $stmt->execute();
            $sessionResult = $stmt->get_result();
            $sessionData = $sessionResult->fetch_assoc();
            $stmt->close();

            $dailyAttendance[] = [
                'date' => $date,
                'day' => $day,
                'day_name' => date('l', strtotime($date)),
                'first_login' => $sessionData['first_login'],
                'last_logout' => $sessionData['last_logout'],
                'session_count' => (int)$sessionData['session_count'],
                'is_present' => $sessionData['first_login'] ? true : false
            ];
        }

        // Calculate summary stats
        $presentDays = array_filter($dailyAttendance, fn($d) => $d['is_present']);
        
        $row['attendance'] = [
            'month' => date('F Y'),
            'total_days' => $daysInMonth,
            'present_days' => count($presentDays),
            'absent_days' => $daysInMonth - count($presentDays),
            'daily' => $dailyAttendance
        ];
        
        $admins[] = $row;
    }

    respond('success', ['admins' => $admins]);
}

function getMyAttendance(){
    global $conn;
    $admin = getAdmin();
    
    // Get attendance records for the current admin (last 90 days)
    $stmt = $conn->prepare("
        SELECT 
            DATE(created_at) as date,
            MIN(created_at) as check_in,
            MAX(CASE WHEN status = 'inactive' THEN expire_at ELSE NULL END) as check_out,
            COUNT(*) as session_count
        FROM session 
        WHERE admin_id = ? 
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    ");
    $stmt->bind_param("i", $admin['id']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $attendance = [];
    $recordId = 1;
    
    while($row = $result->fetch_assoc()){
        $checkIn = $row['check_in'];
        $checkOut = $row['check_out'];
        
        // Calculate hours worked if check out exists
        $hoursWorked = 0;
        if($checkOut && $checkIn){
            $start = new DateTime($checkIn);
            $end = new DateTime($checkOut);
            $diff = $start->diff($end);
            $hoursWorked = $diff->h + ($diff->days * 24) + ($diff->i / 60);
        }
        
        // Extract just the time portion
        $checkInTime = $checkIn ? date('H:i:s', strtotime($checkIn)) : null;
        $checkOutTime = $checkOut ? date('H:i:s', strtotime($checkOut)) : null;
        
        $attendance[] = [
            'id' => $recordId++,
            'date' => $row['date'],
            'check_in' => $checkInTime,
            'check_out' => $checkOutTime,
            'hours_worked' => round($hoursWorked, 2),
            'status' => $checkIn ? 'present' : 'absent',
            'session_count' => (int)$row['session_count']
        ];
    }
    $stmt->close();
    
    respond('success', $attendance);
}
////////


function addcustomer(){
    global $conn;
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $name = isset($input['name']) ? $input['name'] : null;
    $phone = isset($input['phone']) ? $input['phone'] : null;
    $stmt = $conn->prepare("INSERT INTO customers (name, phone) VALUES (?, ?)");
    $stmt->bind_param("ss", $name, $phone);
    $stmt->execute();
    $stmt->close();
    respond('success', 'Customer added successfully.');
}
function listcustomers(){
    global $conn;
    getAdmin(); // just to verify token
    
    // Get customers with their statistics
    $query = "SELECT 
        c.*,
        COALESCE(SUM(rb.price), 0) as total_spent,
        COUNT(DISTINCT rb.id) as total_bookings,
        COALESCE(SUM(TIMESTAMPDIFF(HOUR, rb.started_at, COALESCE(rb.finished_at, NOW()))), 0) as total_hours
    FROM customers c
    LEFT JOIN room_booking rb ON c.id = rb.customer_id
    GROUP BY c.id
    ORDER BY c.created_at DESC";
    
    $result = $conn->query($query);
    $customers = [];
    while($row = $result->fetch_assoc()){
        // Ensure numeric values are properly formatted
        $row['total_spent'] = floatval($row['total_spent']);
        $row['total_bookings'] = intval($row['total_bookings']);
        $row['total_hours'] = floatval($row['total_hours']);
        $row['loyalty_points'] = 0; // Default since not in schema
        $row['discount_percentage'] = 0; // Default since not in schema
        $row['loyalty_tier'] = 'New'; // Default tier
        $customers[] = $row;
    }
    respond('success', $customers);
}
function deletecustomer(){
    global $conn;
    $admin = getAdmin();
    if($admin['role'] != 'superadmin' ){
        respond('error', 'Unauthorized. Only superadmin can delete customers.');
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    $stmt = $conn->prepare("DELETE FROM customers WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
    respond('success', 'Customer deleted successfully.');
}
function updatecustomer(){
    global $conn;
    $admin = getAdmin();
    $input = requireParams(['id']);
    $id = $input['id'];
    
    // Build dynamic update query based on provided fields
    $updates = [];
    $types = "";
    $values = [];
    
    if(isset($input['name'])){
        $updates[] = "name = ?";
        $types .= "s";
        $values[] = $input['name'];
    }
    if(isset($input['phone'])){
        $updates[] = "phone = ?";
        $types .= "s";
        $values[] = $input['phone'];
    }
    
    if(empty($updates)){
        respond('error', 'No fields to update.');
    }
    
    $values[] = $id;
    $types .= "i";
    
    $sql = "UPDATE customers SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$values);
    $stmt->execute();
    $stmt->close();
    respond('success', 'Customer updated successfully.');
}














//////
function addRoom(){
    global $conn;
    $admin = getAdmin();
    if($admin['role'] != 'superadmin' ){
        respond('error', 'Unauthorized. Only superadmin and manager can add rooms.');
    }
    $input = requireParams(['name', 'ps', 'hour_cost', 'capacity', 'multi_hour_cost']);
    $name = $input['name'];
    $ps = $input['ps'];
    $hour_cost = (float)$input['hour_cost'];
    $capacity = (int)$input['capacity'];
    $multi_hour_cost = (float)$input['multi_hour_cost'];
    $stmt = $conn->prepare("INSERT INTO rooms (name, ps, hour_cost, capacity, is_booked, multi_hour_cost) VALUES (?, ?, ?, ?, 0, ?)");
    $stmt->bind_param("ssdid", $name, $ps, $hour_cost, $capacity, $multi_hour_cost);
    $stmt->execute();
    $roomId = $conn->insert_id;
    $stmt->close();
    respond('success', ['message' => 'Room added successfully.', 'id' => $roomId]);
}
function updateRoom(){
    global $conn;
    $admin = getAdmin();
    if($admin['role'] != 'superadmin' ){
        respond('error', 'Unauthorized. Only superadmin and manager can update rooms.');
    }
    $input = requireParams(['id', 'name', 'ps', 'hour_cost', 'capacity', 'multi_hour_cost']);
    $id = (int)$input['id'];
    $name = $input['name'];
    $ps = $input['ps'];
    $hour_cost = (float)$input['hour_cost'];
    $capacity = (int)$input['capacity'];
    $multi_hour_cost = (float)$input['multi_hour_cost'];
    $stmt = $conn->prepare("UPDATE rooms SET name = ?, ps = ?, hour_cost = ?, capacity = ?, multi_hour_cost = ? WHERE id = ?");
    $stmt->bind_param("ssdidi", $name, $ps, $hour_cost, $capacity, $multi_hour_cost, $id);
    $stmt->execute();
    $stmt->close();
    respond('success', 'Room updated successfully.');
}
function deleteRoom(){
    global $conn;
    $admin = getAdmin();
    if($admin['role'] != 'superadmin' ){
        respond('error', 'Unauthorized. Only superadmin and manager can delete rooms.');
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    $stmt = $conn->prepare("DELETE FROM rooms WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
    respond('success', 'Room deleted successfully.');
}
function listRooms(){
    global $conn;
    getAdmin(); // just to verify token
    $result = $conn->query("SELECT * FROM rooms");
    $rooms = [];
    while($row = $result->fetch_assoc()){
        $rooms[] = $row;
    }
    respond('success', $rooms);
}
function getRoom(){
    global $conn;
    $admin = getAdmin(); // verify token and get admin info

    $input = requireParams(['id']);
    $id = $input['id'];
    $stmt = $conn->prepare("SELECT * FROM rooms WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    $stmt->close();

    // If superadmin, include analytics data
    if($admin['role'] == 'superadmin'){
        // Total bookings count
        $stmt = $conn->prepare("SELECT COUNT(*) as total_bookings FROM room_booking WHERE room_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $bookingCount = $result->fetch_assoc();
        $stmt->close();

        // Total revenue from this room
        $stmt = $conn->prepare("SELECT COALESCE(SUM(price), 0) as total_revenue FROM room_booking WHERE room_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $revenueData = $result->fetch_assoc();
        $stmt->close();

        // Average booking duration (in hours)
        $stmt = $conn->prepare("SELECT AVG(TIMESTAMPDIFF(HOUR, started_at, finished_at)) as avg_duration_hours FROM room_booking WHERE room_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $avgDuration = $result->fetch_assoc();
        $stmt->close();

        // Bookings this month
        $stmt = $conn->prepare("SELECT COUNT(*) as bookings_this_month, COALESCE(SUM(price), 0) as revenue_this_month FROM room_booking WHERE room_id = ? AND MONTH(createdAt) = MONTH(CURRENT_DATE()) AND YEAR(createdAt) = YEAR(CURRENT_DATE())");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $monthlyStats = $result->fetch_assoc();
        $stmt->close();

        // Recent bookings (last 10)
        $stmt = $conn->prepare("SELECT rb.*, c.name as customer_name, c.phone as customer_phone FROM room_booking rb LEFT JOIN customers c ON rb.customer_id = c.id WHERE rb.room_id = ? ORDER BY rb.createdAt DESC LIMIT 10");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $recentBookings = [];
        while($row = $result->fetch_assoc()){
            $recentBookings[] = $row;
        }
        $stmt->close();

        // Unique customers who booked this room
        $stmt = $conn->prepare("SELECT COUNT(DISTINCT customer_id) as unique_customers FROM room_booking WHERE room_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $uniqueCustomers = $result->fetch_assoc();
        $stmt->close();

        $room['analytics'] = [
            'total_bookings' => (int)$bookingCount['total_bookings'],
            'total_revenue' => (float)$revenueData['total_revenue'],
            'avg_duration_hours' => round((float)$avgDuration['avg_duration_hours'], 2),
            'bookings_this_month' => (int)$monthlyStats['bookings_this_month'],
            'revenue_this_month' => (float)$monthlyStats['revenue_this_month'],
            'unique_customers' => (int)$uniqueCustomers['unique_customers'],
            'recent_bookings' => $recentBookings
        ];
    }

    respond('success', $room);
}



function add_cafeteria_item(){
    global $conn;
    $admin = getAdmin();
    
    // Check required fields from POST data
    $requiredFields = ['name', 'cost', 'price', 'stock'];
    foreach($requiredFields as $field){
        if(!isset($_POST[$field])){
            respond('error', "Missing parameter: $field");
        }
    }
    
    $name = $_POST['name'];
    $cost = $_POST['cost'];
    $price = $_POST['price'];
    $stock = $_POST['stock'];
    
    // Handle photo upload
    $photo = '';
    if(isset($_FILES['photo']) && $_FILES['photo']['error'] == UPLOAD_ERR_OK){
        $uploadDir = 'uploads/cafeteria/';
        
        // Create directory if it doesn't exist
        if(!is_dir($uploadDir)){
            mkdir($uploadDir, 0755, true);
        }
        
        // Validate file type
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $fileType = $_FILES['photo']['type'];
        if(!in_array($fileType, $allowedTypes)){
            respond('error', 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
        }
        
        // Validate file size (max 5MB)
        $maxSize = 5 * 1024 * 1024;
        if($_FILES['photo']['size'] > $maxSize){
            respond('error', 'File too large. Maximum size is 5MB.');
        }
        
        // Generate unique filename
        $extension = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
        $filename = uniqid('item_') . '_' . time() . '.' . $extension;
        $targetPath = $uploadDir . $filename;
        
        // Move uploaded file
        if(move_uploaded_file($_FILES['photo']['tmp_name'], $targetPath)){
            $photo = $targetPath;
        } else {
            respond('error', 'Failed to upload photo.');
        }
    }
    
    $stmt = $conn->prepare("INSERT INTO cafeteria_items (name, cost, price, photo, stock) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sddsi", $name, $cost, $price, $photo, $stock);
    $stmt->execute();
    $insertId = $conn->insert_id;
    $stmt->close();
    respond('success', ['message' => 'Cafeteria item added successfully.', 'id' => $insertId, 'photo' => $photo]);
}
function update_cafeteria_items(){
    global $conn;
    $admin = getAdmin();

    // Get input from POST or JSON body
    $input = $_POST;
    if(empty($input)){
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
    }

    // Check required fields
    $requiredFields = ['id', 'name', 'stock'];
    foreach($requiredFields as $field){
        if(!isset($input[$field])){
            respond('error', "Missing parameter: $field");
        }
    }
    
    $id = $input['id'];
    $name = $input['name'];
    $stock = $input['stock'];
    
    // Get current item data
    $stmt = $conn->prepare("SELECT cost, price FROM cafeteria_items WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $currentItem = $result->fetch_assoc();
    $stmt->close();
    
    if(!$currentItem){
        respond('error', 'Cafeteria item not found.');
    }
    
    // Only superadmin can change cost and price
    if($admin['role'] == 'superadmin'){
        $cost = isset($input['cost']) ? $input['cost'] : $currentItem['cost'];
        $price = isset($input['price']) ? $input['price'] : $currentItem['price'];
    } else {
        // Non-superadmin: use existing cost and price
        $cost = $currentItem['cost'];
        $price = $currentItem['price'];
    }
   
    // Handle photo upload if provided
    $photo = null;
    if(isset($_FILES['photo']) && $_FILES['photo']['error'] == UPLOAD_ERR_OK){
        $uploadDir = 'uploads/cafeteria/';
        
        // Create directory if it doesn't exist
        if(!is_dir($uploadDir)){
            mkdir($uploadDir, 0755, true);
        }
        
        // Validate file type
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $fileType = $_FILES['photo']['type'];
        if(!in_array($fileType, $allowedTypes)){
            respond('error', 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
        }
        
        // Validate file size (max 5MB)
        $maxSize = 5 * 1024 * 1024;
        if($_FILES['photo']['size'] > $maxSize){
            respond('error', 'File too large. Maximum size is 5MB.');
        }
        
        // Generate unique filename
        $extension = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
        $filename = uniqid('item_') . '_' . time() . '.' . $extension;
        $targetPath = $uploadDir . $filename;
        
        // Move uploaded file
        if(move_uploaded_file($_FILES['photo']['tmp_name'], $targetPath)){
            $photo = $targetPath;
        } else {
            respond('error', 'Failed to upload photo.');
        }
    }
    
    // Build SQL query dynamically based on whether photo is updated
    if($photo){
        $stmt = $conn->prepare("UPDATE cafeteria_items SET name = ?, cost = ?, price = ?, photo = ?, stock = ? WHERE id = ?");
        $stmt->bind_param("sddsii", $name, $cost, $price, $photo, $stock, $id);
    } else {
        $stmt = $conn->prepare("UPDATE cafeteria_items SET name = ?, cost = ?, price = ?, stock = ? WHERE id = ?");
        $stmt->bind_param("sddii", $name, $cost, $price, $stock, $id);
    }
    $stmt->execute();
    $stmt->close();
    respond('success', 'Cafeteria item updated successfully.');

}
function delete_cafeteria_items(){
    global $conn;
    $admin = getAdmin();
    if($admin['role'] != 'superadmin' ){
        respond('error', 'Unauthorized. Only superadmin can delete cafeteria items.');
    }
    $input = requireParams(['id']);
    $id = $input['id'];
    $stmt = $conn->prepare("DELETE FROM cafeteria_items WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
    respond('success', 'Cafeteria item deleted successfully.');
}
function list_cafeteria_items(){
    global $conn;
    getAdmin(); // just to verify token
    $result = $conn->query("SELECT * FROM cafeteria_items");
    $items = [];
    while($row = $result->fetch_assoc()){
        $items[] = $row;
    }
    respond('success', $items);
}
function get_cafeteria_item(){
    global $conn;
    $admin = getAdmin(); // verify token and get admin info

    $input = requireParams(['id']);
    $id = $input['id'];
    $stmt = $conn->prepare("SELECT * FROM cafeteria_items WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $item = $result->fetch_assoc();
    $stmt->close();

    // If superadmin, include analytics data
    if($admin['role'] == 'superadmin'){
        // Total quantity sold
        $stmt = $conn->prepare("SELECT COALESCE(SUM(quantity), 0) as total_sold FROM order_items WHERE item_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $totalSold = $result->fetch_assoc();
        $stmt->close();

        // Total revenue from this item
        $stmt = $conn->prepare("SELECT COALESCE(SUM(total_price), 0) as total_revenue FROM order_items WHERE item_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $revenueData = $result->fetch_assoc();
        $stmt->close();

        // Total profit (revenue - cost)
        $totalCost = (float)$item['cost'] * (int)$totalSold['total_sold'];
        $totalProfit = (float)$revenueData['total_revenue'] - $totalCost;

        // Number of orders containing this item
        $stmt = $conn->prepare("SELECT COUNT(DISTINCT order_id) as order_count FROM order_items WHERE item_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $orderCount = $result->fetch_assoc();
        $stmt->close();

        // Sales this month
        $stmt = $conn->prepare("
            SELECT 
                COALESCE(SUM(oi.quantity), 0) as sold_this_month, 
                COALESCE(SUM(oi.total_price), 0) as revenue_this_month 
            FROM order_items oi 
            JOIN orders o ON oi.order_id = o.id 
            WHERE oi.item_id = ? 
            AND MONTH(o.created_at) = MONTH(CURRENT_DATE()) 
            AND YEAR(o.created_at) = YEAR(CURRENT_DATE())
        ");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $monthlyStats = $result->fetch_assoc();
        $stmt->close();

        // Recent orders containing this item (last 10)
        $stmt = $conn->prepare("
            SELECT oi.*, o.created_at as order_date, c.name as customer_name, c.phone as customer_phone 
            FROM order_items oi 
            JOIN orders o ON oi.order_id = o.id 
            LEFT JOIN customers c ON o.customer_id = c.id 
            WHERE oi.item_id = ? 
            ORDER BY o.created_at DESC 
            LIMIT 10
        ");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $recentOrders = [];
        while($row = $result->fetch_assoc()){
            $recentOrders[] = $row;
        }
        $stmt->close();

        // Average quantity per order
        $avgQuantity = $orderCount['order_count'] > 0 ? round($totalSold['total_sold'] / $orderCount['order_count'], 2) : 0;

        $item['analytics'] = [
            'total_sold' => (int)$totalSold['total_sold'],
            'total_revenue' => (float)$revenueData['total_revenue'],
            'total_cost' => round($totalCost, 2),
            'total_profit' => round($totalProfit, 2),
            'profit_margin' => $revenueData['total_revenue'] > 0 ? round(($totalProfit / $revenueData['total_revenue']) * 100, 2) : 0,
            'order_count' => (int)$orderCount['order_count'],
            'avg_quantity_per_order' => $avgQuantity,
            'sold_this_month' => (int)$monthlyStats['sold_this_month'],
            'revenue_this_month' => (float)$monthlyStats['revenue_this_month'],
            'recent_orders' => $recentOrders
        ];
    }

    respond('success', $item);
}

//rooms_booking functions
function addBooking(){
    global $conn;
    $admin = getAdmin();
    $input = requireParams(['room_id']);
    $customer_id = isset($input['customer_id']) ? $input['customer_id'] : null;
    $room_id = $input['room_id'];
    
    // Optional: scheduled start and finish times
    $scheduled_start = isset($input['started_at']) ? $input['started_at'] : null;
    $scheduled_finish = isset($input['finished_at']) ? $input['finished_at'] : null;
    
    // Check if this is a multi-player booking
    $is_multi = isset($input['is_multi']) ? (int)$input['is_multi'] : 0;
    
    // Optional discount (percentage or fixed amount)
    $discount = isset($input['discount']) ? (float)$input['discount'] : 0;
    
    // Get room hourly costs
    $stmt = $conn->prepare("SELECT hour_cost, multi_hour_cost, is_booked FROM rooms WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    $stmt->close();
    
    if(!$room){
        respond('error', 'Room not found.');
    }
    
    // Use multi_hour_cost if is_multi is true, otherwise use hour_cost
    $hour_cost = $is_multi ? (float)$room['multi_hour_cost'] : (float)$room['hour_cost'];
    $current_time = date('Y-m-d H:i:s');
    
    // Check for conflicting bookings
    if($scheduled_start && $scheduled_finish){
        // Check for scheduled bookings that overlap with requested time
        $stmt = $conn->prepare("
            SELECT id FROM room_booking 
            WHERE room_id = ? 
            AND (
                (started_at < ? AND (finished_at > ? OR finished_at IS NULL))
                OR (started_at < ? AND (finished_at > ? OR finished_at IS NULL))
                OR (started_at >= ? AND started_at < ?)
            )
        ");
        $stmt->bind_param("issssss", $room_id, $scheduled_finish, $scheduled_start, $scheduled_finish, $scheduled_start, $scheduled_start, $scheduled_finish);
        $stmt->execute();
        $result = $stmt->get_result();
        if($result->num_rows > 0){
            $stmt->close();
            respond('error', 'Room is already booked for the selected time period.');
        }
        $stmt->close();
    } else {
        // For open session, check if room is currently booked
        $check_start = $scheduled_start ? $scheduled_start : $current_time;
        $stmt = $conn->prepare("
            SELECT id FROM room_booking 
            WHERE room_id = ? 
            AND started_at <= ? 
            AND (finished_at IS NULL OR finished_at > ?)
        ");
        $stmt->bind_param("iss", $room_id, $check_start, $check_start);
        $stmt->execute();
        $result = $stmt->get_result();
        if($result->num_rows > 0){
            $stmt->close();
            respond('error', 'Room is currently booked.');
        }
        $stmt->close();
    }
    
    // Determine booking type: scheduled or open session
    if($scheduled_start && $scheduled_finish){
        // SCHEDULED BOOKING: Both start and end times provided
        $started_at = $scheduled_start;
        $finished_at = $scheduled_finish;
        
        // Validate times
        $start = new DateTime($started_at);
        $end = new DateTime($finished_at);
        
        if($end <= $start){
            respond('error', 'Finish time must be after start time.');
        }
        
        // Calculate duration in minutes
        $diff = $start->diff($end);
        $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
        
        // Calculate price based on actual minutes (proportional to hourly rate)
        // Price = (hourly_rate / 60) * minutes
        $price_per_minute = $hour_cost / 60;
        $price_before_discount = round($price_per_minute * $total_minutes, 2);
        
        // Apply discount
        $price = round($price_before_discount - $discount, 2);
        if($price < 0) $price = 0;
        
        // Convert to hours for display
        $hours = $total_minutes / 60;
        
        // Check if booking starts now or in future
        $now = new DateTime();
        $shouldMarkBooked = ($start <= $now);
        
        // Mark room as booked only if session starts now
        if($shouldMarkBooked){
            $stmt = $conn->prepare("UPDATE rooms SET is_booked = 1 WHERE id = ?");
            $stmt->bind_param("i", $room_id);
            $stmt->execute();
            $stmt->close();
        }
        
        // Insert scheduled booking with calculated price
        $stmt = $conn->prepare("INSERT INTO room_booking (customer_id, room_id, started_at, finished_at, price, is_multi, discount) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("iissdid", $customer_id, $room_id, $started_at, $finished_at, $price, $is_multi, $discount);
        $stmt->execute();
        $bookingId = $conn->insert_id;
        $stmt->close();
        
        respond('success', [
            'message' => 'Scheduled booking created successfully.',
            'booking_id' => $bookingId,
            'started_at' => $started_at,
            'finished_at' => $finished_at,
            'duration_hours' => round($hours, 2),
            'hour_cost' => $hour_cost,
            'price_before_discount' => $price_before_discount,
            'discount' => $discount,
            'total_price' => $price,
            'booking_type' => 'scheduled',
            'is_multi' => $is_multi,
            'status' => $shouldMarkBooked ? 'active' : 'pending'
        ]);
        
    } else {
        // OPEN SESSION: Start now, end when they want
        $started_at = $scheduled_start ? $scheduled_start : $current_time;
        
        // Mark room as booked
        $stmt = $conn->prepare("UPDATE rooms SET is_booked = 1 WHERE id = ?");
        $stmt->bind_param("i", $room_id);
        $stmt->execute();
        $stmt->close();
        
        // Insert booking with null finished_at and price (open session)
        $stmt = $conn->prepare("INSERT INTO room_booking (customer_id, room_id, started_at, finished_at, price, is_multi, discount) VALUES (?, ?, ?, NULL, 0, ?, ?)");
        $stmt->bind_param("iisid", $customer_id, $room_id, $started_at, $is_multi, $discount);
        $stmt->execute();
        $bookingId = $conn->insert_id;
        $stmt->close();
        
        respond('success', [
            'message' => 'Open session booking started successfully.',
            'booking_id' => $bookingId,
            'started_at' => $started_at,
            'hour_cost' => $hour_cost,
            'booking_type' => 'open_session',
            'is_multi' => $is_multi,
            'discount' => $discount,
            'status' => 'active'
        ]);
    }
}

function endBooking(){
    global $conn;
    $admin = getAdmin();
    $input = requireParams(['booking_id']);
    $booking_id = $input['booking_id'];
    
    // Get booking details with both hour costs
    $stmt = $conn->prepare("SELECT rb.*, r.hour_cost, r.multi_hour_cost FROM room_booking rb JOIN rooms r ON rb.room_id = r.id WHERE rb.id = ?");
    $stmt->bind_param("i", $booking_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $booking = $result->fetch_assoc();
    $stmt->close();
    
    if(!$booking){
        respond('error', 'Booking not found.');
    }
    
    $current_time = date('Y-m-d H:i:s');
    $started_at = $booking['started_at'];
    $is_multi = isset($booking['is_multi']) ? (int)$booking['is_multi'] : 0;
    $discount = isset($booking['discount']) ? (float)$booking['discount'] : 0;
    // Use appropriate hourly cost based on is_multi
    $hour_cost = $is_multi ? (float)$booking['multi_hour_cost'] : (float)$booking['hour_cost'];
    
    // Check if this is a scheduled booking (has both start and finish times)
    $is_scheduled = ($booking['finished_at'] !== null && $booking['price'] > 0);
    
    if($is_scheduled){
        // SCHEDULED BOOKING - Can only "end" if we want to end early
        $scheduled_finish = $booking['finished_at'];
        
        // Check if already past scheduled finish time
        if($current_time >= $scheduled_finish){
            respond('error', 'Scheduled booking has already ended at ' . $scheduled_finish);
        }
        
        // End early - recalculate price based on actual time used
        $finished_at = $current_time;
        
        // Check if session has actually started
        if($current_time < $started_at){
            respond('error', 'Cannot end booking before it starts. Scheduled start time: ' . $started_at);
        }
        
        // Calculate actual duration in minutes
        $start = new DateTime($started_at);
        $end = new DateTime($finished_at);
        $diff = $start->diff($end);
        $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
        
        // Recalculate price based on actual usage (proportional)
        $price_per_minute = $hour_cost / 60;
        $price_before_discount = round($price_per_minute * $total_minutes, 2);
        
        // Apply discount
        $price = round($price_before_discount - $discount, 2);
        if($price < 0) $price = 0;
        
        // Convert to hours for display
        $hours = $total_minutes / 60;
        
        // Update booking with actual finish time and price
        $stmt = $conn->prepare("UPDATE room_booking SET finished_at = ?, price = ? WHERE id = ?");
        $stmt->bind_param("sdi", $finished_at, $price, $booking_id);
        $stmt->execute();
        $stmt->close();
        
        // Mark room as available
        $stmt = $conn->prepare("UPDATE rooms SET is_booked = 0 WHERE id = ?");
        $stmt->bind_param("i", $booking['room_id']);
        $stmt->execute();
        $stmt->close();
        
        respond('success', [
            'message' => 'Scheduled booking ended early.',
            'booking_id' => $booking_id,
            'scheduled_start' => $started_at,
            'scheduled_finish' => $scheduled_finish,
            'actual_finished_at' => $finished_at,
            'duration_hours' => round($hours, 2),
            'hour_cost' => $hour_cost,
            'is_multi' => $is_multi,
            'price_before_discount' => $price_before_discount,
            'discount' => $discount,
            'total_price' => $price,
            'original_price' => (float)$booking['price'],
            'savings' => round((float)$booking['price'] - $price, 2)
        ]);
        
    } else {
        // OPEN SESSION - finish_at is NULL, calculate now
        if($booking['finished_at'] !== null){
            respond('error', 'This open session has already been ended.');
        }
        
        // Check if session has actually started
        if($current_time < $started_at){
            respond('error', 'Cannot end booking before it starts. Scheduled start time: ' . $started_at);
        }
        
        // End booking now
        $finished_at = $current_time;
        
        // Calculate duration in minutes
        $start = new DateTime($started_at);
        $end = new DateTime($finished_at);
        $diff = $start->diff($end);
        $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
        
        // Calculate price based on actual minutes used
        $price_per_minute = $hour_cost / 60;
        $price_before_discount = round($price_per_minute * $total_minutes, 2);
        
        // Apply discount
        $price = round($price_before_discount - $discount, 2);
        if($price < 0) $price = 0;
        
        // Convert to hours for display
        $hours = $total_minutes / 60;
        
        // Update booking with finished_at and price
        $stmt = $conn->prepare("UPDATE room_booking SET finished_at = ?, price = ? WHERE id = ?");
        $stmt->bind_param("sdi", $finished_at, $price, $booking_id);
        $stmt->execute();
        $stmt->close();
        
        // Mark room as available
        $stmt = $conn->prepare("UPDATE rooms SET is_booked = 0 WHERE id = ?");
        $stmt->bind_param("i", $booking['room_id']);
        $stmt->execute();
        $stmt->close();
        
        respond('success', [
            'message' => 'Open session ended successfully.',
            'booking_id' => $booking_id,
            'started_at' => $started_at,
            'finished_at' => $finished_at,
            'duration_hours' => round($hours, 2),
            'hour_cost' => $hour_cost,
            'is_multi' => $is_multi,
            'price_before_discount' => $price_before_discount,
            'discount' => $discount,
            'total_price' => $price,
            'booking_type' => 'open_session'
        ]);
    }
}

/**
 * Update discount for an active/pending booking (before it ends)
 * Can be used to set or modify discount during an open session or scheduled booking
 */
function updateBookingDiscount(){
    global $conn;
    $admin = getAdmin();
    $input = requireParams(['booking_id', 'discount']);
    $booking_id = (int)$input['booking_id'];
    $new_discount = (float)$input['discount'];
    
    if($new_discount < 0){
        respond('error', 'Discount cannot be negative.');
    }
    
    // Get booking details with both hour costs
    $stmt = $conn->prepare("SELECT rb.*, r.hour_cost, r.multi_hour_cost, r.name as room_name FROM room_booking rb JOIN rooms r ON rb.room_id = r.id WHERE rb.id = ?");
    $stmt->bind_param("i", $booking_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $booking = $result->fetch_assoc();
    $stmt->close();
    
    if(!$booking){
        respond('error', 'Booking not found.');
    }
    
    $current_time = date('Y-m-d H:i:s');
    $started_at = $booking['started_at'];
    $is_multi = isset($booking['is_multi']) ? (int)$booking['is_multi'] : 0;
    $old_discount = isset($booking['discount']) ? (float)$booking['discount'] : 0;
    
    // Use appropriate hourly cost based on is_multi
    $hour_cost = $is_multi ? (float)$booking['multi_hour_cost'] : (float)$booking['hour_cost'];
    
    // Check if this is a scheduled booking (has both start and finish times with price > 0)
    $is_scheduled = ($booking['finished_at'] !== null && (float)$booking['price'] > 0);
    $is_completed = false;
    
    if($is_scheduled){
        // Check if scheduled booking has already ended
        if($current_time >= $booking['finished_at']){
            $is_completed = true;
        }
    } else {
        // For open sessions, check if already ended (finished_at is set)
        if($booking['finished_at'] !== null){
            $is_completed = true;
        }
    }
    
    if($is_completed){
        respond('error', 'Cannot update discount for a completed booking.');
    }
    
    // Calculate current/estimated price with the new discount
    $now = new DateTime();
    $start = new DateTime($started_at);
    
    if($is_scheduled){
        // Scheduled booking - calculate based on scheduled duration
        $end = new DateTime($booking['finished_at']);
        $diff = $start->diff($end);
        $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
        $hours = $total_minutes / 60;
        
        $price_per_minute = $hour_cost / 60;
        $price_before_discount = round($price_per_minute * $total_minutes, 2);
        $new_price = round($price_before_discount - $new_discount, 2);
        if($new_price < 0) $new_price = 0;
        
        // Update both discount and price for scheduled booking
        $stmt = $conn->prepare("UPDATE room_booking SET discount = ?, price = ? WHERE id = ?");
        $stmt->bind_param("ddi", $new_discount, $new_price, $booking_id);
        $stmt->execute();
        $stmt->close();
        
        respond('success', [
            'message' => 'Booking discount updated successfully.',
            'booking_id' => $booking_id,
            'room_name' => $booking['room_name'],
            'booking_type' => 'scheduled',
            'started_at' => $started_at,
            'finished_at' => $booking['finished_at'],
            'duration_hours' => round($hours, 2),
            'hour_cost' => $hour_cost,
            'is_multi' => $is_multi,
            'price_before_discount' => $price_before_discount,
            'old_discount' => $old_discount,
            'new_discount' => $new_discount,
            'total_price' => $new_price
        ]);
        
    } else {
        // Open session - calculate based on current elapsed time
        $diff = $start->diff($now);
        $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
        $hours = $total_minutes / 60;
        
        $price_per_minute = $hour_cost / 60;
        $price_before_discount = round($price_per_minute * $total_minutes, 2);
        $estimated_price = round($price_before_discount - $new_discount, 2);
        if($estimated_price < 0) $estimated_price = 0;
        
        // Update only discount for open session (price calculated at endBooking)
        $stmt = $conn->prepare("UPDATE room_booking SET discount = ? WHERE id = ?");
        $stmt->bind_param("di", $new_discount, $booking_id);
        $stmt->execute();
        $stmt->close();
        
        respond('success', [
            'message' => 'Booking discount updated successfully.',
            'booking_id' => $booking_id,
            'room_name' => $booking['room_name'],
            'booking_type' => 'open_session',
            'started_at' => $started_at,
            'current_duration_hours' => round($hours, 2),
            'hour_cost' => $hour_cost,
            'is_multi' => $is_multi,
            'current_price_before_discount' => $price_before_discount,
            'old_discount' => $old_discount,
            'new_discount' => $new_discount,
            'estimated_total_price' => $estimated_price,
            'note' => 'Final price will be calculated when booking ends'
        ]);
    }
}

function listBookings(){
    global $conn;
    getAdmin();
    
    $result = $conn->query("
        SELECT rb.*, r.name as room_name, r.hour_cost, r.multi_hour_cost, c.name as customer_name, c.phone as customer_phone 
        FROM room_booking rb 
        JOIN rooms r ON rb.room_id = r.id 
        LEFT JOIN customers c ON rb.customer_id = c.id 
        ORDER BY rb.createdAt DESC
    ");
    $bookings = [];
    $now = new DateTime();
    $current_time = date('Y-m-d H:i:s');
    
    while($row = $result->fetch_assoc()){
        $start = new DateTime($row['started_at']);
        $is_open_session = ($row['finished_at'] === null || ($row['finished_at'] === null && $row['price'] == 0));
        $is_multi = isset($row['is_multi']) ? (int)$row['is_multi'] : 0;
        // Use appropriate hourly cost based on is_multi
        $applicable_hour_cost = $is_multi ? (float)$row['multi_hour_cost'] : (float)$row['hour_cost'];
        
        // Determine booking status
        if($row['finished_at'] !== null && $row['price'] > 0){
            // Check if it's a completed scheduled booking or an ended open session
            $end = new DateTime($row['finished_at']);
            if($now >= $end){
                $row['status'] = 'completed';
                $row['is_active'] = false;
            } else if($now >= $start && $now < $end){
                $row['status'] = 'active';
                $row['is_active'] = true;
            } else {
                $row['status'] = 'pending';
                $row['is_active'] = false;
            }
        } else if($row['finished_at'] === null){
            // Open session
            if($now >= $start){
                $row['status'] = 'active';
                $row['is_active'] = true;
                
                // Calculate current duration and estimated price
                $diff = $start->diff($now);
                $hours = $diff->h + ($diff->days * 24) + ($diff->i / 60);
                $row['current_duration_hours'] = round($hours, 2);
                // Calculate estimated price based on current minutes and applicable cost
                $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
                $price_per_minute = $applicable_hour_cost / 60;
                $row['estimated_price'] = round($price_per_minute * $total_minutes, 2);
            } else {
                $row['status'] = 'pending';
                $row['is_active'] = false;
            }
        } else {
            $row['status'] = 'completed';
            $row['is_active'] = false;
        }
        
        // Add booking type
        if($row['finished_at'] === null || ($row['price'] == 0 && $row['finished_at'] === null)){
            $row['booking_type'] = 'open_session';
        } else {
            $row['booking_type'] = 'scheduled';
        }
        
        $bookings[] = $row;
    }
    respond('success', $bookings);
}

function getActiveBookings(){
    global $conn;
    getAdmin();
    
    $current_time = date('Y-m-d H:i:s');
    
    $result = $conn->query("
        SELECT rb.*, r.name as room_name, r.hour_cost, r.multi_hour_cost, c.name as customer_name, c.phone as customer_phone 
        FROM room_booking rb 
        JOIN rooms r ON rb.room_id = r.id 
        LEFT JOIN customers c ON rb.customer_id = c.id 
        WHERE (
            (rb.finished_at IS NULL AND rb.started_at <= '$current_time')
            OR (rb.finished_at IS NOT NULL AND rb.started_at <= '$current_time' AND rb.finished_at > '$current_time')
        )
        ORDER BY rb.started_at ASC
    ");
    $bookings = [];
    $now = new DateTime();
    
    while($row = $result->fetch_assoc()){
        $start = new DateTime($row['started_at']);
        $is_multi = isset($row['is_multi']) ? (int)$row['is_multi'] : 0;
        // Use appropriate hourly cost based on is_multi
        $applicable_hour_cost = $is_multi ? (float)$row['multi_hour_cost'] : (float)$row['hour_cost'];
        
        // Get related orders for this booking
        $ordersStmt = $conn->prepare("
            SELECT o.id, o.price as total_amount, o.discount, o.created_at,
                   c.name as customer_name, c.phone as customer_phone
            FROM orders o 
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.booking_id = ?
            ORDER BY o.created_at DESC
        ");
        $ordersStmt->bind_param("i", $row['id']);
        $ordersStmt->execute();
        $ordersResult = $ordersStmt->get_result();
        $orders = [];
        $orders_total = 0;
        while($orderRow = $ordersResult->fetch_assoc()){
            // Get items for this order
            $itemsStmt = $conn->prepare("
                SELECT oi.*, ci.name as item_name, ci.price as unit_price
                FROM order_items oi 
                JOIN cafeteria_items ci ON oi.item_id = ci.id 
                WHERE oi.order_id = ?
            ");
            $itemsStmt->bind_param("i", $orderRow['id']);
            $itemsStmt->execute();
            $itemsResult = $itemsStmt->get_result();
            $items = [];
            while($itemRow = $itemsResult->fetch_assoc()){
                $items[] = $itemRow;
            }
            $itemsStmt->close();
            
            $orderRow['items'] = $items;
            $orderRow['items_count'] = count($items);
            $orders[] = $orderRow;
            $orders_total += (float)$orderRow['total_amount'];
        }
        $ordersStmt->close();
        
        $row['orders'] = $orders;
        $row['orders_count'] = count($orders);
        $row['orders_total'] = round($orders_total, 2);
        
        // Determine booking type and status
        $is_open_session = ($row['finished_at'] === null || $row['price'] == 0);
        
        if($is_open_session){
            // Open session - calculate current duration
            $diff = $start->diff($now);
            $hours = $diff->h + ($diff->days * 24) + ($diff->i / 60);
            $row['current_duration_hours'] = round($hours, 2);
            // Calculate based on actual minutes and applicable cost
            $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
            $price_per_minute = $applicable_hour_cost / 60;
            $row['billable_minutes'] = $total_minutes;
            $row['estimated_price'] = round($price_per_minute * $total_minutes, 2);
            $row['booking_type'] = 'open_session';
            $row['status'] = 'active';
        } else {
            // Scheduled booking - show remaining time and actual cost based on selected time
            $end = new DateTime($row['finished_at']);
            $diff_from_start = $start->diff($now);
            $diff_to_end = $now->diff($end);
            $total_duration = $start->diff($end);
            
            $elapsed_hours = $diff_from_start->h + ($diff_from_start->days * 24) + ($diff_from_start->i / 60);
            $remaining_hours = $diff_to_end->h + ($diff_to_end->days * 24) + ($diff_to_end->i / 60);
            $total_hours = $total_duration->h + ($total_duration->days * 24) + ($total_duration->i / 60);
            
            // Calculate based on total minutes and applicable cost
            $total_minutes_duration = ($total_duration->days * 24 * 60) + $total_duration->h * 60 + $total_duration->i;
            $price_per_minute = $applicable_hour_cost / 60;
            
            $row['current_duration_hours'] = round($elapsed_hours, 2);
            $row['remaining_hours'] = round($remaining_hours, 2);
            $row['total_duration_hours'] = round($total_hours, 2);
            $row['total_duration_minutes'] = $total_minutes_duration;
            // Calculate actual price based on actual minutes
            $row['estimated_price'] = round($price_per_minute * $total_minutes_duration, 2);
            $row['booking_type'] = 'scheduled';
            $row['status'] = 'active';
        }
        
        $bookings[] = $row;
    }
    respond('success', $bookings);
}

function getBookingEndingAlerts(){
    global $conn;
    getAdmin();
    
    $current_time = date('Y-m-d H:i:s');
    // Get time 5 minutes from now
    $alert_time = date('Y-m-d H:i:s', strtotime('+5 minutes'));
    
    // Get bookings that will finish within the next 5 minutes
    $result = $conn->query("
        SELECT rb.*, r.name as room_name, r.hour_cost, r.multi_hour_cost, c.name as customer_name, c.phone as customer_phone 
        FROM room_booking rb 
        JOIN rooms r ON rb.room_id = r.id 
        LEFT JOIN customers c ON rb.customer_id = c.id 
        WHERE rb.finished_at IS NOT NULL 
          AND rb.finished_at > '$current_time' 
          AND rb.finished_at <= '$alert_time'
        ORDER BY rb.finished_at ASC
    ");
    
    $alerts = [];
    $now = new DateTime();
    
    while($row = $result->fetch_assoc()){
        $end = new DateTime($row['finished_at']);
        $diff = $now->diff($end);
        
        // Calculate remaining minutes and seconds
        $remaining_minutes = $diff->i;
        $remaining_seconds = $diff->s;
        $total_remaining_seconds = ($remaining_minutes * 60) + $remaining_seconds;
        
        // Get related orders total for this booking
        $ordersStmt = $conn->prepare("SELECT COALESCE(SUM(price), 0) as orders_total FROM orders WHERE booking_id = ?");
        $ordersStmt->bind_param("i", $row['id']);
        $ordersStmt->execute();
        $ordersResult = $ordersStmt->get_result();
        $ordersData = $ordersResult->fetch_assoc();
        $ordersStmt->close();
        
        $row['orders_total'] = (float)$ordersData['orders_total'];
        $row['remaining_minutes'] = $remaining_minutes;
        $row['remaining_seconds'] = $remaining_seconds;
        $row['total_remaining_seconds'] = $total_remaining_seconds;
        $row['alert_type'] = 'ending_soon';
        $row['alert_message'] = "Booking for {$row['room_name']} will end in {$remaining_minutes} min {$remaining_seconds} sec";
        
        $alerts[] = $row;
    }
    
    respond('success', [
        'count' => count($alerts),
        'alerts' => $alerts
    ]);
}

function getBookings(){
    global $conn;
    getAdmin();
    
    // Get ALL bookings from all time with full data
    $result = $conn->query("
        SELECT rb.*, r.name as room_name, r.ps, r.hour_cost, r.multi_hour_cost, c.name as customer_name, c.phone as customer_phone
        FROM room_booking rb
        JOIN rooms r ON rb.room_id = r.id
        LEFT JOIN customers c ON rb.customer_id = c.id
        ORDER BY rb.createdAt DESC
    ");
    
    $bookings = [];
    $totalRevenue = 0;
    $activeCount = 0;
    $completedCount = 0;
    
    while($row = $result->fetch_assoc()){
        // Get related orders for this booking
        $ordersStmt = $conn->prepare("
            SELECT o.id, o.price as total_amount, o.discount, o.created_at,
                   c.name as customer_name, c.phone as customer_phone
            FROM orders o 
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.booking_id = ?
            ORDER BY o.created_at DESC
        ");
        $ordersStmt->bind_param("i", $row['id']);
        $ordersStmt->execute();
        $ordersResult = $ordersStmt->get_result();
        $orders = [];
        $orders_total = 0;
        while($orderRow = $ordersResult->fetch_assoc()){
            // Get items for this order
            $itemsStmt = $conn->prepare("
                SELECT oi.*, ci.name as item_name, ci.price as unit_price
                FROM order_items oi 
                JOIN cafeteria_items ci ON oi.item_id = ci.id 
                WHERE oi.order_id = ?
            ");
            $itemsStmt->bind_param("i", $orderRow['id']);
            $itemsStmt->execute();
            $itemsResult = $itemsStmt->get_result();
            $items = [];
            while($itemRow = $itemsResult->fetch_assoc()){
                $items[] = $itemRow;
            }
            $itemsStmt->close();
            
            $orderRow['items'] = $items;
            $orderRow['items_count'] = count($items);
            $orders[] = $orderRow;
            $orders_total += (float)$orderRow['total_amount'];
        }
        $ordersStmt->close();
        
        $row['orders'] = $orders;
        $row['orders_count'] = count($orders);
        $row['orders_total'] = round($orders_total, 2);
        
        if($row['finished_at'] === null){
            $row['status'] = 'active';
            $activeCount++;
            // Calculate current duration
            $start = new DateTime($row['started_at']);
            $now = new DateTime();
            $diff = $start->diff($now);
            $hours = $diff->h + ($diff->days * 24) + ($diff->i / 60);
            $row['current_duration_hours'] = round($hours, 2);
            $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
            $price_per_minute = (float)$row['hour_cost'] / 60;
            $row['estimated_price'] = round($price_per_minute * $total_minutes, 2);
        } else {
            $row['status'] = 'completed';
            $completedCount++;
            $totalRevenue += (float)$row['price'];
        }
        $bookings[] = $row;
    }
    
    respond('success', [
        'bookings' => $bookings,
        'summary' => [
            'total' => count($bookings),
            'active' => $activeCount,
            'completed' => $completedCount,
            'completed_revenue' => round($totalRevenue, 2)
        ]
    ]);
}

//orders functions
function getCustomerLoyaltyInfo(){
    global $conn;
    getAdmin();
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $customer_id = isset($input['customer_id']) ? $input['customer_id'] : null;
    
    // If no customer_id provided, return default guest info
    if(!$customer_id){
        respond('success', [
            'customer' => null,
            'total_orders' => 0,
            'total_bookings' => 0,
            'total_transactions' => 0,
            'total_spent' => 0,
            'loyalty_tier' => 'Guest',
            'suggested_discount_percent' => 0,
            'loyalty_label' => 'Guest - No Discount'
        ]);
    }
    
    // Get customer details
    $stmt = $conn->prepare("SELECT * FROM customers WHERE id = ?");
    $stmt->bind_param("i", $customer_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $customer = $result->fetch_assoc();
    $stmt->close();
    
    if(!$customer){
        respond('success', [
            'customer' => null,
            'total_orders' => 0,
            'total_bookings' => 0,
            'total_transactions' => 0,
            'total_spent' => 0,
            'loyalty_tier' => 'Guest',
            'suggested_discount_percent' => 0,
            'loyalty_label' => 'Guest - No Discount'
        ]);
    }
    
    // Get order history
    $stmt = $conn->prepare("SELECT COUNT(*) as total_orders, COALESCE(SUM(price), 0) as total_spent FROM orders WHERE customer_id = ?");
    $stmt->bind_param("i", $customer_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $orderStats = $result->fetch_assoc();
    $stmt->close();
    
    // Get booking history
    $stmt = $conn->prepare("SELECT COUNT(*) as total_bookings, COALESCE(SUM(price), 0) as total_booking_spent FROM room_booking WHERE customer_id = ?");
    $stmt->bind_param("i", $customer_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $bookingStats = $result->fetch_assoc();
    $stmt->close();
    
    $totalOrders = (int)$orderStats['total_orders'];
    $totalBookings = (int)$bookingStats['total_bookings'];
    $totalSpent = (float)$orderStats['total_spent'] + (float)$bookingStats['total_booking_spent'];
    $totalTransactions = $totalOrders + $totalBookings;
    
    // Determine loyalty tier and suggested discount
    $loyaltyTier = 'New Customer';
    $suggestedDiscountPercent = 0;
    $loyaltyLabel = '';
    
    if($totalTransactions >= 50 || $totalSpent >= 10000){
        $loyaltyTier = 'VIP';
        $suggestedDiscountPercent = 15;
        $loyaltyLabel = '⭐ VIP Customer - 15% Discount';
    } elseif($totalTransactions >= 25 || $totalSpent >= 5000){
        $loyaltyTier = 'Gold';
        $suggestedDiscountPercent = 10;
        $loyaltyLabel = '🥇 Gold Customer - 10% Discount';
    } elseif($totalTransactions >= 10 || $totalSpent >= 2000){
        $loyaltyTier = 'Silver';
        $suggestedDiscountPercent = 5;
        $loyaltyLabel = '🥈 Silver Customer - 5% Discount';
    } elseif($totalTransactions >= 5 || $totalSpent >= 500){
        $loyaltyTier = 'Bronze';
        $suggestedDiscountPercent = 3;
        $loyaltyLabel = '🥉 Bronze Customer - 3% Discount';
    } else {
        $loyaltyLabel = 'Regular Customer - No Discount';
    }
    
    respond('success', [
        'customer' => $customer,
        'total_orders' => $totalOrders,
        'total_bookings' => $totalBookings,
        'total_transactions' => $totalTransactions,
        'total_spent' => round($totalSpent, 2),
        'loyalty_tier' => $loyaltyTier,
        'suggested_discount_percent' => $suggestedDiscountPercent,
        'loyalty_label' => $loyaltyLabel
    ]);
}

function addOrder(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['items']);
    $customer_id = isset($input['customer_id']) ? $input['customer_id'] : null;
    $items = $input['items']; // Array of {item_id, quantity}
    $discount = isset($input['discount']) ? (float)$input['discount'] : 0;
    $discountPercent = isset($input['discount_percent']) ? (float)$input['discount_percent'] : 0;
    $applyLoyaltyDiscount = isset($input['apply_loyalty_discount']) ? (bool)$input['apply_loyalty_discount'] : false;
    
    if(!is_array($items) || count($items) == 0){
        respond('error', 'At least one item is required.');
    }
    
    // Verify customer exists (if customer_id provided)
    $customer = null;
    if($customer_id){
        $stmt = $conn->prepare("SELECT id, name FROM customers WHERE id = ?");
        $stmt->bind_param("i", $customer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $customer = $result->fetch_assoc();
        if(!$customer){
            respond('error', 'Customer not found.');
        }
        $stmt->close();
    }
    
    // Get customer loyalty info if applying loyalty discount
    $loyaltyDiscountPercent = 0;
    $loyaltyTier = 'New Customer';
    $loyaltyLabel = '';
    
    if($applyLoyaltyDiscount && $customer_id){
        // Get order history
        $stmt = $conn->prepare("SELECT COUNT(*) as total_orders, COALESCE(SUM(price), 0) as total_spent FROM orders WHERE customer_id = ?");
        $stmt->bind_param("i", $customer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $orderStats = $result->fetch_assoc();
        $stmt->close();
        
        // Get booking history
        $stmt = $conn->prepare("SELECT COUNT(*) as total_bookings, COALESCE(SUM(price), 0) as total_booking_spent FROM room_booking WHERE customer_id = ?");
        $stmt->bind_param("i", $customer_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $bookingStats = $result->fetch_assoc();
        $stmt->close();
        
        $totalOrders = (int)$orderStats['total_orders'];
        $totalBookings = (int)$bookingStats['total_bookings'];
        $totalSpent = (float)$orderStats['total_spent'] + (float)$bookingStats['total_booking_spent'];
        $totalTransactions = $totalOrders + $totalBookings;
        
        // Determine loyalty tier
        if($totalTransactions >= 50 || $totalSpent >= 10000){
            $loyaltyTier = 'VIP';
            $loyaltyDiscountPercent = 15;
            $loyaltyLabel = '⭐ VIP Customer - 15% Discount Applied';
        } elseif($totalTransactions >= 25 || $totalSpent >= 5000){
            $loyaltyTier = 'Gold';
            $loyaltyDiscountPercent = 10;
            $loyaltyLabel = '🥇 Gold Customer - 10% Discount Applied';
        } elseif($totalTransactions >= 10 || $totalSpent >= 2000){
            $loyaltyTier = 'Silver';
            $loyaltyDiscountPercent = 5;
            $loyaltyLabel = '🥈 Silver Customer - 5% Discount Applied';
        } elseif($totalTransactions >= 5 || $totalSpent >= 500){
            $loyaltyTier = 'Bronze';
            $loyaltyDiscountPercent = 3;
            $loyaltyLabel = '🥉 Bronze Customer - 3% Discount Applied';
        }
    }
    
    // Validate items and calculate total
    $totalPrice = 0;
    $validatedItems = [];
    
    foreach($items as $item){
        if(!isset($item['item_id']) || !isset($item['quantity'])){
            respond('error', 'Each item must have item_id and quantity.');
        }
        
        $item_id = (int)$item['item_id'];
        $quantity = (int)$item['quantity'];
        
        if($quantity <= 0){
            respond('error', 'Quantity must be greater than 0.');
        }
        
        // Get item details and check stock
        $stmt = $conn->prepare("SELECT id, name, price, stock FROM cafeteria_items WHERE id = ?");
        $stmt->bind_param("i", $item_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $cafeteriaItem = $result->fetch_assoc();
        $stmt->close();
        
        if(!$cafeteriaItem){
            respond('error', "Item with ID $item_id not found.");
        }
        
        if($cafeteriaItem['stock'] < $quantity){
            respond('error', "Insufficient stock for {$cafeteriaItem['name']}. Available: {$cafeteriaItem['stock']}");
        }
        
        $itemTotal = $cafeteriaItem['price'] * $quantity;
        $totalPrice += $itemTotal;
        
        $validatedItems[] = [
            'item_id' => $item_id,
            'quantity' => $quantity,
            'price' => $cafeteriaItem['price'],
            'total_price' => $itemTotal,
            'name' => $cafeteriaItem['name']
        ];
    }
    
    // Determine which discount to apply (priority: manual percent > loyalty > fixed amount)
    $appliedDiscountPercent = 0;
    $discountType = 'none';
    
    if($discountPercent > 0){
        // Admin manually selected percentage
        $appliedDiscountPercent = $discountPercent;
        $discount = round(($totalPrice * $discountPercent) / 100, 2);
        $discountType = 'manual_percent';
    } elseif($applyLoyaltyDiscount && $loyaltyDiscountPercent > 0){
        // Apply loyalty discount
        $appliedDiscountPercent = $loyaltyDiscountPercent;
        $discount = round(($totalPrice * $loyaltyDiscountPercent) / 100, 2);
        $discountType = 'loyalty';
    } elseif($discount > 0){
        // Fixed amount discount
        $appliedDiscountPercent = round(($discount / $totalPrice) * 100, 2);
        $discountType = 'fixed_amount';
    }
    
    // Apply discount
    $finalPrice = $totalPrice - $discount;
    if($finalPrice < 0) $finalPrice = 0;
    
    // Create order
    $stmt = $conn->prepare("INSERT INTO orders (customer_id, price, discount) VALUES (?, ?, ?)");
    $stmt->bind_param("idd", $customer_id, $finalPrice, $discount);
    $stmt->execute();
    $orderId = $conn->insert_id;
    $stmt->close();
    
    // Insert order items and reduce stock
    foreach($validatedItems as $item){
        $stmt = $conn->prepare("INSERT INTO order_items (order_id, item_id, quantity, total_price) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiid", $orderId, $item['item_id'], $item['quantity'], $item['total_price']);
        $stmt->execute();
        $stmt->close();
        
        // Reduce stock
        $stmt = $conn->prepare("UPDATE cafeteria_items SET stock = stock - ? WHERE id = ?");
        $stmt->bind_param("ii", $item['quantity'], $item['item_id']);
        $stmt->execute();
        $stmt->close();
    }
    
    $response = [
        'message' => 'Order created successfully.',
        'order_id' => $orderId,
        'customer_name' => $customer ? $customer['name'] : 'Guest',
        'customer_id' => $customer_id,
        'subtotal' => $totalPrice,
        'discount' => $discount,
        'discount_percent' => $appliedDiscountPercent,
        'discount_type' => $discountType,
        'total_price' => $finalPrice,
        'items' => $validatedItems
    ];
    
    // Add loyalty info if applied
    if($discountType == 'loyalty'){
        $response['loyalty_tier'] = $loyaltyTier;
        $response['loyalty_label'] = $loyaltyLabel;
    }
    
    respond('success', $response);
}

function updateOrder(){
    global $conn;
    $admin = getAdmin();
    
    // Only superadmin can update orders
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can update orders.');
    }
    
    $input = requireParams(['id']);
    $id = $input['id'];
    
    // Get current order
    $stmt = $conn->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $order = $result->fetch_assoc();
    $stmt->close();
    
    if(!$order){
        respond('error', 'Order not found.');
    }
    
    // Update discount if provided
    if(isset($input['discount'])){
        $discount = (float)$input['discount'];
        
        // Recalculate total from items
        $stmt = $conn->prepare("SELECT SUM(total_price) as subtotal FROM order_items WHERE order_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $subtotalData = $result->fetch_assoc();
        $stmt->close();
        
        $subtotal = (float)$subtotalData['subtotal'];
        $finalPrice = $subtotal - $discount;
        if($finalPrice < 0) $finalPrice = 0;
        
        $stmt = $conn->prepare("UPDATE orders SET discount = ?, price = ? WHERE id = ?");
        $stmt->bind_param("ddi", $discount, $finalPrice, $id);
        $stmt->execute();
        $stmt->close();
    }
    
    // Update customer if provided
    if(isset($input['customer_id'])){
        $customer_id = (int)$input['customer_id'];
        $stmt = $conn->prepare("UPDATE orders SET customer_id = ? WHERE id = ?");
        $stmt->bind_param("ii", $customer_id, $id);
        $stmt->execute();
        $stmt->close();
    }
    
    respond('success', 'Order updated successfully.');
}

function deleteOrder(){
    global $conn;
    $admin = getAdmin();
    
    // Only superadmin can delete orders
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can delete orders.');
    }
    
    $input = requireParams(['id']);
    $id = $input['id'];
    
    // Get order items to restore stock
    $stmt = $conn->prepare("SELECT item_id, quantity FROM order_items WHERE order_id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $items = [];
    while($row = $result->fetch_assoc()){
        $items[] = $row;
    }
    $stmt->close();
    
    // Restore stock
    foreach($items as $item){
        $stmt = $conn->prepare("UPDATE cafeteria_items SET stock = stock + ? WHERE id = ?");
        $stmt->bind_param("ii", $item['quantity'], $item['item_id']);
        $stmt->execute();
        $stmt->close();
    }
    
    // Delete order items
    $stmt = $conn->prepare("DELETE FROM order_items WHERE order_id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
    
    // Delete order
    $stmt = $conn->prepare("DELETE FROM orders WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
    
    respond('success', 'Order deleted successfully and stock restored.');
}

function deleteOrderItems(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['order_item_id']);
    $order_item_id = (int)$input['order_item_id'];
    
    // Get order item details
    $stmt = $conn->prepare("SELECT oi.*, o.discount as order_discount FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.id = ?");
    $stmt->bind_param("i", $order_item_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $orderItem = $result->fetch_assoc();
    $stmt->close();
    
    if(!$orderItem){
        respond('error', 'Order item not found.');
    }
    
    $order_id = $orderItem['order_id'];
    $item_id = $orderItem['item_id'];
    $quantity = $orderItem['quantity'];
    $item_total_price = (float)$orderItem['total_price'];
    $order_discount = (float)$orderItem['order_discount'];
    
    // Restore stock
    $stmt = $conn->prepare("UPDATE cafeteria_items SET stock = stock + ? WHERE id = ?");
    $stmt->bind_param("ii", $quantity, $item_id);
    $stmt->execute();
    $stmt->close();
    
    // Delete the order item
    $stmt = $conn->prepare("DELETE FROM order_items WHERE id = ?");
    $stmt->bind_param("i", $order_item_id);
    $stmt->execute();
    $stmt->close();
    
    // Check if there are remaining items in the order
    $stmt = $conn->prepare("SELECT COUNT(*) as remaining_count, COALESCE(SUM(total_price), 0) as new_subtotal FROM order_items WHERE order_id = ?");
    $stmt->bind_param("i", $order_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $remaining = $result->fetch_assoc();
    $stmt->close();
    
    if((int)$remaining['remaining_count'] == 0){
        // No items left, delete the order
        $stmt = $conn->prepare("DELETE FROM orders WHERE id = ?");
        $stmt->bind_param("i", $order_id);
        $stmt->execute();
        $stmt->close();
        
        respond('success', [
            'message' => 'Order item deleted and stock restored. Order was also deleted as it had no remaining items.',
            'order_deleted' => true,
            'stock_restored' => $quantity
        ]);
    } else {
        // Recalculate order total
        $new_subtotal = (float)$remaining['new_subtotal'];
        $new_price = $new_subtotal - $order_discount;
        if($new_price < 0) $new_price = 0;
        
        $stmt = $conn->prepare("UPDATE orders SET price = ? WHERE id = ?");
        $stmt->bind_param("di", $new_price, $order_id);
        $stmt->execute();
        $stmt->close();
        
        respond('success', [
            'message' => 'Order item deleted and stock restored.',
            'order_deleted' => false,
            'stock_restored' => $quantity,
            'new_order_subtotal' => $new_subtotal,
            'new_order_total' => $new_price,
            'remaining_items' => (int)$remaining['remaining_count']
        ]);
    }
}

function listOrders(){
    global $conn;
    $admin = getAdmin();
    
    $result = $conn->query("SELECT o.*, c.name as customer_name, c.phone as customer_phone FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ORDER BY o.created_at DESC");
    $orders = [];
    while($row = $result->fetch_assoc()){
        // Get order items
        $stmt = $conn->prepare("SELECT oi.*, ci.name as item_name, ci.photo as item_photo FROM order_items oi LEFT JOIN cafeteria_items ci ON oi.item_id = ci.id WHERE oi.order_id = ?");
        $stmt->bind_param("i", $row['id']);
        $stmt->execute();
        $itemResult = $stmt->get_result();
        $items = [];
        while($itemRow = $itemResult->fetch_assoc()){
            $items[] = $itemRow;
        }
        $stmt->close();
        
        $row['items'] = $items;
        $orders[] = $row;
    }
    
    // If superadmin, include summary analytics
    if($admin['role'] == 'superadmin'){
        // Total orders count
        $totalOrders = count($orders);
        
        // Total revenue
        $revenueResult = $conn->query("SELECT COALESCE(SUM(price), 0) as total_revenue, COALESCE(SUM(discount), 0) as total_discount FROM orders");
        $revenueData = $revenueResult->fetch_assoc();
        
        // Orders today
        $todayResult = $conn->query("SELECT COUNT(*) as orders_today, COALESCE(SUM(price), 0) as revenue_today FROM orders WHERE DATE(created_at) = CURDATE()");
        $todayData = $todayResult->fetch_assoc();
        
        // Orders this month
        $monthResult = $conn->query("SELECT COUNT(*) as orders_this_month, COALESCE(SUM(price), 0) as revenue_this_month FROM orders WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())");
        $monthData = $monthResult->fetch_assoc();
        
        // Average order value
        $avgOrderValue = $totalOrders > 0 ? round($revenueData['total_revenue'] / $totalOrders, 2) : 0;
        
        // Top selling items
        $topItemsResult = $conn->query("SELECT ci.id, ci.name, SUM(oi.quantity) as total_sold, SUM(oi.total_price) as total_revenue FROM order_items oi JOIN cafeteria_items ci ON oi.item_id = ci.id GROUP BY ci.id ORDER BY total_sold DESC LIMIT 5");
        $topItems = [];
        while($row = $topItemsResult->fetch_assoc()){
            $topItems[] = $row;
        }
        
        $analytics = [
            'total_orders' => $totalOrders,
            'total_revenue' => (float)$revenueData['total_revenue'],
            'total_discount_given' => (float)$revenueData['total_discount'],
            'orders_today' => (int)$todayData['orders_today'],
            'revenue_today' => (float)$todayData['revenue_today'],
            'orders_this_month' => (int)$monthData['orders_this_month'],
            'revenue_this_month' => (float)$monthData['revenue_this_month'],
            'avg_order_value' => $avgOrderValue,
            'top_selling_items' => $topItems
        ];
        
        respond('success', ['orders' => $orders, 'analytics' => $analytics]);
    }
    
    respond('success', $orders);
}

function getOrder(){
    global $conn;
    $admin = getAdmin();

    $input = requireParams(['id']);
    $id = $input['id'];
    $stmt = $conn->prepare("SELECT o.*, c.name as customer_name, c.phone as customer_phone FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $order = $result->fetch_assoc();
    $stmt->close();

    if(!$order){
        respond('error', 'Order not found.');
    }

    // Get order items
    $stmt = $conn->prepare("SELECT oi.*, ci.name as item_name, ci.photo as item_photo, ci.cost as item_cost FROM order_items oi LEFT JOIN cafeteria_items ci ON oi.item_id = ci.id WHERE oi.order_id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $itemResult = $stmt->get_result();
    $items = [];
    $totalCost = 0;
    while($itemRow = $itemResult->fetch_assoc()){
        $totalCost += $itemRow['item_cost'] * $itemRow['quantity'];
        $items[] = $itemRow;
    }
    $stmt->close();

    $order['items'] = $items;

    // If superadmin, include profit analytics
    if($admin['role'] == 'superadmin'){
        $profit = (float)$order['price'] - $totalCost;
        
        // Customer order history
        $stmt = $conn->prepare("SELECT COUNT(*) as total_orders, COALESCE(SUM(price), 0) as total_spent FROM orders WHERE customer_id = ?");
        $stmt->bind_param("i", $order['customer_id']);
        $stmt->execute();
        $result = $stmt->get_result();
        $customerStats = $result->fetch_assoc();
        $stmt->close();
        
        $order['analytics'] = [
            'subtotal' => (float)$order['price'] + (float)$order['discount'],
            'total_cost' => round($totalCost, 2),
            'profit' => round($profit, 2),
            'profit_margin' => $order['price'] > 0 ? round(($profit / $order['price']) * 100, 2) : 0,
            'customer_total_orders' => (int)$customerStats['total_orders'],
            'customer_total_spent' => (float)$customerStats['total_spent']
        ];
    }

    respond('success', $order);
}

function getOrdersAnalytics(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view analytics.');
    }
    
    // Daily revenue for current month
    $dailyResult = $conn->query("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as order_count,
            COALESCE(SUM(price), 0) as revenue,
            COALESCE(SUM(discount), 0) as discount
        FROM orders 
        WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $dailyRevenue = [];
    while($row = $dailyResult->fetch_assoc()){
        $dailyRevenue[] = $row;
    }
    
    // Monthly revenue for current year
    $monthlyResult = $conn->query("
        SELECT 
            MONTH(created_at) as month,
            MONTHNAME(created_at) as month_name,
            COUNT(*) as order_count,
            COALESCE(SUM(price), 0) as revenue
        FROM orders 
        WHERE YEAR(created_at) = YEAR(CURDATE())
        GROUP BY MONTH(created_at)
        ORDER BY month ASC
    ");
    $monthlyRevenue = [];
    while($row = $monthlyResult->fetch_assoc()){
        $monthlyRevenue[] = $row;
    }
    
    // Top customers
    $topCustomersResult = $conn->query("
        SELECT 
            c.id, c.name, c.phone,
            COUNT(o.id) as order_count,
            COALESCE(SUM(o.price), 0) as total_spent
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        GROUP BY c.id
        ORDER BY total_spent DESC
        LIMIT 10
    ");
    $topCustomers = [];
    while($row = $topCustomersResult->fetch_assoc()){
        $topCustomers[] = $row;
    }
    
    // Overall profit calculation
    $profitResult = $conn->query("
        SELECT 
            COALESCE(SUM(oi.total_price), 0) as total_revenue,
            COALESCE(SUM(ci.cost * oi.quantity), 0) as total_cost
        FROM order_items oi
        JOIN cafeteria_items ci ON oi.item_id = ci.id
    ");
    $profitData = $profitResult->fetch_assoc();
    $totalProfit = (float)$profitData['total_revenue'] - (float)$profitData['total_cost'];
    
    respond('success', [
        'daily_revenue' => $dailyRevenue,
        'monthly_revenue' => $monthlyRevenue,
        'top_customers' => $topCustomers,
        'total_revenue' => (float)$profitData['total_revenue'],
        'total_cost' => (float)$profitData['total_cost'],
        'total_profit' => round($totalProfit, 2),
        'profit_margin' => $profitData['total_revenue'] > 0 ? round(($totalProfit / $profitData['total_revenue']) * 100, 2) : 0
    ]);
}


function dashboardAnalyticsForSuperadmin(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view dashboard analytics.');
    }
    
    // Total customers
    $customerResult = $conn->query("SELECT COUNT(*) as total_customers FROM customers");
    $customerData = $customerResult->fetch_assoc();
    
    // Total orders and revenue
    $orderResult = $conn->query("SELECT COUNT(*) as total_orders, COALESCE(SUM(price), 0) as total_revenue FROM orders");
    $orderData = $orderResult->fetch_assoc();
    
    // Total room bookings and revenue
    $bookingResult = $conn->query("SELECT COUNT(*) as total_bookings, COALESCE(SUM(price), 0) as total_booking_revenue FROM room_booking");
    $bookingData = $bookingResult->fetch_assoc();
    
    respond('success', [
        'total_customers' => (int)$customerData['total_customers'],
        'total_orders' => (int)$orderData['total_orders'],
        'total_order_revenue' => (float)$orderData['total_revenue'],
        'total_room_bookings' => (int)$bookingData['total_bookings'],
        'total_booking_revenue' => (float)$bookingData['total_booking_revenue']
    ]);
}

// ==================== COMPREHENSIVE ANALYTICS WITH DATE RANGE ====================

/**
 * Full Orders Analytics with date range and export support
 * Params: start_date (optional), end_date (optional), export (optional: 'json', 'csv')
 */
function getFullOrdersAnalytics(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view analytics.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $startDate = isset($input['start_date']) ? $input['start_date'] : null;
    $endDate = isset($input['end_date']) ? $input['end_date'] : null;
    $export = isset($input['export']) ? $input['export'] : null;
    
    // Build date filter
    $dateFilter = "";
    $dateFilterItems = "";
    if($startDate && $endDate){
        $dateFilter = " WHERE DATE(created_at) BETWEEN '$startDate' AND '$endDate'";
        $dateFilterItems = " WHERE DATE(o.created_at) BETWEEN '$startDate' AND '$endDate'";
    } elseif($startDate){
        $dateFilter = " WHERE DATE(created_at) >= '$startDate'";
        $dateFilterItems = " WHERE DATE(o.created_at) >= '$startDate'";
    } elseif($endDate){
        $dateFilter = " WHERE DATE(created_at) <= '$endDate'";
        $dateFilterItems = " WHERE DATE(o.created_at) <= '$endDate'";
    }
    
    // Summary stats
    $summaryResult = $conn->query("
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(price), 0) as total_revenue,
            COALESCE(SUM(discount), 0) as total_discount,
            COALESCE(AVG(price), 0) as avg_order_value,
            COALESCE(MIN(price), 0) as min_order_value,
            COALESCE(MAX(price), 0) as max_order_value
        FROM orders $dateFilter
    ");
    $summary = $summaryResult->fetch_assoc();
    
    // Daily breakdown
    $dailyResult = $conn->query("
        SELECT 
            DATE(created_at) as date,
            DAYNAME(created_at) as day_name,
            COUNT(*) as order_count,
            COALESCE(SUM(price), 0) as revenue,
            COALESCE(SUM(discount), 0) as discount_given,
            COALESCE(AVG(price), 0) as avg_order_value
        FROM orders $dateFilter
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $dailyBreakdown = [];
    while($row = $dailyResult->fetch_assoc()){
        $dailyBreakdown[] = $row;
    }
    
    // Hourly distribution (peak hours)
    $hourlyResult = $conn->query("
        SELECT 
            HOUR(created_at) as hour,
            COUNT(*) as order_count,
            COALESCE(SUM(price), 0) as revenue
        FROM orders $dateFilter
        GROUP BY HOUR(created_at)
        ORDER BY hour ASC
    ");
    $hourlyDistribution = [];
    while($row = $hourlyResult->fetch_assoc()){
        $hourlyDistribution[] = $row;
    }
    
    // Top selling items
    $topItemsQuery = "
        SELECT 
            ci.id, ci.name, ci.price, ci.cost, ci.photo,
            SUM(oi.quantity) as total_sold,
            SUM(oi.total_price) as total_revenue,
            SUM(ci.cost * oi.quantity) as total_cost,
            SUM(oi.total_price) - SUM(ci.cost * oi.quantity) as profit
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN cafeteria_items ci ON oi.item_id = ci.id
        " . ($dateFilterItems ? $dateFilterItems : "") . "
        GROUP BY ci.id
        ORDER BY total_sold DESC
        LIMIT 20
    ";
    $topItemsResult = $conn->query($topItemsQuery);
    $topSellingItems = [];
    while($row = $topItemsResult->fetch_assoc()){
        $topSellingItems[] = $row;
    }
    
    // Top customers by spending
    $topCustomersQuery = "
        SELECT 
            c.id, c.name, c.phone,
            COUNT(o.id) as order_count,
            COALESCE(SUM(o.price), 0) as total_spent,
            COALESCE(AVG(o.price), 0) as avg_order_value,
            MIN(o.created_at) as first_order,
            MAX(o.created_at) as last_order
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        " . ($dateFilterItems ? str_replace('o.created_at', 'o.created_at', $dateFilterItems) : "") . "
        GROUP BY c.id
        ORDER BY total_spent DESC
        LIMIT 20
    ";
    $topCustomersResult = $conn->query($topCustomersQuery);
    $topCustomers = [];
    while($row = $topCustomersResult->fetch_assoc()){
        $topCustomers[] = $row;
    }
    
    // Profit analysis
    $profitQuery = "
        SELECT 
            COALESCE(SUM(oi.total_price), 0) as gross_revenue,
            COALESCE(SUM(ci.cost * oi.quantity), 0) as total_cost
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN cafeteria_items ci ON oi.item_id = ci.id
        " . ($dateFilterItems ? $dateFilterItems : "") . "
    ";
    $profitResult = $conn->query($profitQuery);
    $profitData = $profitResult->fetch_assoc();
    $grossRevenue = (float)$profitData['gross_revenue'];
    $totalCost = (float)$profitData['total_cost'];
    $grossProfit = $grossRevenue - $totalCost;
    
    // All orders for export
    $ordersForExport = [];
    if($export){
        $ordersQuery = "
            SELECT 
                o.id as order_id,
                o.created_at,
                c.name as customer_name,
                c.phone as customer_phone,
                o.price as total_price,
                o.discount
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            $dateFilter
            ORDER BY o.created_at DESC
        ";
        $ordersResult = $conn->query($ordersQuery);
        while($row = $ordersResult->fetch_assoc()){
            $ordersForExport[] = $row;
        }
    }
    
    $response = [
        'date_range' => [
            'start_date' => $startDate ?? 'all time',
            'end_date' => $endDate ?? 'all time'
        ],
        'summary' => [
            'total_orders' => (int)$summary['total_orders'],
            'total_revenue' => round((float)$summary['total_revenue'], 2),
            'total_discount_given' => round((float)$summary['total_discount'], 2),
            'avg_order_value' => round((float)$summary['avg_order_value'], 2),
            'min_order_value' => round((float)$summary['min_order_value'], 2),
            'max_order_value' => round((float)$summary['max_order_value'], 2),
            'gross_profit' => round($grossProfit, 2),
            'profit_margin' => $grossRevenue > 0 ? round(($grossProfit / $grossRevenue) * 100, 2) : 0,
            'total_cost' => round($totalCost, 2)
        ],
        'daily_breakdown' => $dailyBreakdown,
        'hourly_distribution' => $hourlyDistribution,
        'top_selling_items' => $topSellingItems,
        'top_customers' => $topCustomers
    ];
    
    if($export){
        $response['orders_export'] = $ordersForExport;
    }
    
    respond('success', $response);
}

/**
 * Full Room Bookings Analytics with date range and export support
 * Params: start_date (optional), end_date (optional), export (optional)
 */
function getFullRoomAnalytics(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view analytics.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $startDate = isset($input['start_date']) ? $input['start_date'] : null;
    $endDate = isset($input['end_date']) ? $input['end_date'] : null;
    $export = isset($input['export']) ? $input['export'] : null;
    
    // Build date filter
    $dateFilter = "";
    if($startDate && $endDate){
        $dateFilter = " WHERE DATE(rb.createdAt) BETWEEN '$startDate' AND '$endDate'";
    } elseif($startDate){
        $dateFilter = " WHERE DATE(rb.createdAt) >= '$startDate'";
    } elseif($endDate){
        $dateFilter = " WHERE DATE(rb.createdAt) <= '$endDate'";
    }
    
    $dateFilterSimple = str_replace('rb.createdAt', 'createdAt', $dateFilter);
    
    // Summary stats
    $summaryResult = $conn->query("
        SELECT 
            COUNT(*) as total_bookings,
            COALESCE(SUM(price), 0) as total_revenue,
            COALESCE(AVG(price), 0) as avg_booking_value,
            COALESCE(AVG(TIMESTAMPDIFF(MINUTE, started_at, finished_at)), 0) as avg_duration_minutes,
            COUNT(CASE WHEN finished_at IS NULL THEN 1 END) as active_sessions
        FROM room_booking $dateFilterSimple
    ");
    $summary = $summaryResult->fetch_assoc();
    
    // Room performance
    $roomPerformanceResult = $conn->query("
        SELECT 
            r.id, r.name, r.ps, r.hour_cost, r.capacity,
            COUNT(rb.id) as booking_count,
            COALESCE(SUM(rb.price), 0) as total_revenue,
            COALESCE(AVG(rb.price), 0) as avg_booking_value,
            COALESCE(AVG(TIMESTAMPDIFF(MINUTE, rb.started_at, rb.finished_at)), 0) as avg_duration_minutes,
            COUNT(DISTINCT rb.customer_id) as unique_customers
        FROM rooms r
        LEFT JOIN room_booking rb ON r.id = rb.room_id " . ($dateFilter ? "AND " . str_replace(" WHERE ", "", $dateFilter) : "") . "
        GROUP BY r.id
        ORDER BY total_revenue DESC
    ");
    $roomPerformance = [];
    while($row = $roomPerformanceResult->fetch_assoc()){
        $row['avg_duration_hours'] = round((float)$row['avg_duration_minutes'] / 60, 2);
        $roomPerformance[] = $row;
    }
    
    // Daily breakdown
    $dailyResult = $conn->query("
        SELECT 
            DATE(createdAt) as date,
            DAYNAME(createdAt) as day_name,
            COUNT(*) as booking_count,
            COALESCE(SUM(price), 0) as revenue,
            COALESCE(AVG(TIMESTAMPDIFF(MINUTE, started_at, finished_at)), 0) as avg_duration_minutes
        FROM room_booking $dateFilterSimple
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
    ");
    $dailyBreakdown = [];
    while($row = $dailyResult->fetch_assoc()){
        $row['avg_duration_hours'] = round((float)$row['avg_duration_minutes'] / 60, 2);
        $dailyBreakdown[] = $row;
    }
    
    // Hourly distribution (peak hours)
    $hourlyResult = $conn->query("
        SELECT 
            HOUR(started_at) as hour,
            COUNT(*) as booking_count,
            COALESCE(SUM(price), 0) as revenue
        FROM room_booking $dateFilterSimple
        GROUP BY HOUR(started_at)
        ORDER BY hour ASC
    ");
    $hourlyDistribution = [];
    while($row = $hourlyResult->fetch_assoc()){
        $hourlyDistribution[] = $row;
    }
    
    // Top customers by room bookings
    $topCustomersResult = $conn->query("
        SELECT 
            c.id, c.name, c.phone,
            COUNT(rb.id) as booking_count,
            COALESCE(SUM(rb.price), 0) as total_spent,
            COALESCE(AVG(TIMESTAMPDIFF(MINUTE, rb.started_at, rb.finished_at)), 0) as avg_duration_minutes
        FROM customers c
        JOIN room_booking rb ON c.id = rb.customer_id " . ($dateFilter ? "AND " . str_replace(" WHERE ", "", $dateFilter) : "") . "
        GROUP BY c.id
        ORDER BY total_spent DESC
        LIMIT 20
    ");
    $topCustomers = [];
    while($row = $topCustomersResult->fetch_assoc()){
        $row['avg_duration_hours'] = round((float)$row['avg_duration_minutes'] / 60, 2);
        $topCustomers[] = $row;
    }
    
    // Day of week analysis
    $dayOfWeekResult = $conn->query("
        SELECT 
            DAYNAME(createdAt) as day_name,
            DAYOFWEEK(createdAt) as day_number,
            COUNT(*) as booking_count,
            COALESCE(SUM(price), 0) as revenue
        FROM room_booking $dateFilterSimple
        GROUP BY DAYOFWEEK(createdAt), DAYNAME(createdAt)
        ORDER BY day_number ASC
    ");
    $dayOfWeekAnalysis = [];
    while($row = $dayOfWeekResult->fetch_assoc()){
        $dayOfWeekAnalysis[] = $row;
    }
    
    // All bookings data for calendar view
    $allBookingsQuery = "
        SELECT 
            rb.id as booking_id,
            rb.room_id,
            rb.customer_id,
            rb.createdAt as created_at,
            rb.started_at,
            rb.finished_at,
            rb.price,
            rb.is_multi,
            rb.discount,
            r.name as room_name,
            r.ps as room_ps,
            r.hour_cost,
            r.multi_hour_cost,
            r.capacity as room_capacity,
            c.name as customer_name,
            c.phone as customer_phone,
            TIMESTAMPDIFF(MINUTE, rb.started_at, rb.finished_at) as duration_minutes,
            DATE(rb.started_at) as booking_date,
            TIME(rb.started_at) as start_time,
            TIME(rb.finished_at) as end_time,
            CASE 
                WHEN rb.finished_at IS NULL THEN 'active'
                WHEN rb.finished_at IS NOT NULL AND rb.price > 0 THEN 'completed'
                ELSE 'pending'
            END as status
        FROM room_booking rb
        JOIN rooms r ON rb.room_id = r.id
        LEFT JOIN customers c ON rb.customer_id = c.id
        " . ($dateFilter ? $dateFilter : "") . "
        ORDER BY rb.started_at ASC
    ";
    $allBookingsResult = $conn->query($allBookingsQuery);
    $allBookings = [];
    while($row = $allBookingsResult->fetch_assoc()){
        $row['duration_hours'] = $row['duration_minutes'] ? round((float)$row['duration_minutes'] / 60, 2) : null;
        $row['is_multi'] = (int)$row['is_multi'];
        $row['price'] = (float)$row['price'];
        $row['discount'] = (float)$row['discount'];
        $row['hour_cost'] = (float)$row['hour_cost'];
        $row['multi_hour_cost'] = (float)$row['multi_hour_cost'];
        $allBookings[] = $row;
    }
    
    // Bookings for export
    $bookingsForExport = [];
    if($export){
        $bookingsForExport = $allBookings;
    }
    
    $data = [
        'date_range' => [
            'start_date' => $startDate ?? 'all time',
            'end_date' => $endDate ?? 'all time'
        ],
        'summary' => [
            'total_bookings' => (int)$summary['total_bookings'],
            'total_revenue' => (float)$summary['total_revenue'],
            'avg_booking_value' => (float)$summary['avg_booking_value'],
            'avg_duration_hours' => round((float)$summary['avg_duration_minutes'] / 60, 2),
            'active_sessions' => (int)$summary['active_sessions']
        ],
        'room_performance' => $roomPerformance,
        'daily_breakdown' => $dailyBreakdown,
        'hourly_distribution' => $hourlyDistribution,
        'day_of_week_analysis' => $dayOfWeekAnalysis,
        'top_customers' => $topCustomers,
        'all_bookings' => $allBookings
    ];
    
    if($export){
        $data['bookings_export'] = $bookingsForExport;
    }
    
    respond('success', $data);
}

/**
 * Full Cafeteria/Inventory Analytics with date range and export support
 * Params: start_date (optional), end_date (optional), export (optional)
 */
function getFullCafeteriaAnalytics(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view analytics.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $startDate = isset($input['start_date']) ? $input['start_date'] : null;
    $endDate = isset($input['end_date']) ? $input['end_date'] : null;
    $export = isset($input['export']) ? $input['export'] : null;
    
    // Build date filter
    $dateFilter = "";
    if($startDate && $endDate){
        $dateFilter = " AND DATE(o.created_at) BETWEEN '$startDate' AND '$endDate'";
    } elseif($startDate){
        $dateFilter = " AND DATE(o.created_at) >= '$startDate'";
    } elseif($endDate){
        $dateFilter = " AND DATE(o.created_at) <= '$endDate'";
    }
    
    // All items with sales data
    $itemsResult = $conn->query("
        SELECT 
            ci.id, ci.name, ci.cost, ci.price, ci.stock, ci.photo,
            COALESCE(SUM(oi.quantity), 0) as total_sold,
            COALESCE(SUM(oi.total_price), 0) as total_revenue,
            COALESCE(SUM(ci.cost * oi.quantity), 0) as total_cost,
            COALESCE(SUM(oi.total_price) - SUM(ci.cost * oi.quantity), 0) as profit,
            COUNT(DISTINCT oi.order_id) as order_count
        FROM cafeteria_items ci
        LEFT JOIN order_items oi ON ci.id = oi.item_id
        LEFT JOIN orders o ON oi.order_id = o.id " . ($dateFilter ? "AND 1=1 $dateFilter" : "") . "
        GROUP BY ci.id
        ORDER BY total_sold DESC
    ");
    $allItems = [];
    $totalInventoryValue = 0;
    $totalPotentialRevenue = 0;
    while($row = $itemsResult->fetch_assoc()){
        $row['profit_margin'] = $row['total_revenue'] > 0 ? round(((float)$row['profit'] / (float)$row['total_revenue']) * 100, 2) : 0;
        $row['inventory_value'] = (float)$row['cost'] * (int)$row['stock'];
        $row['potential_revenue'] = (float)$row['price'] * (int)$row['stock'];
        $totalInventoryValue += $row['inventory_value'];
        $totalPotentialRevenue += $row['potential_revenue'];
        $allItems[] = $row;
    }
    
    // Low stock items (stock <= 10)
    $lowStockResult = $conn->query("SELECT id, name, stock, cost, price FROM cafeteria_items WHERE stock <= 10 ORDER BY stock ASC");
    $lowStockItems = [];
    while($row = $lowStockResult->fetch_assoc()){
        $lowStockItems[] = $row;
    }
    
    // Out of stock items
    $outOfStockResult = $conn->query("SELECT id, name, cost, price FROM cafeteria_items WHERE stock = 0");
    $outOfStockItems = [];
    while($row = $outOfStockResult->fetch_assoc()){
        $outOfStockItems[] = $row;
    }
    
    // Category summary (top performers vs low performers)
    $topPerformers = array_slice($allItems, 0, 5);
    $lowPerformers = array_slice(array_reverse($allItems), 0, 5);
    
    // Daily sales trend
    $dailySalesQuery = "
        SELECT 
            DATE(o.created_at) as date,
            COUNT(DISTINCT o.id) as order_count,
            SUM(oi.quantity) as items_sold,
            SUM(oi.total_price) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE 1=1 $dateFilter
        GROUP BY DATE(o.created_at)
        ORDER BY date ASC
    ";
    $dailySalesResult = $conn->query($dailySalesQuery);
    $dailySales = [];
    while($row = $dailySalesResult->fetch_assoc()){
        $dailySales[] = $row;
    }
    
    // Summary
    $totalItems = count($allItems);
    $totalSold = array_sum(array_column($allItems, 'total_sold'));
    $totalRevenue = array_sum(array_column($allItems, 'total_revenue'));
    $totalCost = array_sum(array_column($allItems, 'total_cost'));
    $totalProfit = $totalRevenue - $totalCost;
    
    $data = [
        'date_range' => [
            'start_date' => $startDate ?? 'all time',
            'end_date' => $endDate ?? 'all time'
        ],
        'summary' => [
            'total_items' => $totalItems,
            'total_units_sold' => (int)$totalSold,
            'total_revenue' => (float)$totalRevenue,
            'total_cost' => (float)$totalCost,
            'total_profit' => (float)$totalProfit,
            'profit_margin' => $totalRevenue > 0 ? round(($totalProfit / $totalRevenue) * 100, 2) : 0,
            'total_inventory_value' => (float)$totalInventoryValue,
            'total_potential_revenue' => (float)$totalPotentialRevenue,
            'low_stock_count' => count($lowStockItems),
            'out_of_stock_count' => count($outOfStockItems)
        ],
        'all_items' => $allItems,
        'top_performers' => $topPerformers,
        'low_performers' => $lowPerformers,
        'low_stock_items' => $lowStockItems,
        'out_of_stock_items' => $outOfStockItems,
        'daily_sales' => $dailySales
    ];
    
    if($export){
        $data['items_export'] = $allItems;
    }
    
    respond('success', $data);
}

/**
 * Full Customer Analytics with date range and export support
 * Params: start_date (optional), end_date (optional), export (optional)
 */
function getFullCustomerAnalytics(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view analytics.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $startDate = isset($input['start_date']) ? $input['start_date'] : null;
    $endDate = isset($input['end_date']) ? $input['end_date'] : null;
    $export = isset($input['export']) ? $input['export'] : null;
    
    // Build date filters
    $orderDateFilter = "";
    $bookingDateFilter = "";
    if($startDate && $endDate){
        $orderDateFilter = " AND DATE(o.created_at) BETWEEN '$startDate' AND '$endDate'";
        $bookingDateFilter = " AND DATE(rb.createdAt) BETWEEN '$startDate' AND '$endDate'";
    } elseif($startDate){
        $orderDateFilter = " AND DATE(o.created_at) >= '$startDate'";
        $bookingDateFilter = " AND DATE(rb.createdAt) >= '$startDate'";
    } elseif($endDate){
        $orderDateFilter = " AND DATE(o.created_at) <= '$endDate'";
        $bookingDateFilter = " AND DATE(rb.createdAt) <= '$endDate'";
    }
    
    // All customers with their stats
    $customersResult = $conn->query("
        SELECT 
            c.id, c.name, c.phone,
            COALESCE(order_stats.order_count, 0) as order_count,
            COALESCE(order_stats.order_spent, 0) as order_spent,
            COALESCE(booking_stats.booking_count, 0) as booking_count,
            COALESCE(booking_stats.booking_spent, 0) as booking_spent
        FROM customers c
        LEFT JOIN (
            SELECT customer_id, COUNT(*) as order_count, SUM(price) as order_spent
            FROM orders o
            WHERE 1=1 $orderDateFilter
            GROUP BY customer_id
        ) order_stats ON c.id = order_stats.customer_id
        LEFT JOIN (
            SELECT customer_id, COUNT(*) as booking_count, SUM(price) as booking_spent
            FROM room_booking rb
            WHERE 1=1 $bookingDateFilter
            GROUP BY customer_id
        ) booking_stats ON c.id = booking_stats.customer_id
        ORDER BY (COALESCE(order_stats.order_spent, 0) + COALESCE(booking_stats.booking_spent, 0)) DESC
    ");
    
    $allCustomers = [];
    $loyaltyTiers = ['VIP' => [], 'Gold' => [], 'Silver' => [], 'Bronze' => [], 'New Customer' => []];
    
    while($row = $customersResult->fetch_assoc()){
        $totalTransactions = (int)$row['order_count'] + (int)$row['booking_count'];
        $totalSpent = (float)$row['order_spent'] + (float)$row['booking_spent'];
        
        $row['total_transactions'] = $totalTransactions;
        $row['total_spent'] = round($totalSpent, 2);
        
        // Determine loyalty tier
        if($totalTransactions >= 50 || $totalSpent >= 10000){
            $row['loyalty_tier'] = 'VIP';
            $loyaltyTiers['VIP'][] = $row;
        } elseif($totalTransactions >= 25 || $totalSpent >= 5000){
            $row['loyalty_tier'] = 'Gold';
            $loyaltyTiers['Gold'][] = $row;
        } elseif($totalTransactions >= 10 || $totalSpent >= 2000){
            $row['loyalty_tier'] = 'Silver';
            $loyaltyTiers['Silver'][] = $row;
        } elseif($totalTransactions >= 5 || $totalSpent >= 500){
            $row['loyalty_tier'] = 'Bronze';
            $loyaltyTiers['Bronze'][] = $row;
        } else {
            $row['loyalty_tier'] = 'New Customer';
            $loyaltyTiers['New Customer'][] = $row;
        }
        
        $allCustomers[] = $row;
    }
    
    // Summary
    $totalCustomers = count($allCustomers);
    $activeCustomers = count(array_filter($allCustomers, fn($c) => $c['total_transactions'] > 0));
    $totalRevenue = array_sum(array_column($allCustomers, 'total_spent'));
    $avgCustomerValue = $activeCustomers > 0 ? $totalRevenue / $activeCustomers : 0;
    
    // New customers in date range
    $newCustomersQuery = "SELECT COUNT(*) as new_customers FROM customers";
    // Note: customers table doesn't have created_at, so we approximate based on first order
    
    // Customer retention (customers with more than 1 transaction)
    $returningCustomers = count(array_filter($allCustomers, fn($c) => $c['total_transactions'] > 1));
    $retentionRate = $activeCustomers > 0 ? round(($returningCustomers / $activeCustomers) * 100, 2) : 0;
    
    $data = [
        'date_range' => [
            'start_date' => $startDate ?? 'all time',
            'end_date' => $endDate ?? 'all time'
        ],
        'summary' => [
            'total_customers' => $totalCustomers,
            'active_customers' => $activeCustomers,
            'inactive_customers' => $totalCustomers - $activeCustomers,
            'returning_customers' => $returningCustomers,
            'retention_rate' => $retentionRate,
            'total_revenue' => (float)$totalRevenue,
            'avg_customer_lifetime_value' => (float)$avgCustomerValue
        ],
        'loyalty_breakdown' => [
            'VIP' => ['count' => count($loyaltyTiers['VIP']), 'customers' => array_slice($loyaltyTiers['VIP'], 0, 10)],
            'Gold' => ['count' => count($loyaltyTiers['Gold']), 'customers' => array_slice($loyaltyTiers['Gold'], 0, 10)],
            'Silver' => ['count' => count($loyaltyTiers['Silver']), 'customers' => array_slice($loyaltyTiers['Silver'], 0, 10)],
            'Bronze' => ['count' => count($loyaltyTiers['Bronze']), 'customers' => array_slice($loyaltyTiers['Bronze'], 0, 10)],
            'New Customer' => ['count' => count($loyaltyTiers['New Customer']), 'customers' => array_slice($loyaltyTiers['New Customer'], 0, 10)]
        ],
        'top_customers' => array_slice($allCustomers, 0, 20)
    ];
    
    if($export){
        $data['customers_export'] = $allCustomers;
    }
    
    respond('success', $data);
}

/**
 * Full Staff/Admin Analytics with date range and export support
 * Params: start_date (optional), end_date (optional), export (optional)
 */
function getFullStaffAnalytics(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view analytics.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $startDate = isset($input['start_date']) ? $input['start_date'] : null;
    $endDate = isset($input['end_date']) ? $input['end_date'] : null;
    $export = isset($input['export']) ? $input['export'] : null;
    
    // Build date filter
    $dateFilter = "";
    if($startDate && $endDate){
        $dateFilter = " AND DATE(s.created_at) BETWEEN '$startDate' AND '$endDate'";
    } elseif($startDate){
        $dateFilter = " AND DATE(s.created_at) >= '$startDate'";
    } elseif($endDate){
        $dateFilter = " AND DATE(s.created_at) <= '$endDate'";
    }
    
    // All staff with attendance
    $staffResult = $conn->query("
        SELECT 
            a.id, a.name, a.email, a.role, a.status,
            COUNT(DISTINCT DATE(s.created_at)) as days_present,
            COUNT(s.id) as total_sessions,
            MIN(s.created_at) as first_login,
            MAX(s.created_at) as last_login
        FROM admins a
        LEFT JOIN session s ON a.id = s.admin_id " . ($dateFilter ? "AND 1=1 $dateFilter" : "") . "
        WHERE a.role != 'superadmin'
        GROUP BY a.id
        ORDER BY days_present DESC
    ");
    
    $allStaff = [];
    while($row = $staffResult->fetch_assoc()){
        $allStaff[] = $row;
    }
    
    // Daily attendance breakdown
    $dailyAttendanceResult = $conn->query("
        SELECT 
            DATE(s.created_at) as date,
            DAYNAME(s.created_at) as day_name,
            COUNT(DISTINCT s.admin_id) as staff_present,
            COUNT(s.id) as total_logins
        FROM session s
        JOIN admins a ON s.admin_id = a.id
        WHERE a.role != 'superadmin' " . $dateFilter . "
        GROUP BY DATE(s.created_at)
        ORDER BY date ASC
    ");
    $dailyAttendance = [];
    while($row = $dailyAttendanceResult->fetch_assoc()){
        $dailyAttendance[] = $row;
    }
    
    // Login hours distribution
    $hourlyLoginsResult = $conn->query("
        SELECT 
            HOUR(s.created_at) as hour,
            COUNT(*) as login_count
        FROM session s
        JOIN admins a ON s.admin_id = a.id
        WHERE a.role != 'superadmin' " . $dateFilter . "
        GROUP BY HOUR(s.created_at)
        ORDER BY hour ASC
    ");
    $hourlyLogins = [];
    while($row = $hourlyLoginsResult->fetch_assoc()){
        $hourlyLogins[] = $row;
    }
    
    // Summary
    $totalStaff = count($allStaff);
    $activeStaff = count(array_filter($allStaff, fn($s) => $s['status'] == 'active'));
    $totalDaysPresent = array_sum(array_column($allStaff, 'days_present'));
    $avgDaysPresent = $totalStaff > 0 ? round($totalDaysPresent / $totalStaff, 2) : 0;
    
    $data = [
        'date_range' => [
            'start_date' => $startDate ?? 'all time',
            'end_date' => $endDate ?? 'all time'
        ],
        'summary' => [
            'total_staff' => $totalStaff,
            'active_staff' => $activeStaff,
            'inactive_staff' => $totalStaff - $activeStaff,
            'avg_days_present' => $avgDaysPresent
        ],
        'staff_performance' => $allStaff,
        'daily_attendance' => $dailyAttendance,
        'hourly_login_distribution' => $hourlyLogins
    ];
    
    if($export){
        $data['staff_export'] = $allStaff;
    }
    
    respond('success', $data);
}

/**
 * Full Revenue/Financial Analytics with date range and export support
 * Params: start_date (optional), end_date (optional), export (optional)
 */
function getFullRevenueAnalytics(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view analytics.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $startDate = isset($input['start_date']) ? $input['start_date'] : null;
    $endDate = isset($input['end_date']) ? $input['end_date'] : null;
    $export = isset($input['export']) ? $input['export'] : null;
    
    // Build date filters
    $orderDateFilter = "";
    $bookingDateFilter = "";
    if($startDate && $endDate){
        $orderDateFilter = " WHERE DATE(created_at) BETWEEN '$startDate' AND '$endDate'";
        $bookingDateFilter = " WHERE DATE(createdAt) BETWEEN '$startDate' AND '$endDate'";
    } elseif($startDate){
        $orderDateFilter = " WHERE DATE(created_at) >= '$startDate'";
        $bookingDateFilter = " WHERE DATE(createdAt) >= '$startDate'";
    } elseif($endDate){
        $orderDateFilter = " WHERE DATE(created_at) <= '$endDate'";
        $bookingDateFilter = " WHERE DATE(createdAt) <= '$endDate'";
    }
    
    // Order revenue
    $orderRevenueResult = $conn->query("
        SELECT 
            COALESCE(SUM(price), 0) as revenue,
            COALESCE(SUM(discount), 0) as discount,
            COUNT(*) as count
        FROM orders $orderDateFilter
    ");
    $orderRevenue = $orderRevenueResult->fetch_assoc();
    
    // Booking revenue
    $bookingRevenueResult = $conn->query("
        SELECT 
            COALESCE(SUM(price), 0) as revenue,
            COUNT(*) as count
        FROM room_booking $bookingDateFilter
    ");
    $bookingRevenue = $bookingRevenueResult->fetch_assoc();
    
    // Order cost (for profit calculation)
    $orderCostQuery = "
        SELECT COALESCE(SUM(ci.cost * oi.quantity), 0) as total_cost
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN cafeteria_items ci ON oi.item_id = ci.id
        " . str_replace("WHERE", "WHERE 1=1 AND", $orderDateFilter ?: "WHERE 1=1");
    $orderCostResult = $conn->query($orderCostQuery);
    $orderCost = $orderCostResult->fetch_assoc();
    
    // Daily combined revenue
    $dailyRevenueResult = $conn->query("
        SELECT date, SUM(order_revenue) as order_revenue, SUM(booking_revenue) as booking_revenue, 
               SUM(order_revenue) + SUM(booking_revenue) as total_revenue
        FROM (
            SELECT DATE(created_at) as date, SUM(price) as order_revenue, 0 as booking_revenue
            FROM orders $orderDateFilter
            GROUP BY DATE(created_at)
            UNION ALL
            SELECT DATE(createdAt) as date, 0 as order_revenue, SUM(price) as booking_revenue
            FROM room_booking $bookingDateFilter
            GROUP BY DATE(createdAt)
        ) combined
        GROUP BY date
        ORDER BY date ASC
    ");
    $dailyRevenue = [];
    while($row = $dailyRevenueResult->fetch_assoc()){
        $dailyRevenue[] = $row;
    }
    
    // Monthly combined revenue
    $monthlyRevenueResult = $conn->query("
        SELECT month, month_name, SUM(order_revenue) as order_revenue, SUM(booking_revenue) as booking_revenue,
               SUM(order_revenue) + SUM(booking_revenue) as total_revenue
        FROM (
            SELECT MONTH(created_at) as month, MONTHNAME(created_at) as month_name, 
                   SUM(price) as order_revenue, 0 as booking_revenue
            FROM orders $orderDateFilter
            GROUP BY MONTH(created_at), MONTHNAME(created_at)
            UNION ALL
            SELECT MONTH(createdAt) as month, MONTHNAME(createdAt) as month_name,
                   0 as order_revenue, SUM(price) as booking_revenue
            FROM room_booking $bookingDateFilter
            GROUP BY MONTH(createdAt), MONTHNAME(createdAt)
        ) combined
        GROUP BY month, month_name
        ORDER BY month ASC
    ");
    $monthlyRevenue = [];
    while($row = $monthlyRevenueResult->fetch_assoc()){
        $monthlyRevenue[] = $row;
    }
    
    // Calculate totals
    $totalOrderRevenue = (float)$orderRevenue['revenue'];
    $totalBookingRevenue = (float)$bookingRevenue['revenue'];
    $totalRevenue = $totalOrderRevenue + $totalBookingRevenue;
    $totalCost = (float)$orderCost['total_cost'];
    $totalProfit = $totalOrderRevenue - $totalCost; // Only order profit (rooms have no cost)
    $totalDiscount = (float)$orderRevenue['discount'];
    
    $data = [
        'date_range' => [
            'start_date' => $startDate ?? 'all time',
            'end_date' => $endDate ?? 'all time'
        ],
        'summary' => [
            'total_revenue' => (float)$totalRevenue,
            'order_revenue' => (float)$totalOrderRevenue,
            'booking_revenue' => (float)$totalBookingRevenue,
            'total_cost' => (float)$totalCost,
            'gross_profit' => (float)($totalProfit + $totalBookingRevenue),
            'order_profit' => (float)$totalProfit,
            'profit_margin' => $totalRevenue > 0 ? round((($totalProfit + $totalBookingRevenue) / $totalRevenue) * 100, 2) : 0,
            'total_discount_given' => (float)$totalDiscount,
            'order_count' => (int)$orderRevenue['count'],
            'booking_count' => (int)$bookingRevenue['count'],
            'total_transactions' => (int)$orderRevenue['count'] + (int)$bookingRevenue['count']
        ],
        'revenue_breakdown' => [
            'orders_percentage' => $totalRevenue > 0 ? round(($totalOrderRevenue / $totalRevenue) * 100, 2) : 0,
            'bookings_percentage' => $totalRevenue > 0 ? round(($totalBookingRevenue / $totalRevenue) * 100, 2) : 0
        ],
        'daily_revenue' => $dailyRevenue,
        'monthly_revenue' => $monthlyRevenue
    ];
    
    if($export){
        $data['export_data'] = [
            'daily' => $dailyRevenue,
            'monthly' => $monthlyRevenue
        ];
    }
    
    respond('success', $data);
}

/**
 * Combined Dashboard Analytics - All data in one call
 * Params: start_date (optional), end_date (optional)
 */
function getFullDashboardAnalytics(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view analytics.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $startDate = isset($input['start_date']) ? $input['start_date'] : null;
    $endDate = isset($input['end_date']) ? $input['end_date'] : null;
    
    // Build date filters
    $orderDateFilter = "";
    $bookingDateFilter = "";
    if($startDate && $endDate){
        $orderDateFilter = " WHERE DATE(created_at) BETWEEN '$startDate' AND '$endDate'";
        $bookingDateFilter = " WHERE DATE(createdAt) BETWEEN '$startDate' AND '$endDate'";
    } elseif($startDate){
        $orderDateFilter = " WHERE DATE(created_at) >= '$startDate'";
        $bookingDateFilter = " WHERE DATE(createdAt) >= '$startDate'";
    } elseif($endDate){
        $orderDateFilter = " WHERE DATE(created_at) <= '$endDate'";
        $bookingDateFilter = " WHERE DATE(createdAt) <= '$endDate'";
    }
    
    // Quick stats
    $customerCount = $conn->query("SELECT COUNT(*) as count FROM customers")->fetch_assoc()['count'];
    $orderStats = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue, COALESCE(SUM(discount), 0) as discount FROM orders $orderDateFilter")->fetch_assoc();
    $bookingStats = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM room_booking $bookingDateFilter")->fetch_assoc();
    $itemCount = $conn->query("SELECT COUNT(*) as count FROM cafeteria_items")->fetch_assoc()['count'];
    $roomCount = $conn->query("SELECT COUNT(*) as count FROM rooms")->fetch_assoc()['count'];
    $staffCount = $conn->query("SELECT COUNT(*) as count FROM admins WHERE role != 'superadmin'")->fetch_assoc()['count'];
    $activeBookings = $conn->query("SELECT COUNT(*) as count FROM room_booking WHERE finished_at IS NULL")->fetch_assoc()['count'];
    $lowStock = $conn->query("SELECT COUNT(*) as count FROM cafeteria_items WHERE stock <= 10")->fetch_assoc()['count'];
    
    // Today's stats
    $todayOrders = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM orders WHERE DATE(created_at) = CURDATE()")->fetch_assoc();
    $todayBookings = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM room_booking WHERE DATE(createdAt) = CURDATE()")->fetch_assoc();
    
    // This week stats
    $weekOrders = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM orders WHERE YEARWEEK(created_at) = YEARWEEK(CURDATE())")->fetch_assoc();
    $weekBookings = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM room_booking WHERE YEARWEEK(createdAt) = YEARWEEK(CURDATE())")->fetch_assoc();
    
    // This month stats
    $monthOrders = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM orders WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())")->fetch_assoc();
    $monthBookings = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM room_booking WHERE MONTH(createdAt) = MONTH(CURDATE()) AND YEAR(createdAt) = YEAR(CURDATE())")->fetch_assoc();
    
    // Recent orders
    $recentOrdersResult = $conn->query("SELECT o.*, c.name as customer_name FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ORDER BY o.created_at DESC LIMIT 5");
    $recentOrders = [];
    while($row = $recentOrdersResult->fetch_assoc()){
        $recentOrders[] = $row;
    }
    
    // Recent bookings
    $recentBookingsResult = $conn->query("SELECT rb.*, r.name as room_name, c.name as customer_name FROM room_booking rb JOIN rooms r ON rb.room_id = r.id LEFT JOIN customers c ON rb.customer_id = c.id ORDER BY rb.createdAt DESC LIMIT 5");
    $recentBookings = [];
    while($row = $recentBookingsResult->fetch_assoc()){
        $recentBookings[] = $row;
    }
    
    // Top 5 items
    $topItemsResult = $conn->query("SELECT ci.name, SUM(oi.quantity) as sold FROM order_items oi JOIN cafeteria_items ci ON oi.item_id = ci.id GROUP BY ci.id ORDER BY sold DESC LIMIT 5");
    $topItems = [];
    while($row = $topItemsResult->fetch_assoc()){
        $topItems[] = $row;
    }
    
    // Top 5 customers
    $topCustomersResult = $conn->query("
        SELECT c.name, c.phone,
            (COALESCE(o.spent, 0) + COALESCE(rb.spent, 0)) as total_spent
        FROM customers c
        LEFT JOIN (SELECT customer_id, SUM(price) as spent FROM orders GROUP BY customer_id) o ON c.id = o.customer_id
        LEFT JOIN (SELECT customer_id, SUM(price) as spent FROM room_booking GROUP BY customer_id) rb ON c.id = rb.customer_id
        ORDER BY total_spent DESC
        LIMIT 5
    ");
    $topCustomers = [];
    while($row = $topCustomersResult->fetch_assoc()){
        $topCustomers[] = $row;
    }
    
    respond('success', [
        'date_range' => [
            'start_date' => $startDate ?? 'all time',
            'end_date' => $endDate ?? 'all time'
        ],
        'overview' => [
            'total_customers' => (int)$customerCount,
            'total_staff' => (int)$staffCount,
            'total_rooms' => (int)$roomCount,
            'total_items' => (int)$itemCount,
            'active_bookings' => (int)$activeBookings,
            'low_stock_alerts' => (int)$lowStock
        ],
        'revenue' => [
            'total' => round((float)$orderStats['revenue'] + (float)$bookingStats['revenue'], 2),
            'orders' => round((float)$orderStats['revenue'], 2),
            'bookings' => round((float)$bookingStats['revenue'], 2),
            'discount_given' => round((float)$orderStats['discount'], 2)
        ],
        'transactions' => [
            'total_orders' => (int)$orderStats['count'],
            'total_bookings' => (int)$bookingStats['count']
        ],
        'today' => [
            'orders' => (int)$todayOrders['count'],
            'order_revenue' => round((float)$todayOrders['revenue'], 2),
            'bookings' => (int)$todayBookings['count'],
            'booking_revenue' => round((float)$todayBookings['revenue'], 2),
            'total_revenue' => round((float)$todayOrders['revenue'] + (float)$todayBookings['revenue'], 2)
        ],
        'this_week' => [
            'orders' => (int)$weekOrders['count'],
            'order_revenue' => round((float)$weekOrders['revenue'], 2),
            'bookings' => (int)$weekBookings['count'],
            'booking_revenue' => round((float)$weekBookings['revenue'], 2),
            'total_revenue' => round((float)$weekOrders['revenue'] + (float)$weekBookings['revenue'], 2)
        ],
        'this_month' => [
            'orders' => (int)$monthOrders['count'],
            'order_revenue' => round((float)$monthOrders['revenue'], 2),
            'bookings' => (int)$monthBookings['count'],
            'booking_revenue' => round((float)$monthBookings['revenue'], 2),
            'total_revenue' => round((float)$monthOrders['revenue'] + (float)$monthBookings['revenue'], 2)
        ],
        'recent_orders' => $recentOrders,
        'recent_bookings' => $recentBookings,
        'top_selling_items' => $topItems,
        'top_customers' => $topCustomers
    ]);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get customer by ID
 */
function getCustomer(){
    global $conn;
    getAdmin();
    
    $input = requireParams(['id']);
    $id = (int)$input['id'];
    
    $stmt = $conn->prepare("SELECT * FROM customers WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $customer = $result->fetch_assoc();
    $stmt->close();
    
    if(!$customer){
        respond('error', 'Customer not found.');
    }
    
    // Get order stats
    $stmt = $conn->prepare("SELECT COUNT(*) as order_count, COALESCE(SUM(price), 0) as total_spent FROM orders WHERE customer_id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $orderStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    // Get booking stats
    $stmt = $conn->prepare("SELECT COUNT(*) as booking_count, COALESCE(SUM(price), 0) as booking_spent FROM room_booking WHERE customer_id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $bookingStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    $customer['order_count'] = (int)$orderStats['order_count'];
    $customer['order_spent'] = round((float)$orderStats['total_spent'], 2);
    $customer['booking_count'] = (int)$bookingStats['booking_count'];
    $customer['booking_spent'] = round((float)$bookingStats['booking_spent'], 2);
    $customer['total_spent'] = round((float)$orderStats['total_spent'] + (float)$bookingStats['booking_spent'], 2);
    
    respond('success', $customer);
}

/**
 * Search customers by name or phone
 */
function searchCustomers(){
    global $conn;
    getAdmin();
    
    $input = requireParams(['query']);
    $query = '%' . $input['query'] . '%';
    
    $stmt = $conn->prepare("SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 20");
    $stmt->bind_param("ss", $query, $query);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $customers = [];
    while($row = $result->fetch_assoc()){
        $customers[] = $row;
    }
    $stmt->close();
    
    respond('success', $customers);
}

/**
 * Get booking by ID
 */
function getBooking(){
    global $conn;
    getAdmin();
    
    $input = requireParams(['id']);
    $id = (int)$input['id'];
    
    $stmt = $conn->prepare("
        SELECT rb.*, r.name as room_name, r.ps, r.hour_cost, c.name as customer_name, c.phone as customer_phone
        FROM room_booking rb
        JOIN rooms r ON rb.room_id = r.id
        LEFT JOIN customers c ON rb.customer_id = c.id
        WHERE rb.id = ?
    ");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $booking = $result->fetch_assoc();
    $stmt->close();
    
    if(!$booking){
        respond('error', 'Booking not found.');
    }
    
    // Calculate current duration if active
    if($booking['finished_at'] === null){
        $start = new DateTime($booking['started_at']);
        $now = new DateTime();
        $diff = $start->diff($now);
        $hours = $diff->h + ($diff->days * 24) + ($diff->i / 60);
        $booking['current_duration_hours'] = round($hours, 2);
        $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
        $price_per_minute = (float)$booking['hour_cost'] / 60;
        $booking['estimated_price'] = round($price_per_minute * $total_minutes, 2);
        $booking['is_active'] = true;
    } else {
        $booking['is_active'] = false;
    }
    
    respond('success', $booking);
}

/**
 * Cancel/delete a booking (only if not started or superadmin)
 */
function cancelBooking(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['id']);
    $id = (int)$input['id'];
    
    // Get booking
    $stmt = $conn->prepare("SELECT * FROM room_booking WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $booking = $result->fetch_assoc();
    $stmt->close();
    
    if(!$booking){
        respond('error', 'Booking not found.');
    }
    
    // Only superadmin can delete ended bookings
    if($booking['finished_at'] !== null && $admin['role'] != 'superadmin'){
        respond('error', 'Cannot cancel completed bookings.');
    }
    
    // Free the room if booking was active
    if($booking['finished_at'] === null){
        $stmt = $conn->prepare("UPDATE rooms SET is_booked = 0 WHERE id = ?");
        $stmt->bind_param("i", $booking['room_id']);
        $stmt->execute();
        $stmt->close();
    }
    
    // Delete booking
    $stmt = $conn->prepare("DELETE FROM room_booking WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
    
    respond('success', 'Booking cancelled successfully.');
}

/**
 * Update stock for a cafeteria item
 */
function updateStock(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['id', 'stock']);
    $id = (int)$input['id'];
    $stock = (int)$input['stock'];
    $operation = isset($input['operation']) ? $input['operation'] : 'set';
    
    if($stock < 0){
        respond('error', 'Stock cannot be negative.');
    }
    
    // Handle different operations
    if($operation === 'add'){
        // Add to existing stock
        $stmt = $conn->prepare("UPDATE cafeteria_items SET stock = stock + ? WHERE id = ?");
        $stmt->bind_param("ii", $stock, $id);
    } elseif($operation === 'subtract'){
        // Subtract from existing stock
        $stmt = $conn->prepare("UPDATE cafeteria_items SET stock = GREATEST(0, stock - ?) WHERE id = ?");
        $stmt->bind_param("ii", $stock, $id);
    } else {
        // Set to specific value (default)
        $stmt = $conn->prepare("UPDATE cafeteria_items SET stock = ? WHERE id = ?");
        $stmt->bind_param("ii", $stock, $id);
    }
    
    $stmt->execute();
    
    if($stmt->affected_rows == 0){
        respond('error', 'Item not found.');
    }
    $stmt->close();
    
    respond('success', 'Stock updated successfully.');
}

/**
 * Add stock to a cafeteria item (increment)
 */
function addStock(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['id', 'quantity']);
    $id = (int)$input['id'];
    $quantity = (int)$input['quantity'];
    
    if($quantity <= 0){
        respond('error', 'Quantity must be positive.');
    }
    
    $stmt = $conn->prepare("UPDATE cafeteria_items SET stock = stock + ? WHERE id = ?");
    $stmt->bind_param("ii", $quantity, $id);
    $stmt->execute();
    
    if($stmt->affected_rows == 0){
        respond('error', 'Item not found.');
    }
    $stmt->close();
    
    respond('success', 'Stock added successfully.');
}

/**
 * Get low stock items alert
 */
function getLowStockItems(){
    global $conn;
    getAdmin();
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $threshold = isset($input['threshold']) ? (int)$input['threshold'] : 10;
    
    $stmt = $conn->prepare("SELECT * FROM cafeteria_items WHERE stock <= ? ORDER BY stock ASC");
    $stmt->bind_param("i", $threshold);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $items = [];
    while($row = $result->fetch_assoc()){
        $items[] = $row;
    }
    $stmt->close();
    
    respond('success', $items);
}

/**
 * Get current admin profile
 */
function getProfile(){
    $admin = getAdmin();
    unset($admin['password']); // Don't send password
    respond('success', $admin);
}

/**
 * Update current admin's own profile (name and email)
 */
function updateProfile(){
    global $conn;
    $admin = getAdmin();
    $adminId = $admin['id'];
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    
    // Build dynamic update query based on provided fields
    $updates = [];
    $types = "";
    $values = [];
    
    if(isset($input['name']) && !empty($input['name'])){
        $updates[] = "name = ?";
        $types .= "s";
        $values[] = $input['name'];
    }
    if(isset($input['email']) && !empty($input['email'])){
        // Check if email is already taken by another admin
        $checkStmt = $conn->prepare("SELECT id FROM admins WHERE email = ? AND id != ?");
        $checkStmt->bind_param("si", $input['email'], $adminId);
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();
        if($checkResult->num_rows > 0){
            respond('error', 'Email is already in use by another admin.');
        }
        $checkStmt->close();
        
        $updates[] = "email = ?";
        $types .= "s";
        $values[] = $input['email'];
    }
    
    if(empty($updates)){
        respond('error', 'No fields to update.');
    }
    
    $values[] = $adminId;
    $types .= "i";
    
    $sql = "UPDATE admins SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$values);
    $stmt->execute();
    $stmt->close();
    
    // Return updated profile
    $stmt = $conn->prepare("SELECT id, name, email, role, status FROM admins WHERE id = ?");
    $stmt->bind_param("i", $adminId);
    $stmt->execute();
    $result = $stmt->get_result();
    $updatedAdmin = $result->fetch_assoc();
    $stmt->close();
    
    respond('success', $updatedAdmin);
}

/**
 * Update current admin password
 */
function updatePassword(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['current_password', 'new_password']);
    $currentPassword = trim($input['current_password']);
    $newPassword = trim($input['new_password']);
    
    if(strlen($newPassword) < 6){
        respond('error', 'New password must be at least 6 characters.');
    }
    
    $adminId = $admin['id'];
    // Verify current password
    $stmt = $conn->prepare("SELECT password FROM admins WHERE id = ?");
    $stmt->bind_param("i", $adminId);
    $stmt->execute();
    $result = $stmt->get_result();
    $adminData = $result->fetch_assoc();
    if(!$adminData){
        respond('error', 'Admin not found.');
    }
    $storedPassword = $adminData['password'];
    $stmt->close();
    
    // Check password - try md5 first, then bcrypt for legacy passwords
    $currentHashedPassword = md5($currentPassword);
    $passwordValid = false;
    
    if($currentHashedPassword === $storedPassword){
        // Password stored as md5
        $passwordValid = true;
    } elseif(password_verify($currentPassword, $storedPassword)){
        // Password stored as bcrypt
        $passwordValid = true;
    }
    
    if(!$passwordValid){
        respond('error', 'Current password is incorrect.');
    }
    
    // Update to new password (store as md5 to match login function)
    $hashedPassword = md5($newPassword);
    $stmt = $conn->prepare("UPDATE admins SET password = ? WHERE id = ?");
    $stmt->bind_param("si", $hashedPassword, $adminId);
    $stmt->execute();
    $stmt->close();
    
    respond('success', 'Password updated successfully.');
}

/**
 * Check if token is valid (for session validation)
 */
function validateSession(){
    $admin = getAdmin();
    unset($admin['password']);
    respond('success', ['valid' => true, 'admin' => $admin]);
}
// ============================================================
// FRONT DESK (ADMIN) FUNCTIONS
// ============================================================

/**
 * Get available rooms (not booked)
 */
function getAvailableRooms(){
    global $conn;
    getAdmin();
    
    $result = $conn->query("SELECT * FROM rooms WHERE is_booked = 0 ORDER BY name ASC");
    $rooms = [];
    while($row = $result->fetch_assoc()){
        $rooms[] = $row;
    }
    
    respond('success', $rooms);
}

/**
 * Get all rooms with their current status (available/occupied)
 */
function getRoomsStatus(){
    global $conn;
    getAdmin();
    
    $current_time = date('Y-m-d H:i:s');
    
    $result = $conn->query("
        SELECT r.*, 
            rb.id as current_booking_id,
            rb.customer_id as current_customer_id,
            rb.started_at as booking_started_at,
            rb.finished_at as booking_finished_at,
            rb.price as booking_price,
            c.name as current_customer_name,
            c.phone as current_customer_phone
        FROM rooms r
        LEFT JOIN room_booking rb ON r.id = rb.room_id 
            AND rb.started_at <= '$current_time' 
            AND (rb.finished_at IS NULL OR rb.finished_at > '$current_time')
        LEFT JOIN customers c ON rb.customer_id = c.id
        ORDER BY r.name ASC
    ");
    
    $rooms = [];
    while($row = $result->fetch_assoc()){
        // Check if there's an active booking for this room
        $hasActiveBooking = $row['current_booking_id'] !== null;
        
        if($hasActiveBooking && $row['booking_started_at']){
            $start = new DateTime($row['booking_started_at']);
            $now = new DateTime();
            $diff = $start->diff($now);
            $hours = $diff->h + ($diff->days * 24) + ($diff->i / 60);
            
            // Determine booking type
            $isScheduled = ($row['booking_finished_at'] !== null && $row['booking_price'] > 0);
            
            // Build current_booking object
            $row['current_booking'] = [
                'id' => $row['current_booking_id'],
                'customer_name' => $row['current_customer_name'],
                'customer_phone' => $row['current_customer_phone'],
                'started_at' => $row['booking_started_at'],
                'elapsed_hours' => round($hours, 2),
                'estimated_price' => 0,
                'booking_type' => $isScheduled ? 'scheduled' : 'open_session'
            ];
            
            if($isScheduled){
                // Scheduled booking - use booked price
                $row['current_booking']['estimated_price'] = (float)$row['booking_price'];
                $row['current_booking']['finished_at'] = $row['booking_finished_at'];
                
                // Calculate remaining time
                $end = new DateTime($row['booking_finished_at']);
                $diff_to_end = $now->diff($end);
                $remaining_hours = $diff_to_end->h + ($diff_to_end->days * 24) + ($diff_to_end->i / 60);
                $row['current_booking']['remaining_hours'] = round($remaining_hours, 2);
            } else {
                // Open session - calculate current estimated price based on actual minutes
                $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
                $price_per_minute = (float)$row['hour_cost'] / 60;
                $row['current_booking']['estimated_price'] = round($price_per_minute * $total_minutes, 2);
            }
            
            // Mark room as booked
            $row['is_booked'] = 1;
        } else {
            $row['current_booking'] = null;
            $row['is_booked'] = 0;
        }
        
        // Clean up temporary fields
        unset($row['current_booking_id']);
        unset($row['current_customer_id']);
        unset($row['booking_started_at']);
        unset($row['booking_finished_at']);
        unset($row['booking_price']);
        unset($row['current_customer_name']);
        unset($row['current_customer_phone']);
        
        $row['status'] = $row['is_booked'] == 1 ? 'occupied' : 'available';
        $rooms[] = $row;
    }
    
    $available = count(array_filter($rooms, fn($r) => $r['status'] == 'available'));
    $occupied = count(array_filter($rooms, fn($r) => $r['status'] == 'occupied'));
    
    respond('success', [
        'rooms' => $rooms,
        'summary' => [
            'total' => count($rooms),
            'available' => $available,
            'occupied' => $occupied
        ]
    ]);
}

/**
 * Get upcoming scheduled bookings (for today and tomorrow)
 */
function getUpcomingBookings(){
    global $conn;
    getAdmin();
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $days = isset($input['days']) ? (int)$input['days'] : 2; // Default: today + tomorrow
    
    $result = $conn->query("
        SELECT rb.*, r.name as room_name, r.ps, r.hour_cost, c.name as customer_name, c.phone as customer_phone
        FROM room_booking rb
        JOIN rooms r ON rb.room_id = r.id
        LEFT JOIN customers c ON rb.customer_id = c.id
        WHERE rb.finished_at IS NULL 
        AND DATE(rb.started_at) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL $days DAY)
        ORDER BY rb.started_at ASC
    ");
    
    $bookings = [];
    while($row = $result->fetch_assoc()){
        $start = new DateTime($row['started_at']);
        $now = new DateTime();
        
        // Check if booking is in progress or upcoming
        if($start <= $now){
            $diff = $start->diff($now);
            $hours = $diff->h + ($diff->days * 24) + ($diff->i / 60);
            $row['status'] = 'in_progress';
            $row['current_duration_hours'] = round($hours, 2);
            $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
            $price_per_minute = (float)$row['hour_cost'] / 60;
            $row['estimated_price'] = round($price_per_minute * $total_minutes, 2);
        } else {
            $row['status'] = 'upcoming';
            $diff = $now->diff($start);
            $row['starts_in_minutes'] = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
            $row['starts_in_formatted'] = $diff->format('%h hrs %i mins');
        }
        
        $bookings[] = $row;
    }
    
    // Group by status
    $inProgress = array_filter($bookings, fn($b) => $b['status'] == 'in_progress');
    $upcoming = array_filter($bookings, fn($b) => $b['status'] == 'upcoming');
    
    respond('success', [
        'in_progress' => array_values($inProgress),
        'upcoming' => array_values($upcoming),
        'total_active' => count($inProgress),
        'total_upcoming' => count($upcoming)
    ]);
}

/**
 * Get today's bookings summary
 */
function getTodaysBookings(){
    global $conn;
    getAdmin();
    
    $result = $conn->query("
        SELECT rb.*, r.name as room_name, r.ps, r.hour_cost, c.name as customer_name, c.phone as customer_phone
        FROM room_booking rb
        JOIN rooms r ON rb.room_id = r.id
        LEFT JOIN customers c ON rb.customer_id = c.id
        WHERE DATE(rb.createdAt) = CURDATE()
        ORDER BY rb.createdAt DESC
    ");
    
    $bookings = [];
    $totalRevenue = 0;
    $activeCount = 0;
    $completedCount = 0;
    
    while($row = $result->fetch_assoc()){
        // Get related orders for this booking
        $ordersStmt = $conn->prepare("
            SELECT o.id, o.price as total_amount, o.discount, o.created_at,
                   c.name as customer_name, c.phone as customer_phone
            FROM orders o 
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.booking_id = ?
            ORDER BY o.created_at DESC
        ");
        $ordersStmt->bind_param("i", $row['id']);
        $ordersStmt->execute();
        $ordersResult = $ordersStmt->get_result();
        $orders = [];
        $orders_total = 0;
        while($orderRow = $ordersResult->fetch_assoc()){
            // Get items for this order
            $itemsStmt = $conn->prepare("
                SELECT oi.*, ci.name as item_name, ci.price as unit_price
                FROM order_items oi 
                JOIN cafeteria_items ci ON oi.item_id = ci.id 
                WHERE oi.order_id = ?
            ");
            $itemsStmt->bind_param("i", $orderRow['id']);
            $itemsStmt->execute();
            $itemsResult = $itemsStmt->get_result();
            $items = [];
            while($itemRow = $itemsResult->fetch_assoc()){
                $items[] = $itemRow;
            }
            $itemsStmt->close();
            
            $orderRow['items'] = $items;
            $orderRow['items_count'] = count($items);
            $orders[] = $orderRow;
            $orders_total += (float)$orderRow['total_amount'];
        }
        $ordersStmt->close();
        
        $row['orders'] = $orders;
        $row['orders_count'] = count($orders);
        $row['orders_total'] = round($orders_total, 2);
        
        if($row['finished_at'] === null){
            $row['status'] = 'active';
            $activeCount++;
            // Calculate current duration
            $start = new DateTime($row['started_at']);
            $now = new DateTime();
            $diff = $start->diff($now);
            $hours = $diff->h + ($diff->days * 24) + ($diff->i / 60);
            $row['current_duration_hours'] = round($hours, 2);
            $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
            $price_per_minute = (float)$row['hour_cost'] / 60;
            $row['estimated_price'] = round($price_per_minute * $total_minutes, 2);
        } else {
            $row['status'] = 'completed';
            $completedCount++;
            $totalRevenue += (float)$row['price'];
        }
        $bookings[] = $row;
    }
    
    respond('success', [
        'bookings' => $bookings,
        'summary' => [
            'total' => count($bookings),
            'active' => $activeCount,
            'completed' => $completedCount,
            'completed_revenue' => round($totalRevenue, 2)
        ]
    ]);
}

/**
 * Get today's orders summary
 */
function getTodaysOrders(){
    global $conn;
    getAdmin();
    
    $result = $conn->query("
        SELECT o.*, c.name as customer_name, c.phone as customer_phone,
               rb.id as linked_booking_id, r.name as linked_room_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN room_booking rb ON o.booking_id = rb.id AND o.booking_id > 0
        LEFT JOIN rooms r ON rb.room_id = r.id
        WHERE DATE(o.created_at) = CURDATE()
        ORDER BY o.created_at DESC
    ");
    
    $orders = [];
    $totalRevenue = 0;
    $totalDiscount = 0;
    
    while($row = $result->fetch_assoc()){
        // Get order items
        $stmt = $conn->prepare("SELECT oi.*, ci.name as item_name FROM order_items oi JOIN cafeteria_items ci ON oi.item_id = ci.id WHERE oi.order_id = ?");
        $stmt->bind_param("i", $row['id']);
        $stmt->execute();
        $itemResult = $stmt->get_result();
        $items = [];
        while($item = $itemResult->fetch_assoc()){
            $items[] = $item;
        }
        $stmt->close();
        
        $row['items'] = $items;
        $row['items_count'] = count($items);
        $totalRevenue += (float)$row['price'];
        $totalDiscount += (float)$row['discount'];
        $orders[] = $row;
    }
    
    respond('success', [
        'orders' => $orders,
        'summary' => [
            'total_orders' => count($orders),
            'total_revenue' => round($totalRevenue, 2),
            'total_discount' => round($totalDiscount, 2)
        ]
    ]);
}

/**
 * Front Desk Dashboard - All info needed for admin in one call
 */
function getFrontDeskDashboard(){
    global $conn;
    getAdmin();
    
    // Room status - use COALESCE to handle NULL
    $roomsResult = $conn->query("SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN is_booked = 0 THEN 1 ELSE 0 END), 0) as available FROM rooms");
    $roomsData = $roomsResult->fetch_assoc();
    
    // Active bookings with details
    $activeBookingsResult = $conn->query("
        SELECT rb.*, r.name as room_name, r.hour_cost, c.name as customer_name, c.phone as customer_phone
        FROM room_booking rb
        JOIN rooms r ON rb.room_id = r.id
        LEFT JOIN customers c ON rb.customer_id = c.id
        WHERE rb.finished_at IS NULL
        ORDER BY rb.started_at ASC
    ");
    $activeBookings = [];
    while($row = $activeBookingsResult->fetch_assoc()){
        $start = new DateTime($row['started_at']);
        $now = new DateTime();
        $diff = $start->diff($now);
        $hours = $diff->h + ($diff->days * 24) + ($diff->i / 60);
        $row['duration_hours'] = round($hours, 2);
        $row['current_duration_hours'] = round($hours, 2);
        $row['duration_formatted'] = sprintf('%02d:%02d', floor($hours), ($hours - floor($hours)) * 60);
        $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
        $price_per_minute = (float)$row['hour_cost'] / 60;
        $row['estimated_price'] = round($price_per_minute * $total_minutes, 2);
        $row['booking_type'] = 'open_session';
        $row['status'] = 'active';
        $activeBookings[] = $row;
    }
    
    // Low stock items (threshold 10)
    $lowStockResult = $conn->query("SELECT id, name, stock FROM cafeteria_items WHERE stock <= 10 ORDER BY stock ASC LIMIT 10");
    $lowStockItems = [];
    while($row = $lowStockResult->fetch_assoc()){
        $lowStockItems[] = $row;
    }
    
    // Out of stock items
    $outOfStockResult = $conn->query("SELECT COUNT(*) as count FROM cafeteria_items WHERE stock = 0");
    $outOfStockCount = $outOfStockResult->fetch_assoc()['count'];
    
    // Today's stats
    $todayOrdersResult = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM orders WHERE DATE(created_at) = CURDATE()");
    $todayOrders = $todayOrdersResult->fetch_assoc();
    
    $todayBookingsResult = $conn->query("SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue FROM room_booking WHERE DATE(createdAt) = CURDATE() AND finished_at IS NOT NULL");
    $todayBookings = $todayBookingsResult->fetch_assoc();
    
    // Recent completed bookings (last 5)
    $recentBookingsResult = $conn->query("
        SELECT rb.id, r.name as room_name, c.name as customer_name, rb.price, rb.finished_at
        FROM room_booking rb
        JOIN rooms r ON rb.room_id = r.id
        LEFT JOIN customers c ON rb.customer_id = c.id
        WHERE rb.finished_at IS NOT NULL
        ORDER BY rb.finished_at DESC
        LIMIT 5
    ");
    $recentBookings = [];
    while($row = $recentBookingsResult->fetch_assoc()){
        $recentBookings[] = $row;
    }
    
    // Recent orders (last 5)
    $recentOrdersResult = $conn->query("
        SELECT o.id, c.name as customer_name, o.price, o.created_at
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        ORDER BY o.created_at DESC
        LIMIT 5
    ");
    $recentOrders = [];
    while($row = $recentOrdersResult->fetch_assoc()){
        $recentOrders[] = $row;
    }
    
    // Available rooms list
    $availableRoomsResult = $conn->query("SELECT id, name, ps, hour_cost, capacity FROM rooms WHERE is_booked = 0 ORDER BY name ASC");
    $availableRooms = [];
    while($row = $availableRoomsResult->fetch_assoc()){
        $availableRooms[] = $row;
    }
    
    // All rooms list (for dashboard display)
    $allRoomsResult = $conn->query("SELECT id, name, ps, hour_cost, capacity, is_booked FROM rooms ORDER BY name ASC");
    $allRooms = [];
    while($row = $allRoomsResult->fetch_assoc()){
        $allRooms[] = $row;
    }
    
    respond('success', [
        'rooms' => [
            'total' => (int)$roomsData['total'],
            'available' => (int)$roomsData['available'],
            'occupied' => (int)$roomsData['total'] - (int)$roomsData['available'],
            'available_list' => $availableRooms,
            'list' => $allRooms
        ],
        'active_bookings' => $activeBookings,
        'stock_alerts' => [
            'low_stock_count' => count($lowStockItems),
            'out_of_stock_count' => (int)$outOfStockCount,
            'low_stock_items' => $lowStockItems,
            'items' => $lowStockItems  // Add this for frontend compatibility
        ],
        'today' => [
            'orders_count' => (int)$todayOrders['count'],
            'orders_revenue' => round((float)$todayOrders['revenue'], 2),
            'bookings_completed' => (int)$todayBookings['count'],
            'bookings_revenue' => round((float)$todayBookings['revenue'], 2),
            'total_revenue' => round((float)$todayOrders['revenue'] + (float)$todayBookings['revenue'], 2)
        ],
        'recent_bookings' => $recentBookings,
        'recent_orders' => $recentOrders
    ]);
}

/**
 * Quick start booking for a room (simplified for front desk)
 */
function quickStartBooking(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['room_id']);
    $room_id = (int)$input['room_id'];
    $customer_phone = isset($input['customer_phone']) ? $input['customer_phone'] : null;
    $customer_name = isset($input['customer_name']) ? $input['customer_name'] : null;
    $duration_minutes = isset($input['duration_minutes']) ? (int)$input['duration_minutes'] : 0;
    
    // Accept started_at and finished_at from frontend
    $input_started_at = isset($input['started_at']) ? $input['started_at'] : null;
    $input_finished_at = isset($input['finished_at']) ? $input['finished_at'] : null;
    
    // Check room availability
    $stmt = $conn->prepare("SELECT * FROM rooms WHERE id = ? AND is_booked = 0");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $room = $result->fetch_assoc();
    $stmt->close();
    
    if(!$room){
        respond('error', 'Room is not available or does not exist.');
    }
    
    // Find or create customer
    $customer = null;
    $customer_id = null;
    $is_new_customer = false;
    
    if($customer_phone){
        $stmt = $conn->prepare("SELECT id, name FROM customers WHERE phone = ?");
        $stmt->bind_param("s", $customer_phone);
        $stmt->execute();
        $result = $stmt->get_result();
        $customer = $result->fetch_assoc();
        $stmt->close();
        
        if(!$customer){
            // Create new customer
            if(!$customer_name){
                $customer_name = 'Customer ' . substr($customer_phone, -4);
            }
            $stmt = $conn->prepare("INSERT INTO customers (name, phone) VALUES (?, ?)");
            $stmt->bind_param("ss", $customer_name, $customer_phone);
            $stmt->execute();
            $customer_id = $conn->insert_id;
            $stmt->close();
            $is_new_customer = true;
        } else {
            $customer_id = $customer['id'];
            $customer_name = $customer['name'];
            $is_new_customer = false;
        }
    } elseif($customer_name){
        // Create customer with name only (no phone)
        $stmt = $conn->prepare("INSERT INTO customers (name, phone) VALUES (?, ?)");
        $stmt->bind_param("ss", $customer_name, $customer_phone);
        $stmt->execute();
        $customer_id = $conn->insert_id;
        $stmt->close();
        $is_new_customer = true;
    }
    // If no customer info provided, customer_id remains null (guest/walk-in booking)
    // Set default display name for response
    if(!$customer_name){
        $customer_name = 'Guest';
    }
    
    // Start booking - use provided started_at or default to now
    $started_at = $input_started_at ? $input_started_at : date('Y-m-d H:i:s');
    $finished_at = $input_finished_at ? $input_finished_at : null;
    
    // Fallback: If duration is specified but no finished_at provided, calculate it
    if($finished_at === null && $duration_minutes > 0){
        $finished_at = date('Y-m-d H:i:s', strtotime($started_at . " +{$duration_minutes} minutes"));
    }
    
    // Calculate price if both started_at and finished_at are set (scheduled booking)
    $calculated_price = 0;
    $calculated_hours = 0;
    if($finished_at !== null){
        $start_time = new DateTime($started_at);
        $end_time = new DateTime($finished_at);
        $diff = $start_time->diff($end_time);
        
        // Calculate total minutes
        $total_minutes = ($diff->days * 24 * 60) + ($diff->h * 60) + $diff->i;
        $calculated_hours = $total_minutes / 60;
        
        // Calculate price based on actual minutes (proportional)
        $price_per_minute = (float)$room['hour_cost'] / 60;
        $calculated_price = round($price_per_minute * $total_minutes, 2);
    }
    
    $stmt = $conn->prepare("INSERT INTO room_booking (customer_id, room_id, started_at, finished_at, price) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("iissd", $customer_id, $room_id, $started_at, $finished_at, $calculated_price);
    $stmt->execute();
    $booking_id = $conn->insert_id;
    $stmt->close();
    
    // Mark room as booked
    $stmt = $conn->prepare("UPDATE rooms SET is_booked = 1 WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $stmt->close();
    
    respond('success', [
        'message' => 'Booking started successfully.',
        'booking_id' => $booking_id,
        'room' => [
            'id' => $room['id'],
            'name' => $room['name'],
            'hour_cost' => $room['hour_cost']
        ],
        'customer' => [
            'id' => $customer_id,
            'name' => $customer_name,
            'phone' => $customer_phone,
            'is_new' => $is_new_customer
        ],
        'started_at' => $started_at,
        'finished_at' => $finished_at,
        'duration_minutes' => $duration_minutes > 0 ? $duration_minutes : round($calculated_hours * 60),
        'calculated_hours' => round($calculated_hours, 2),
        'price' => $calculated_price
    ]);
}

/**
 * Quick order for cafeteria items (simplified for front desk)
 * Can optionally link to an active booking
 */
function quickOrder(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['items']);
    $customer_phone = isset($input['customer_phone']) ? $input['customer_phone'] : null;
    $items = $input['items']; // Array of {item_id, quantity}
    $customer_name = isset($input['customer_name']) ? $input['customer_name'] : null;
    $booking_id = isset($input['booking_id']) ? (int)$input['booking_id'] : null; // Optional booking link
    
    if(!is_array($items) || count($items) == 0){
        respond('error', 'At least one item is required.');
    }
    
    // Validate booking if provided
    $booking = null;
    if($booking_id && $booking_id > 0){
        $current_time = date('Y-m-d H:i:s');
        $stmt = $conn->prepare("SELECT rb.*, r.name as room_name FROM room_booking rb JOIN rooms r ON rb.room_id = r.id WHERE rb.id = ? AND (rb.finished_at IS NULL OR rb.finished_at > ?)");
        $stmt->bind_param("is", $booking_id, $current_time);
        $stmt->execute();
        $result = $stmt->get_result();
        $booking = $result->fetch_assoc();
        $stmt->close();
        
        if(!$booking){
            respond('error', 'Invalid or inactive booking.');
        }
        
        // If booking found and no customer provided, use booking's customer
        if($booking['customer_id'] && !$customer_phone){
            $stmt = $conn->prepare("SELECT id, name, phone FROM customers WHERE id = ?");
            $stmt->bind_param("i", $booking['customer_id']);
            $stmt->execute();
            $result = $stmt->get_result();
            $bookingCustomer = $result->fetch_assoc();
            $stmt->close();
            
            if($bookingCustomer){
                $customer_phone = $bookingCustomer['phone'];
                $customer_name = $bookingCustomer['name'];
            }
        }
    }
    
    // Find or create customer (optional)
    $customer = null;
    $customer_id = null;
    $is_new_customer = false;
    
    if($customer_phone){
        $stmt = $conn->prepare("SELECT id, name FROM customers WHERE phone = ?");
        $stmt->bind_param("s", $customer_phone);
        $stmt->execute();
        $result = $stmt->get_result();
        $customer = $result->fetch_assoc();
        $stmt->close();
    }
    
    if($customer_phone && !$customer){
        // Create new customer with phone
        if(!$customer_name){
            $customer_name = 'Customer ' . substr($customer_phone, -4);
        }
        $stmt = $conn->prepare("INSERT INTO customers (name, phone) VALUES (?, ?)");
        $stmt->bind_param("ss", $customer_name, $customer_phone);
        $stmt->execute();
        $customer_id = $conn->insert_id;
        $stmt->close();
        $is_new_customer = true;
    } elseif($customer){
        $customer_id = $customer['id'];
        $customer_name = $customer['name'];
        $is_new_customer = false;
    } elseif($customer_name){
        // Create customer with name only (no phone)
        $stmt = $conn->prepare("INSERT INTO customers (name, phone) VALUES (?, ?)");
        $stmt->bind_param("ss", $customer_name, $customer_phone);
        $stmt->execute();
        $customer_id = $conn->insert_id;
        $stmt->close();
        $is_new_customer = true;
    }
    // If no customer info provided, customer_id remains null (anonymous order)
    // Set default display name for response
    if(!$customer_name){
        $customer_name = 'Guest';
    }
    
    // Validate items and calculate total
    $totalPrice = 0;
    $validatedItems = [];
    
    foreach($items as $item){
        if(!isset($item['item_id']) || !isset($item['quantity'])){
            respond('error', 'Each item must have item_id and quantity.');
        }
        
        $item_id = (int)$item['item_id'];
        $quantity = (int)$item['quantity'];
        
        if($quantity <= 0){
            respond('error', 'Quantity must be greater than 0.');
        }
        
        $stmt = $conn->prepare("SELECT id, name, price, stock FROM cafeteria_items WHERE id = ?");
        $stmt->bind_param("i", $item_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $cafeteriaItem = $result->fetch_assoc();
        $stmt->close();
        
        if(!$cafeteriaItem){
            respond('error', "Item with ID $item_id not found.");
        }
        
        if($cafeteriaItem['stock'] < $quantity){
            respond('error', "Insufficient stock for {$cafeteriaItem['name']}. Available: {$cafeteriaItem['stock']}");
        }
        
        $itemTotal = $cafeteriaItem['price'] * $quantity;
        $totalPrice += $itemTotal;
        
        $validatedItems[] = [
            'item_id' => $item_id,
            'quantity' => $quantity,
            'price' => $cafeteriaItem['price'],
            'total_price' => $itemTotal,
            'name' => $cafeteriaItem['name']
        ];
    }
    
    // Create order with optional booking_id
    $discount = 0;
    if($booking_id && $booking_id > 0){
        $stmt = $conn->prepare("INSERT INTO orders (customer_id, price, discount, booking_id) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iddi", $customer_id, $totalPrice, $discount, $booking_id);
    } else {
        $stmt = $conn->prepare("INSERT INTO orders (customer_id, price, discount) VALUES (?, ?, ?)");
        $stmt->bind_param("idd", $customer_id, $totalPrice, $discount);
    }
    $stmt->execute();
    $orderId = $conn->insert_id;
    $stmt->close();
    
    // Insert order items and reduce stock
    foreach($validatedItems as $item){
        $stmt = $conn->prepare("INSERT INTO order_items (order_id, item_id, quantity, total_price) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiid", $orderId, $item['item_id'], $item['quantity'], $item['total_price']);
        $stmt->execute();
        $stmt->close();
        
        $stmt = $conn->prepare("UPDATE cafeteria_items SET stock = stock - ? WHERE id = ?");
        $stmt->bind_param("ii", $item['quantity'], $item['item_id']);
        $stmt->execute();
        $stmt->close();
    }
    
    respond('success', [
        'message' => 'Order created successfully.',
        'order_id' => $orderId,
        'customer' => [
            'id' => $customer_id,
            'name' => $customer_name,
            'phone' => $customer_phone,
            'is_new' => $is_new_customer
        ],
        'booking' => $booking ? [
            'id' => $booking['id'],
            'room_name' => $booking['room_name']
        ] : null,
        'total_price' => $totalPrice,
        'items' => $validatedItems
    ]);
}
function deleteBooking(){
    global $conn;
    getAdmin();
    
    $input = requireParams(['booking_id']);
    $booking_id = (int)$input['booking_id'];
    
    // Get booking
    $stmt = $conn->prepare("SELECT * FROM room_booking WHERE id = ?");
    $stmt->bind_param("i", $booking_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $booking = $result->fetch_assoc();
    $stmt->close();
    
    if(!$booking){
        respond('error', 'Booking not found.');
    }
    
    // Delete booking
    $stmt = $conn->prepare("DELETE FROM room_booking WHERE id = ?");
    $stmt->bind_param("i", $booking_id);
    $stmt->execute();
    $stmt->close();
    
    // Free room if it was booked
    if($booking['room_id']){
        $stmt = $conn->prepare("UPDATE rooms SET is_booked = 0 WHERE id = ?");
        $stmt->bind_param("i", $booking['room_id']);
        $stmt->execute();
        $stmt->close();
    }
    
    respond('success', 'Booking deleted successfully.');
}
/**
 * Get items with stock for ordering (excludes out of stock)
 */
function getAvailableItems(){
    global $conn;
    getAdmin();
    
    $result = $conn->query("SELECT * FROM cafeteria_items WHERE stock > 0 ORDER BY name ASC");
    $items = [];
    while($row = $result->fetch_assoc()){
        $items[] = $row;
    }
    
    respond('success', $items);
}

/**
 * Extend/update an active booking (change customer, add notes, etc.)
 */
function updateActiveBooking(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['booking_id']);
    $booking_id = (int)$input['booking_id'];
    
    // Get booking
    $stmt = $conn->prepare("SELECT * FROM room_booking WHERE id = ? AND finished_at IS NULL");
    $stmt->bind_param("i", $booking_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $booking = $result->fetch_assoc();
    $stmt->close();
    
    if(!$booking){
        respond('error', 'Active booking not found.');
    }
    
    // Update customer if provided
    if(isset($input['customer_id'])){
        $customer_id = (int)$input['customer_id'];
        $stmt = $conn->prepare("UPDATE room_booking SET customer_id = ? WHERE id = ?");
        $stmt->bind_param("ii", $customer_id, $booking_id);
        $stmt->execute();
        $stmt->close();
    }
    
    respond('success', 'Booking updated successfully.');
}

/**
 * Switch room for active booking
 */
function switchRoom(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['booking_id', 'new_room_id']);
    $booking_id = (int)$input['booking_id'];
    $new_room_id = (int)$input['new_room_id'];
    
    // Get current booking
    $stmt = $conn->prepare("SELECT * FROM room_booking WHERE id = ? AND finished_at IS NULL");
    $stmt->bind_param("i", $booking_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $booking = $result->fetch_assoc();
    $stmt->close();
    
    if(!$booking){
        respond('error', 'Active booking not found.');
    }
    
    // Check new room availability
    $stmt = $conn->prepare("SELECT * FROM rooms WHERE id = ? AND is_booked = 0");
    $stmt->bind_param("i", $new_room_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $newRoom = $result->fetch_assoc();
    $stmt->close();
    
    if(!$newRoom){
        respond('error', 'New room is not available.');
    }
    
    $old_room_id = $booking['room_id'];
    
    // Free old room
    $stmt = $conn->prepare("UPDATE rooms SET is_booked = 0 WHERE id = ?");
    $stmt->bind_param("i", $old_room_id);
    $stmt->execute();
    $stmt->close();
    
    // Book new room
    $stmt = $conn->prepare("UPDATE rooms SET is_booked = 1 WHERE id = ?");
    $stmt->bind_param("i", $new_room_id);
    $stmt->execute();
    $stmt->close();
    
    // Update booking
    $stmt = $conn->prepare("UPDATE room_booking SET room_id = ? WHERE id = ?");
    $stmt->bind_param("ii", $new_room_id, $booking_id);
    $stmt->execute();
    $stmt->close();
    
    respond('success', [
        'message' => 'Room switched successfully.',
        'old_room_id' => $old_room_id,
        'new_room' => [
            'id' => $newRoom['id'],
            'name' => $newRoom['name'],
            'hour_cost' => $newRoom['hour_cost']
        ]
    ]);
}

/**
 * Find customer by phone (quick lookup for front desk)
 */
function findCustomerByPhone(){
    global $conn;
    getAdmin();
    
    $input = requireParams(['phone']);
    $phone = $input['phone'];
    
    $stmt = $conn->prepare("SELECT * FROM customers WHERE phone = ?");
    $stmt->bind_param("s", $phone);
    $stmt->execute();
    $result = $stmt->get_result();
    $customer = $result->fetch_assoc();
    $stmt->close();
    
    if(!$customer){
        respond('success', ['found' => false, 'customer' => null]);
    }
    
    // Get customer stats
    $stmt = $conn->prepare("SELECT COUNT(*) as order_count, COALESCE(SUM(price), 0) as order_spent FROM orders WHERE customer_id = ?");
    $stmt->bind_param("i", $customer['id']);
    $stmt->execute();
    $orderStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    $stmt = $conn->prepare("SELECT COUNT(*) as booking_count, COALESCE(SUM(price), 0) as booking_spent FROM room_booking WHERE customer_id = ?");
    $stmt->bind_param("i", $customer['id']);
    $stmt->execute();
    $bookingStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    $customer['order_count'] = (int)$orderStats['order_count'];
    $customer['booking_count'] = (int)$bookingStats['booking_count'];
    $customer['total_spent'] = round((float)$orderStats['order_spent'] + (float)$bookingStats['booking_spent'], 2);
    
    // Determine loyalty tier
    $totalTransactions = $customer['order_count'] + $customer['booking_count'];
    $totalSpent = $customer['total_spent'];
    
    if($totalTransactions >= 50 || $totalSpent >= 10000){
        $customer['loyalty_tier'] = 'VIP';
        $customer['discount_percent'] = 15;
    } elseif($totalTransactions >= 25 || $totalSpent >= 5000){
        $customer['loyalty_tier'] = 'Gold';
        $customer['discount_percent'] = 10;
    } elseif($totalTransactions >= 10 || $totalSpent >= 2000){
        $customer['loyalty_tier'] = 'Silver';
        $customer['discount_percent'] = 5;
    } elseif($totalTransactions >= 5 || $totalSpent >= 500){
        $customer['loyalty_tier'] = 'Bronze';
        $customer['discount_percent'] = 3;
    } else {
        $customer['loyalty_tier'] = 'New';
        $customer['discount_percent'] = 0;
    }
    
    respond('success', ['found' => true, 'customer' => $customer]);
}
function timerUpdate(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['booking_id', 'new_finished_at']);
    $booking_id = (int)$input['booking_id'];
    $new_finished_at = $input['new_finished_at'];
    
    // Get booking
    $stmt = $conn->prepare("SELECT * FROM room_booking WHERE id = ? AND finished_at IS NULL");
    $stmt->bind_param("i", $booking_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $booking = $result->fetch_assoc();
    $stmt->close();
    
    if(!$booking){
        respond('error', 'Active booking not found.');
    }
    
    // Update finished_at
    $stmt = $conn->prepare("UPDATE room_booking SET finished_at = ? WHERE id = ?");
    $stmt->bind_param("si", $new_finished_at, $booking_id);
    $stmt->execute();
    $stmt->close();
    //make is booked to 0 in rooms table
    $room_id = $booking['room_id'];
    $stmt = $conn->prepare("UPDATE rooms SET is_booked = 0 WHERE id = ?");
    $stmt->bind_param("i", $room_id);
    $stmt->execute();
    $stmt->close();
    
    respond('success', 'Booking timer updated successfully.');
}
/*
   SHIFT MANAGEMENT & DAILY INCOME ANALYSIS FUNCTIONS
   For XSTATION - X-space Management System
   
   Features:
   1. Start/End shifts to track daily income per shift
   2. Print daily income analysis with detailed breakdowns
*/

// ============================================================
// SHIFT MANAGEMENT FUNCTIONS
// ============================================================

/**
 * Start a new shift
 * Creates a new shift record for the current admin
 */

/**
 * Get current active shift details
 */
function getCurrentShift(){
    global $conn;
    $admin = getAdmin();
    $adminId = $admin['id'];
    
    // Get active shift
    $stmt = $conn->prepare("
        SELECT s.*, a.name as admin_name, a.role as admin_role
        FROM shifts s
        JOIN admins a ON s.admin_id = a.id
        WHERE s.admin_id = ? 
        AND s.ended_at IS NULL 
        ORDER BY s.started_at DESC 
        LIMIT 1
    ");
    $stmt->bind_param("i", $adminId);
    $stmt->execute();
    $result = $stmt->get_result();
    $shift = $result->fetch_assoc();
    $stmt->close();
    
    if(!$shift){
        respond('success', ['has_active_shift' => false, 'shift' => null]);
    }
    
    $started_at = $shift['started_at'];
    $current_time = date('Y-m-d H:i:s');
    
    // Calculate current shift stats
    $stmt = $conn->prepare("
        SELECT 
            COUNT(*) as order_count,
            COALESCE(SUM(price), 0) as order_revenue,
            COALESCE(SUM(discount), 0) as order_discount
        FROM orders 
        WHERE created_at >= ? AND created_at <= ?
    ");
    $stmt->bind_param("ss", $started_at, $current_time);
    $stmt->execute();
    $orderStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    $stmt = $conn->prepare("
        SELECT 
            COUNT(*) as booking_count,
            COALESCE(SUM(price), 0) as booking_revenue
        FROM room_booking 
        WHERE createdAt >= ? AND createdAt <= ?
        AND finished_at IS NOT NULL
    ");
    $stmt->bind_param("ss", $started_at, $current_time);
    $stmt->execute();
    $bookingStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    // Calculate duration
    $start = new DateTime($started_at);
    $now = new DateTime();
    $duration = $start->diff($now);
    $durationHours = $duration->h + ($duration->days * 24) + ($duration->i / 60);
    
    $shift['current_revenue'] = round((float)$orderStats['order_revenue'] + (float)$bookingStats['booking_revenue'], 2);
    $shift['current_orders'] = (int)$orderStats['order_count'];
    $shift['current_bookings'] = (int)$bookingStats['booking_count'];
    $shift['current_discount'] = round((float)$orderStats['order_discount'], 2);
    $shift['duration_hours'] = round($durationHours, 2);
    
    respond('success', [
        'has_active_shift' => true, 
        'shift' => $shift
    ]);
}

/**
 * List all shifts with optional date filtering
 */
function listShifts(){
    global $conn;
    $admin = getAdmin();
    
    // Only superadmin can view all shifts
    $isSuper = ($admin['role'] == 'superadmin');
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $startDate = isset($input['start_date']) ? $input['start_date'] : null;
    $endDate = isset($input['end_date']) ? $input['end_date'] : null;
    
    // Build query
    $whereClause = "";
    $params = [];
    $types = "";
    
    if(!$isSuper){
        $whereClause = "WHERE s.admin_id = ?";
        $params[] = $admin['id'];
        $types .= "i";
    }
    
    if($startDate && $endDate){
        $dateFilter = $whereClause ? " AND" : " WHERE";
        $dateFilter .= " DATE(s.started_at) BETWEEN ? AND ?";
        $whereClause .= $dateFilter;
        $params[] = $startDate;
        $params[] = $endDate;
        $types .= "ss";
    } elseif($startDate){
        $dateFilter = $whereClause ? " AND" : " WHERE";
        $dateFilter .= " DATE(s.started_at) >= ?";
        $whereClause .= $dateFilter;
        $params[] = $startDate;
        $types .= "s";
    } elseif($endDate){
        $dateFilter = $whereClause ? " AND" : " WHERE";
        $dateFilter .= " DATE(s.started_at) <= ?";
        $whereClause .= $dateFilter;
        $params[] = $endDate;
        $types .= "s";
    }
    
    $sql = "
        SELECT s.*, a.name as admin_name, a.role as admin_role
        FROM shifts s
        JOIN admins a ON s.admin_id = a.id
        $whereClause
        ORDER BY s.started_at DESC
    ";
    
    if(!empty($params)){
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $conn->query($sql);
    }
    
    $shifts = [];
    while($row = $result->fetch_assoc()){
        $shifts[] = $row;
    }
    
    if(!empty($params)){
        $stmt->close();
    }
    
    respond('success', $shifts);
}

/**
 * Get detailed shift report by ID
 */
function getShiftReport(){
    global $conn;
    $admin = getAdmin();
    
    $input = requireParams(['shift_id']);
    $shiftId = (int)$input['shift_id'];
    
    // Get shift details
    $stmt = $conn->prepare("
        SELECT s.*, a.name as admin_name, a.role as admin_role, a.email as admin_email
        FROM shifts s
        JOIN admins a ON s.admin_id = a.id
        WHERE s.id = ?
    ");
    $stmt->bind_param("i", $shiftId);
    $stmt->execute();
    $result = $stmt->get_result();
    $shift = $result->fetch_assoc();
    $stmt->close();
    
    if(!$shift){
        respond('error', 'Shift not found.');
    }
    
    // Permission check: only superadmin or shift owner can view
    if($admin['role'] != 'superadmin' && $shift['admin_id'] != $admin['id']){
        respond('error', 'Unauthorized. You can only view your own shifts.');
    }
    
    $started_at = $shift['started_at'];
    $ended_at = $shift['ended_at'] ?? date('Y-m-d H:i:s');
    
    // Get detailed order breakdown
    $stmt = $conn->prepare("
        SELECT o.*, c.name as customer_name, c.phone as customer_phone
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.created_at >= ? AND o.created_at <= ?
        ORDER BY o.created_at ASC
    ");
    $stmt->bind_param("ss", $started_at, $ended_at);
    $stmt->execute();
    $ordersResult = $stmt->get_result();
    $orders = [];
    while($row = $ordersResult->fetch_assoc()){
        $orders[] = $row;
    }
    $stmt->close();
    
    // Get detailed booking breakdown
    $stmt = $conn->prepare("
        SELECT rb.*, r.name as room_name, c.name as customer_name, c.phone as customer_phone
        FROM room_booking rb
        JOIN rooms r ON rb.room_id = r.id
        LEFT JOIN customers c ON rb.customer_id = c.id
        WHERE rb.createdAt >= ? AND rb.createdAt <= ?
        AND rb.finished_at IS NOT NULL
        ORDER BY rb.createdAt ASC
    ");
    $stmt->bind_param("ss", $started_at, $ended_at);
    $stmt->execute();
    $bookingsResult = $stmt->get_result();
    $bookings = [];
    while($row = $bookingsResult->fetch_assoc()){
        $bookings[] = $row;
    }
    $stmt->close();
    
    // Get hourly breakdown
    $stmt = $conn->prepare("
        SELECT 
            HOUR(created_at) as hour,
            COUNT(*) as order_count,
            COALESCE(SUM(price), 0) as revenue
        FROM orders
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY HOUR(created_at)
        ORDER BY hour ASC
    ");
    $stmt->bind_param("ss", $started_at, $ended_at);
    $stmt->execute();
    $hourlyResult = $stmt->get_result();
    $hourlyBreakdown = [];
    while($row = $hourlyResult->fetch_assoc()){
        $hourlyBreakdown[] = $row;
    }
    $stmt->close();
    
    $shift['orders'] = $orders;
    $shift['bookings'] = $bookings;
    $shift['hourly_breakdown'] = $hourlyBreakdown;
    
    respond('success', $shift);
}

// ============================================================
// DAILY INCOME ANALYSIS FUNCTIONS
// ============================================================

/**
 * Get comprehensive daily income analysis
 * For printing and detailed reporting
 */
function getDailyIncomeAnalysis(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view daily income analysis.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    
    // Support date range: start_date and end_date, fallback to single date or today
    $startDate = isset($input['start_date']) ? $input['start_date'] : (isset($input['date']) ? $input['date'] : date('Y-m-d'));
    $endDate = isset($input['end_date']) ? $input['end_date'] : $startDate;
    
    // Get all shifts for this date range
    $stmt = $conn->prepare("
        SELECT s.*, a.name as admin_name, a.role as admin_role
        FROM shifts s
        JOIN admins a ON s.admin_id = a.id
        WHERE DATE(s.started_at) BETWEEN ? AND ?
        ORDER BY s.started_at ASC
    ");
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $shiftsResult = $stmt->get_result();
    $shifts = [];
    $totalShiftRevenue = 0;
    
    while($row = $shiftsResult->fetch_assoc()){
        // Calculate real-time revenue for each shift
        $shiftStart = $row['started_at'];
        $shiftEnd = $row['ended_at'] ?? date('Y-m-d H:i:s'); // Use current time if still active
        
        // Get orders revenue during this shift
        $orderStmt = $conn->prepare("
            SELECT COALESCE(SUM(price), 0) as order_revenue, COUNT(*) as order_count
            FROM orders 
            WHERE created_at >= ? AND created_at <= ?
        ");
        $orderStmt->bind_param("ss", $shiftStart, $shiftEnd);
        $orderStmt->execute();
        $orderData = $orderStmt->get_result()->fetch_assoc();
        $orderStmt->close();
        
        // Get bookings revenue during this shift
        $bookingStmt = $conn->prepare("
            SELECT COALESCE(SUM(price), 0) as booking_revenue, COUNT(*) as booking_count
            FROM room_booking 
            WHERE createdAt >= ? AND createdAt <= ? AND finished_at IS NOT NULL
        ");
        $bookingStmt->bind_param("ss", $shiftStart, $shiftEnd);
        $bookingStmt->execute();
        $bookingData = $bookingStmt->get_result()->fetch_assoc();
        $bookingStmt->close();
        
        // Calculate total revenue for this shift
        $shiftRevenue = (float)$orderData['order_revenue'] + (float)$bookingData['booking_revenue'];
        $row['calculated_revenue'] = round($shiftRevenue, 2);
        $row['order_revenue'] = round((float)$orderData['order_revenue'], 2);
        $row['booking_revenue'] = round((float)$bookingData['booking_revenue'], 2);
        $row['order_count'] = (int)$orderData['order_count'];
        $row['booking_count'] = (int)$bookingData['booking_count'];
        
        // Use calculated revenue if total_revenue is 0 or null (for active shifts)
        if(empty($row['total_revenue']) || $row['total_revenue'] == 0) {
            $row['total_revenue'] = $shiftRevenue;
        }
        
        $totalShiftRevenue += (float)$row['total_revenue'];
        $shifts[] = $row;
    }
    $stmt->close();
    
    // Get all orders for this date range
    $stmt = $conn->prepare("
        SELECT o.*, c.name as customer_name, c.phone as customer_phone
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE DATE(o.created_at) BETWEEN ? AND ?
        ORDER BY o.created_at ASC
    ");
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $ordersResult = $stmt->get_result();
    $orders = [];
    $totalOrderRevenue = 0;
    $totalOrderDiscount = 0;
    while($row = $ordersResult->fetch_assoc()){
        $totalOrderRevenue += (float)$row['price'];
        $totalOrderDiscount += (float)$row['discount'];
        $orders[] = $row;
    }
    $stmt->close();
    
    // Get all room bookings for this date range
    $stmt = $conn->prepare("
        SELECT rb.*, r.name as room_name, r.ps, c.name as customer_name, c.phone as customer_phone
        FROM room_booking rb
        JOIN rooms r ON rb.room_id = r.id
        LEFT JOIN customers c ON rb.customer_id = c.id
        WHERE DATE(rb.createdAt) BETWEEN ? AND ?
        AND rb.finished_at IS NOT NULL
        ORDER BY rb.createdAt ASC
    ");
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $bookingsResult = $stmt->get_result();
    $bookings = [];
    $totalBookingRevenue = 0;
    while($row = $bookingsResult->fetch_assoc()){
        $totalBookingRevenue += (float)$row['price'];
        $bookings[] = $row;
    }
    $stmt->close();
    
    // Calculate profit from orders (cost analysis)
    $stmt = $conn->prepare("
        SELECT 
            COALESCE(SUM(oi.total_price), 0) as gross_revenue,
            COALESCE(SUM(ci.cost * oi.quantity), 0) as total_cost
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN cafeteria_items ci ON oi.item_id = ci.id
        WHERE DATE(o.created_at) BETWEEN ? AND ?
    ");
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $profitResult = $stmt->get_result();
    $profitData = $profitResult->fetch_assoc();
    $stmt->close();
    
    $orderCost = (float)$profitData['total_cost'];
    $orderProfit = $totalOrderRevenue - $orderCost;
    
    // Top selling items for the date range
    $stmt = $conn->prepare("
        SELECT 
            ci.id, ci.name, ci.price, ci.cost,
            SUM(oi.quantity) as quantity_sold,
            SUM(oi.total_price) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN cafeteria_items ci ON oi.item_id = ci.id
        WHERE DATE(o.created_at) BETWEEN ? AND ?
        GROUP BY ci.id
        ORDER BY quantity_sold DESC
        LIMIT 10
    ");
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $topItemsResult = $stmt->get_result();
    $topItems = [];
    while($row = $topItemsResult->fetch_assoc()){
        $topItems[] = $row;
    }
    $stmt->close();
    
    // Room utilization for the date range
    $stmt = $conn->prepare("
        SELECT 
            r.id, r.name, r.ps,
            COUNT(rb.id) as booking_count,
            COALESCE(SUM(rb.price), 0) as revenue,
            COALESCE(SUM(TIMESTAMPDIFF(MINUTE, rb.started_at, rb.finished_at)), 0) as total_minutes
        FROM rooms r
        LEFT JOIN room_booking rb ON r.id = rb.room_id AND DATE(rb.createdAt) BETWEEN ? AND ?
        GROUP BY r.id
        ORDER BY revenue DESC
    ");
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $roomUtilizationResult = $stmt->get_result();
    $roomUtilization = [];
    while($row = $roomUtilizationResult->fetch_assoc()){
        $row['total_hours'] = round((float)$row['total_minutes'] / 60, 2);
        $roomUtilization[] = $row;
    }
    $stmt->close();
    
    // Hourly revenue breakdown
    $hourlyData = [];
    for($hour = 0; $hour < 24; $hour++){
        $period = $hour >= 12 ? 'PM' : 'AM';
        $hour12 = $hour % 12;
        if($hour12 === 0) $hour12 = 12;
        $hourlyData[$hour] = [
            'hour' => $hour,
            'hour_label' => $hour12 . ' ' . $period,
            'order_revenue' => 0,
            'booking_revenue' => 0,
            'order_count' => 0,
            'booking_count' => 0
        ];
    }
    
    // Fill in order data
    $stmt = $conn->prepare("
        SELECT 
            HOUR(created_at) as hour,
            COUNT(*) as count,
            COALESCE(SUM(price), 0) as revenue
        FROM orders
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY HOUR(created_at)
    ");
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $hourlyOrdersResult = $stmt->get_result();
    while($row = $hourlyOrdersResult->fetch_assoc()){
        $hour = (int)$row['hour'];
        $hourlyData[$hour]['order_revenue'] += (float)$row['revenue'];
        $hourlyData[$hour]['order_count'] += (int)$row['count'];
    }
    $stmt->close();
    
    // Fill in booking data
    $stmt = $conn->prepare("
        SELECT 
            HOUR(createdAt) as hour,
            COUNT(*) as count,
            COALESCE(SUM(price), 0) as revenue
        FROM room_booking
        WHERE DATE(createdAt) BETWEEN ? AND ? AND finished_at IS NOT NULL
        GROUP BY HOUR(createdAt)
    ");
    $stmt->bind_param("ss", $startDate, $endDate);
    $stmt->execute();
    $hourlyBookingsResult = $stmt->get_result();
    while($row = $hourlyBookingsResult->fetch_assoc()){
        $hour = (int)$row['hour'];
        $hourlyData[$hour]['booking_revenue'] = (float)$row['revenue'];
        $hourlyData[$hour]['booking_count'] = (int)$row['count'];
    }
    $stmt->close();
    
    // Add total for each hour
    foreach($hourlyData as $hour => $data){
        $hourlyData[$hour]['total_revenue'] = $data['order_revenue'] + $data['booking_revenue'];
        $hourlyData[$hour]['total_transactions'] = $data['order_count'] + $data['booking_count'];
    }
    
    // Payment method breakdown (if you have payment methods in orders table)
    // Assuming cash vs card/other - you may need to adjust based on your schema
    
    $totalRevenue = $totalOrderRevenue + $totalBookingRevenue;
    $totalProfit = $orderProfit + $totalBookingRevenue; // Bookings are pure profit
    
    respond('success', [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'summary' => [
            'total_revenue' => round($totalRevenue, 2),
            'order_revenue' => round($totalOrderRevenue, 2),
            'booking_revenue' => round($totalBookingRevenue, 2),
            'total_cost' => round($orderCost, 2),
            'total_profit' => round($totalProfit, 2),
            'profit_margin' => $totalRevenue > 0 ? round(($totalProfit / $totalRevenue) * 100, 2) : 0,
            'total_discount' => round($totalOrderDiscount, 2),
            'total_orders' => count($orders),
            'total_bookings' => count($bookings),
            'total_transactions' => count($orders) + count($bookings),
            'avg_order_value' => count($orders) > 0 ? round($totalOrderRevenue / count($orders), 2) : 0,
            'avg_booking_value' => count($bookings) > 0 ? round($totalBookingRevenue / count($bookings), 2) : 0
        ],
        'shifts' => [
            'count' => count($shifts),
            'total_shift_revenue' => round($totalShiftRevenue, 2),
            'details' => $shifts
        ],
        'orders' => $orders,
        'bookings' => $bookings,
        'top_selling_items' => $topItems,
        'room_utilization' => $roomUtilization,
        'hourly_breakdown' => array_values($hourlyData),
        'peak_hour' =>  findPeakHour($hourlyData),
        'report_generated_at' => date('Y-m-d H:i:s'),
        'report_generated_by' => [
            'id' => $admin['id'],
            'name' => $admin['name'],
            'role' => $admin['role']
        ]
    ]);
}

/**
 * Get printable daily income report (formatted for printing)
 */
function getPrintableDailyReport(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can print reports.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $date = isset($input['date']) ? $input['date'] : date('Y-m-d');
    
    // Get the same data as getDailyIncomeAnalysis but format it for printing
    // We'll call the same logic but return a print-friendly format
    
    // This would be the same query logic as above, but simplified for printing
    // For brevity, I'll create a summary version
    
    $dateFormatted = date('l, F j, Y', strtotime($date));
    
    // Get summary stats (using prepared statements for security)
    $stmt = $conn->prepare("
        SELECT 
            COUNT(*) as count,
            COALESCE(SUM(price), 0) as revenue,
            COALESCE(SUM(discount), 0) as discount
        FROM orders 
        WHERE DATE(created_at) = ?
    ");
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $orderStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    $stmt = $conn->prepare("
        SELECT 
            COUNT(*) as count,
            COALESCE(SUM(price), 0) as revenue
        FROM room_booking 
        WHERE DATE(createdAt) = ? AND finished_at IS NOT NULL
    ");
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $bookingStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    $stmt = $conn->prepare("
        SELECT 
            COUNT(*) as count,
            COALESCE(SUM(total_revenue), 0) as revenue,
            COALESCE(SUM(opening_cash), 0) as opening_cash,
            COALESCE(SUM(closing_cash), 0) as closing_cash
        FROM shifts 
        WHERE DATE(started_at) = ?
    ");
    $stmt->bind_param("s", $date);
    $stmt->execute();
    $shiftStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    $totalRevenue = (float)$orderStats['revenue'] + (float)$bookingStats['revenue'];
    
    $report = [
        'business_name' => 'X-SPACE STATION',
        'report_title' => 'DAILY INCOME ANALYSIS',
        'date' => $dateFormatted,
        'date_short' => $date,
        'print_time' => date('Y-m-d H:i:s'),
        'printed_by' => $admin['name'],
        
        'summary' => [
            'total_revenue' => round($totalRevenue, 2),
            'order_revenue' => round((float)$orderStats['revenue'], 2),
            'booking_revenue' => round((float)$bookingStats['revenue'], 2),
            'total_discount' => round((float)$orderStats['discount'], 2),
            'net_revenue' => round($totalRevenue - (float)$orderStats['discount'], 2),
            'total_orders' => (int)$orderStats['count'],
            'total_bookings' => (int)$bookingStats['count'],
            'total_transactions' => (int)$orderStats['count'] + (int)$bookingStats['count']
        ],
        
        'shifts' => [
            'count' => (int)$shiftStats['count'],
            'total_opening_cash' => round((float)$shiftStats['opening_cash'], 2),
            'total_closing_cash' => round((float)$shiftStats['closing_cash'], 2),
            'shift_revenue' => round((float)$shiftStats['revenue'], 2)
        ],
        
        'formatted_for_print' => true
    ];
    
    respond('success', $report);
}

/**
 * Helper function to format hour in 12-hour format
 */
function format12Hour($hour){
    $period = $hour >= 12 ? 'PM' : 'AM';
    $hour12 = $hour % 12;
    if($hour12 === 0) $hour12 = 12;
    return $hour12 . ' ' . $period;
}

/**
 * Helper function to find peak hour from hourly data
 */
function findPeakHour($hourlyData){
    $maxRevenue = 0;
    $peakHour = 0;
    
    foreach($hourlyData as $hour => $data){
        if($data['total_revenue'] > $maxRevenue){
            $maxRevenue = $data['total_revenue'];
            $peakHour = $hour;
        }
    }
    
    return [
        'hour' => $peakHour,
        'hour_label' => format12Hour($peakHour) . ' - ' . format12Hour(($peakHour + 1) % 24),
        'revenue' => round($maxRevenue, 2)
    ];
}

/**
 * Get monthly shift summary
 */
function getMonthlyShiftSummary(){
    global $conn;
    $admin = getAdmin();
    
    if($admin['role'] != 'superadmin'){
        respond('error', 'Unauthorized. Only superadmin can view monthly reports.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $month = isset($input['month']) ? $input['month'] : date('Y-m');
    
    // Get all shifts for the month (using prepared statements for security)
    $stmt = $conn->prepare("
        SELECT 
            DATE(started_at) as date,
            COUNT(*) as shift_count,
            COALESCE(SUM(total_revenue), 0) as revenue,
            COALESCE(SUM(total_orders), 0) as orders,
            COALESCE(SUM(total_bookings), 0) as bookings,
            COALESCE(SUM(duration_hours), 0) as total_hours
        FROM shifts
        WHERE DATE_FORMAT(started_at, '%Y-%m') = ?
        AND status = 'completed'
        GROUP BY DATE(started_at)
        ORDER BY date ASC
    ");
    $stmt->bind_param("s", $month);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $dailySummary = [];
    $totalRevenue = 0;
    while($row = $result->fetch_assoc()){
        $totalRevenue += (float)$row['revenue'];
        $dailySummary[] = $row;
    }
    $stmt->close();
    
    // Get staff performance for the month
    $stmt = $conn->prepare("
        SELECT 
            a.id, a.name, a.role,
            COUNT(s.id) as shift_count,
            COALESCE(SUM(s.total_revenue), 0) as revenue,
            COALESCE(SUM(s.duration_hours), 0) as hours_worked
        FROM admins a
        LEFT JOIN shifts s ON a.id = s.admin_id 
            AND DATE_FORMAT(s.started_at, '%Y-%m') = ?
            AND s.status = 'completed'
        WHERE a.role != 'superadmin'
        GROUP BY a.id
        ORDER BY revenue DESC
    ");
    $stmt->bind_param("s", $month);
    $stmt->execute();
    $staffResult = $stmt->get_result();
    
    $staffPerformance = [];
    while($row = $staffResult->fetch_assoc()){
        $staffPerformance[] = $row;
    }
    $stmt->close();
    
    respond('success', [
        'month' => $month,
        'month_name' => date('F Y', strtotime($month . '-01')),
        'summary' => [
            'total_revenue' => round($totalRevenue, 2),
            'total_days' => count($dailySummary),
            'avg_daily_revenue' => count($dailySummary) > 0 ? round($totalRevenue / count($dailySummary), 2) : 0
        ],
        'daily_summary' => $dailySummary,
        'staff_performance' => $staffPerformance
    ]);
}

