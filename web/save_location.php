<?php
// Tampilkan error saat development
ini_set('display_errors', 1);
error_reporting(E_ALL);

include 'db_config.php';

header('Content-Type: application/json');

$latitude = $_POST['latitude'] ?? null;
$longitude = $_POST['longitude'] ?? null;
$city = $_POST['city'] ?? null;

if (!$latitude || !$longitude) {
    echo json_encode(['status' => 'error', 'message' => 'Latitude dan longitude wajib diisi.']);
    exit;
}

// Jika city tidak dikirim atau kosong, gunakan "Unknown"
if (!$city) {
    $city = "Unknown";
}

$stmt = $conn->prepare("INSERT INTO locations (latitude, longitude, city) VALUES (?, ?, ?)");
$stmt->bind_param("dds", $latitude, $longitude, $city);

if ($stmt->execute()) {
    echo json_encode(['status' => 'success']);
} else {
    echo json_encode(['status' => 'error', 'message' => $stmt->error]);
}

$stmt->close();
$conn->close();
?>
