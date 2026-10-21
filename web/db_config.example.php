<?php
$host = "localhost";
$user = "username_anda";
$password = "password_anda";
$database = "nama_database";

$conn = new mysqli($host, $user, $password, $database);

if ($conn->connect_error) {
    die("Koneksi gagal: " . $conn->connect_error);
}
?>
