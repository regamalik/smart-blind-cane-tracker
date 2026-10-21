<?php
// Tampilkan error untuk debugging
ini_set('display_errors', 1);
error_reporting(E_ALL);

include 'db_config.php';

header('Content-Type: application/json');

$date = $_GET['date'] ?? null;

if (!$date) {
    echo json_encode([]);
    exit;
}
// Hapus data yang lebih dari 1 jam
$sql_delete = "DELETE FROM lokasi WHERE created_at < (NOW() - INTERVAL 1 HOUR)";
$conn->query($sql_delete);

$stmt = $conn->prepare("SELECT latitude, longitude, city, timestamp FROM locations WHERE DATE(timestamp) = ?");
$stmt->bind_param("s", $date);
$stmt->execute();
$result = $stmt->get_result();

$data = [];
while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode($data);

$stmt->close();
$conn->close();
?>
