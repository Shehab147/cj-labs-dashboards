<?php
/*
   ________                __  _      __     __          __        
  / ____/ /___  __  ______/ / (_)__  / /_   / /   ____ _/ /_  _____
 / /   / / __ \/ / / / __  / / / _ \/ __/  / /   / __ `/ __ \/ ___/
/ /___/ / /_/ / /_/ / /_/ / / /  __/ /_   / /___/ /_/ / /_/ (__  ) 
\____/_/\____/\__,_/\__,_/_/ /\___/\__/  /_____/\__,_/_.___/____/  
                        /___/                                      

                        X-Space Config
*/

$dbHost = 'localhost';
$dbUser = 'x-station_usr';
$dbPass = '<)cJ>nk`;),{36yv';
$dbName = 'x-station';
$conn = new mysqli($dbHost, $dbUser, $dbPass, $dbName);

// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, X-Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 86400"); // Cache for 1 day
// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
function respond($status, $data = []){
    header('Content-Type: application/json');
    if($status == 'error'){
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => $data]);
    } else {
        http_response_code(200);
        echo json_encode(['status' => 'success', 'data' => $data]);
    }
    exit;
}

function getToken(){
    $headers = getallheaders();
    // Normalize header keys to handle case-insensitivity
    $headers = array_change_key_case($headers, CASE_LOWER);
    
    // Check for x-authorization header (lowercase due to normalization)
    if(isset($headers['x-authorization'])){
        return str_replace('Bearer ', '', $headers['x-authorization']);
    }
    
    // Also check HTTP_X_AUTHORIZATION (some servers use this format)
    if(isset($_SERVER['HTTP_X_AUTHORIZATION'])){
        return str_replace('Bearer ', '', $_SERVER['HTTP_X_AUTHORIZATION']);
    }
    
    return null;
}

function getAdmin(){
    global $conn;
    $token = getToken();
    if(!$token){
        respond('error', 'No authorization token provided.');
    }
    $stmt = $conn->prepare("SELECT admin_id FROM session WHERE token = ? AND expire_at > NOW()");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $result = $stmt->get_result();
    if($result->num_rows == 0){
        respond('error', 'Invalid or expired token.');
    }
    $row = $result->fetch_assoc();
    $adminId = $row['admin_id'];
    $stmt->close();
    $sql = "SELECT id, name ,email ,role, status FROM admins WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $adminId);
    $stmt->execute();
    $result = $stmt->get_result();
    if($result->num_rows == 0){
        respond('error', 'User not found.');
    }
    $user = $result->fetch_assoc();
    $stmt->close();
    return $user;

}



function requireParams($params){
    $input = json_decode(file_get_contents('php://input'), true);
    foreach($params as $param){
        if(!isset($input[$param])){
            respond('error', "Missing parameter: $param");
            exit;
        }
    }
    return $input;
}





















/*-
--
-- Database: `x-station`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `role` enum('superadmin','admin','manager','cashier') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'admin',
  `status` enum('active','inactive') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `name`, `email`, `password`, `role`, `status`, `created_at`) VALUES
(1, 'Super Admin', 'admin@xstation.com', '0192023a7bbd73250516f069df18b500', 'superadmin', 'active', '2026-01-29 15:08:31'),
(4, 'shehab', 'shehab@cloudjet.org', '0192023a7bbd73250516f069df18b500', 'superadmin', 'active', '2026-01-29 16:11:35'),
(8, 'محمد', 'm@m.com', '867624eacb6d2fdd0fac648d5b340ba9', 'admin', 'active', '2026-01-30 19:24:58'),
(9, 'shehab', 'admin@egyptair.com.eg', '5123696c13b2de94c9dfa4ff14588df7', 'admin', 'active', '2026-02-01 16:17:47'),
(10, 'Mohamed', 'mohamed@xstation.com', 'cc03e747a6afbbcbf8be7668acfebee5', 'admin', 'active', '2026-02-04 19:54:49');

-- --------------------------------------------------------

--
-- Table structure for table `cafeteria_items`
--

CREATE TABLE `cafeteria_items` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `cost` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Purchase cost',
  `price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Selling price',
  `photo` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cafeteria_items`
--

INSERT INTO `cafeteria_items` (`id`, `name`, `cost`, `price`, `photo`, `stock`, `created_at`) VALUES
(2, 'redbull', 25.00, 70.00, '', 19, '2026-01-29 19:49:37'),
(3, 'tea', 5.00, 10.00, '', 17, '2026-01-29 20:02:07'),
(4, 'Pepsi Can', 5.00, 10.00, 'pepsi.jpg', 45, '2026-01-29 21:18:55'),
(5, 'Chips', 4.00, 8.00, 'chips.jpg', 37, '2026-01-29 21:18:55'),
(6, 'Water Bottle', 2.00, 5.00, 'water.jpg', 108, '2026-01-29 21:18:55'),
(7, 'Coffe', 5.00, 15.00, '', 116, '2026-01-30 11:50:40');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `name`, `phone`, `created_at`) VALUES
(4, 'shehab', '01150030340', '2026-01-29 19:44:13'),
(5, 'osama', '011530034034', '2026-01-29 20:01:47'),
(9, 'SAMAA', '01026112020', '2026-01-30 10:55:55'),
(12, 'shsh', '123123123123', '2026-01-30 14:14:42'),
(13, 'jjjk', '231432234324', '2026-01-30 14:18:48'),
(14, 'kkkk', 'jiokj', '2026-02-01 18:24:33'),
(15, 'محمد مخلوف', '٠١٠٢٨١١٢٢١', '2026-02-02 09:09:13');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int NOT NULL,
  `customer_id` int NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Final price after discount',
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `booking_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `customer_id`, `price`, `discount`, `created_at`, `booking_id`) VALUES
(8, 4, 80.00, 0.00, '2026-01-29 20:23:51', 0),
(9, 4, 70.00, 0.00, '2026-01-29 20:27:14', 0),
(13, 4, 75.00, 0.00, '2026-01-30 10:57:14', 0),
(14, 9, 20.00, 0.00, '2026-01-30 11:16:32', 0),
(15, 9, 93.00, 0.00, '2026-01-30 12:00:54', 0),
(16, 5, 15.00, 0.00, '2026-01-30 12:02:40', 0),
(17, 5, 5.00, 0.00, '2026-01-30 12:02:47', 0),
(18, 5, 10.00, 0.00, '2026-01-30 12:04:09', 0),
(19, 5, 15.00, 0.00, '2026-01-30 12:04:20', 0),
(20, 4, 420.00, 0.00, '2026-01-30 12:05:31', 0),
(21, 5, 210.00, 0.00, '2026-01-30 12:05:53', 0),
(22, 13, 15.00, 0.00, '2026-01-30 14:18:51', 0),
(23, 4, 23.00, 0.00, '2026-01-30 19:21:25', 0),
(24, 12, 90.00, 0.00, '2026-02-01 18:24:47', 0),
(25, 15, 23.00, 0.00, '2026-02-02 09:09:55', 0),
(26, 13, 15.00, 0.00, '2026-02-02 09:10:41', 0),
(27, 15, 70.00, 0.00, '2026-02-04 16:04:02', 0),
(28, 15, 210.00, 0.00, '2026-02-04 16:53:18', 0),
(29, 15, 20.00, 0.00, '2026-02-04 19:52:15', 0),
(30, 14, 60.00, 0.00, '2026-02-04 21:32:52', 0),
(31, 14, 15.00, 0.00, '2026-02-04 21:35:34', 0),
(33, 15, 30.00, 0.00, '2026-02-04 21:48:20', 0),
(34, 15, 10.00, 0.00, '2026-02-04 21:48:33', 0);

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int NOT NULL,
  `order_id` int NOT NULL,
  `item_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `total_price` decimal(10,2) NOT NULL DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `item_id`, `quantity`, `total_price`) VALUES
(9, 8, 3, 1, 10.00),
(10, 8, 2, 1, 70.00),
(11, 9, 2, 1, 70.00),
(13, 13, 2, 1, 70.00),
(14, 13, 6, 1, 5.00),
(15, 14, 4, 2, 20.00),
(16, 15, 7, 1, 15.00),
(17, 15, 5, 1, 8.00),
(18, 15, 2, 1, 70.00),
(19, 16, 7, 1, 15.00),
(20, 17, 6, 1, 5.00),
(21, 18, 4, 1, 10.00),
(22, 19, 7, 1, 15.00),
(23, 20, 2, 6, 420.00),
(24, 21, 2, 3, 210.00),
(25, 22, 7, 1, 15.00),
(26, 23, 5, 1, 8.00),
(27, 23, 7, 1, 15.00),
(28, 24, 7, 6, 90.00),
(29, 25, 5, 1, 8.00),
(30, 25, 7, 1, 15.00),
(31, 26, 7, 1, 15.00),
(32, 27, 2, 1, 70.00),
(33, 28, 2, 3, 210.00),
(34, 29, 3, 2, 20.00),
(35, 30, 7, 4, 60.00),
(36, 31, 7, 1, 15.00),
(37, 33, 7, 2, 30.00),
(38, 34, 4, 1, 10.00);

-- --------------------------------------------------------

--
-- Table structure for table `rooms`
--

CREATE TABLE `rooms` (
  `id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `ps` varchar(100) COLLATE utf8mb4_general_ci NOT NULL COMMENT 'PlayStation version or type',
  `hour_cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `capacity` int NOT NULL DEFAULT '1',
  `is_booked` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rooms`
--

INSERT INTO `rooms` (`id`, `name`, `ps`, `hour_cost`, `capacity`, `is_booked`, `created_at`) VALUES
(17, 'جهاز 1', 'PS4', 30.00, 1, 1, '2026-02-04 16:49:58'),
(18, 'جهاز 2', 'PS4', 30.00, 1, 0, '2026-02-04 16:50:22'),
(19, 'جهاز 3', 'PS4', 30.00, 1, 0, '2026-02-04 16:50:32'),
(20, 'جهاز 4', 'PS4', 30.00, 1, 0, '2026-02-04 16:50:43'),
(21, 'جهاز 5', 'PS4', 30.00, 1, 0, '2026-02-04 16:50:52'),
(22, 'جهاز 6', 'PS4', 30.00, 1, 0, '2026-02-04 16:51:01'),
(23, 'جهاز 7', 'PS4', 30.00, 1, 0, '2026-02-04 16:51:11'),
(24, 'جهاز 8', 'PS4', 30.00, 1, 0, '2026-02-04 16:51:39'),
(25, 'جهاز 9', 'PS5', 40.00, 1, 0, '2026-02-04 16:51:46'),
(26, 'جهاز 10', 'PS5', 40.00, 1, 0, '2026-02-04 16:51:57');

-- --------------------------------------------------------

--
-- Table structure for table `room_booking`
--

CREATE TABLE `room_booking` (
  `id` int NOT NULL,
  `customer_id` int NOT NULL,
  `room_id` int NOT NULL,
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` timestamp NULL DEFAULT NULL COMMENT 'NULL for active/open sessions',
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `room_booking`
--

INSERT INTO `room_booking` (`id`, `customer_id`, `room_id`, `started_at`, `finished_at`, `price`, `createdAt`) VALUES
(73, 15, 17, '2026-02-04 16:52:59', '2026-02-04 19:44:36', 85.50, '2026-02-04 16:52:59'),
(74, 15, 17, '2026-02-04 21:26:59', NULL, 0.00, '2026-02-04 21:26:59');

-- --------------------------------------------------------

--
-- Table structure for table `session`
--

CREATE TABLE `session` (
  `id` int NOT NULL,
  `admin_id` int NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `expire_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('active','inactive') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `session`
--

INSERT INTO `session` (`id`, `admin_id`, `token`, `expire_at`, `created_at`, `status`) VALUES
(1, 1, '3e9e4f6082b5cfb30da9b04f07d96a8e', '2026-01-30 15:15:43', '2026-01-29 15:15:43', 'active'),
(2, 1, '6c1351b3d07405f468cdcb9321b20bdb', '2026-01-30 15:16:34', '2026-01-29 15:16:34', 'active'),
(3, 1, '6805c11a2e1d9616fd04c683483ad030', '2026-01-30 15:18:37', '2026-01-29 15:18:37', 'active'),
(4, 1, 'c29aad294594ba44a97fa64cc325f08b', '2026-01-30 15:23:16', '2026-01-29 15:23:16', 'active'),
(5, 1, '68e7475fb11a9bdd88b18819272082be', '2026-01-30 15:38:29', '2026-01-29 15:38:29', 'active'),
(6, 1, '447f1f402ffc60d8ed6a3ba434d1cf0d', '2026-01-30 15:42:35', '2026-01-29 15:42:35', 'active'),
(7, 1, 'e47121f12b3a170dfd5068e131ed0c63', '2026-01-30 15:51:21', '2026-01-29 15:51:21', 'active'),
(8, 1, 'b4a5279fe53f992fe749855e194906a6', '2026-01-30 16:07:57', '2026-01-29 16:07:57', 'active'),
(9, 1, 'ed52132283d00d5fe3076a1eaa727718', '2026-01-30 19:34:51', '2026-01-29 19:34:51', 'active'),
(10, 4, '0323f8238bb4737260b2481a073d1d9a', '2026-01-30 19:42:39', '2026-01-29 19:42:39', 'active'),
(11, 4, '5aeaa168926e5a2a60aeffd84a421879', '2026-01-30 20:55:04', '2026-01-29 20:55:04', 'active'),
(12, 4, '3758cc0373f37bc69f82adb9af72b91b', '2026-01-30 21:28:17', '2026-01-29 21:28:17', 'active'),
(13, 4, 'd363fef9cfe743565705dde842f28e71', '2026-01-30 21:32:33', '2026-01-29 21:32:33', 'active'),
(14, 4, 'b107debbdc970e4edcf9da0d7a4b8c6d', '2026-01-30 21:38:18', '2026-01-29 21:38:18', 'active'),
(16, 4, '578ee4368dc271327d4e9ae7a8d7246c', '2026-01-30 21:52:10', '2026-01-29 21:52:10', 'active'),
(17, 4, '4fed42498bbfac8485e14ac5768c7a7f', '2026-01-30 22:08:26', '2026-01-29 22:08:26', 'active'),
(18, 1, '59d667b84b5f4e034b5ade4c60b91aec', '2026-01-31 11:03:27', '2026-01-30 11:03:27', 'active'),
(19, 4, 'c32996200cc6e9b24916da32dd21d60f', '2026-01-31 11:46:19', '2026-01-30 11:46:19', 'active'),
(20, 4, '38a8455d7a019c92f0777e831255728d', '2026-01-31 11:56:25', '2026-01-30 11:56:25', 'active'),
(21, 4, '70890c02b0f1023c2c78bcc71e59d20d', '2026-01-31 12:21:52', '2026-01-30 12:21:52', 'active'),
(25, 4, '97245c9425c8d8ca07abb930e19fe732', '2026-01-31 14:11:24', '2026-01-30 14:11:24', 'active'),
(27, 4, 'a34e2d5130139f4baae5b3ea980ab724', '2026-01-31 14:15:56', '2026-01-30 14:15:56', 'active'),
(28, 8, '36ca7d9c776f88e208d8d18fbb9551f7', '2026-01-31 19:32:08', '2026-01-30 19:32:08', 'active'),
(29, 8, '3559dd5f48066219eb4f2c8ec03e7363', '2026-01-31 19:36:14', '2026-01-30 19:36:14', 'active'),
(30, 1, '4887524c4b7cde90c9f51fd565d31e14', '2026-02-02 14:10:41', '2026-02-01 14:10:41', 'active'),
(31, 1, '098d88ee281db85a2ab3b4d7a427e456', '2026-02-02 15:57:48', '2026-02-01 15:57:48', 'active'),
(32, 1, '2ba038fcd7a33ab617966b487599aa2c', '2026-02-02 15:58:43', '2026-02-01 15:58:43', 'active'),
(33, 1, 'd2a31373842a0abb69bf2702d7a2debb', '2026-02-02 16:04:01', '2026-02-01 16:04:01', 'active'),
(34, 9, 'e9b47c103255fe60abb5c935f7e020ed', '2026-02-02 16:17:55', '2026-02-01 16:17:55', 'active'),
(35, 4, 'a36460ded7ba0640d212247d05c1ea2f', '2026-02-02 16:49:40', '2026-02-01 16:49:40', 'active'),
(36, 4, '42b882ebec4cb51c1879b45e2449d68c', '2026-02-02 17:31:24', '2026-02-01 17:31:24', 'active'),
(37, 9, 'dbf3a49c35cd81a64f38ddd7b66fc3ee', '2026-02-02 18:49:54', '2026-02-01 18:49:54', 'active'),
(38, 4, '47283fe29021573d34fce72a5689c516', '2026-02-02 19:06:18', '2026-02-01 19:06:18', 'active'),
(39, 9, '2c1da98b2491f6bc26b691ceb9fdee1e', '2026-02-03 09:08:28', '2026-02-02 09:08:28', 'active'),
(40, 1, 'c1c25fbdd682bd541a63bbd4c9a85478', '2026-02-03 21:16:14', '2026-02-02 21:16:14', 'active'),
(41, 1, 'd157caea995747a4b80cd7f1f23a8b64', '2026-02-05 15:51:37', '2026-02-04 15:51:37', 'active'),
(42, 1, 'fb9c6945db03f599ecfe9166a4db575e', '2026-02-05 19:43:23', '2026-02-04 19:43:23', 'active'),
(43, 10, '8d66d297aa65a782d07c2cd5055aaf07', '2026-02-05 19:55:04', '2026-02-04 19:55:04', 'active'),
(44, 1, '3d69b55456d135d13fc2f087d2283d17', '2026-02-05 20:01:46', '2026-02-04 20:01:46', 'active'),
(45, 1, 'dd09b0d3dd2b062c8d75f8e1bbba56e9', '2026-02-05 21:30:24', '2026-02-04 21:30:24', 'active'),
(46, 1, 'ea3b9b68fc5c21c6b8296bb3275eba9e', '2026-02-05 21:32:36', '2026-02-04 21:32:36', 'active');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `cafeteria_items`
--
ALTER TABLE `cafeteria_items`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `created_at` (`created_at`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `item_id` (`item_id`);

--
-- Indexes for table `rooms`
--
ALTER TABLE `rooms`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `room_booking`
--
ALTER TABLE `room_booking`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `room_id` (`room_id`),
  ADD KEY `finished_at` (`finished_at`);

--
-- Indexes for table `session`
--
ALTER TABLE `session`
  ADD PRIMARY KEY (`id`),
  ADD KEY `admin_id` (`admin_id`),
  ADD KEY `token` (`token`(191));

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `cafeteria_items`
--
ALTER TABLE `cafeteria_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `rooms`
--
ALTER TABLE `rooms`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `room_booking`
--
ALTER TABLE `room_booking`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=75;

--
-- AUTO_INCREMENT for table `session`
--
ALTER TABLE `session`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=47;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `order_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `orderitem_item_fk` FOREIGN KEY (`item_id`) REFERENCES `cafeteria_items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orderitem_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `room_booking`
--
ALTER TABLE `room_booking`
  ADD CONSTRAINT `booking_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_room_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `session`
--
ALTER TABLE `session`
  ADD CONSTRAINT `session_admin_fk` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE;
COMMIT;

*/