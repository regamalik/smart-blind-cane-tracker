# 🦯 Smart Blind Cane Tracker

![Platform](https://img.shields.io/badge/Platform-ESP32-black) ![Backend](https://img.shields.io/badge/Backend-PHP-777BB4?logo=php&logoColor=white) ![Database](https://img.shields.io/badge/DB-MySQL-4479A1?logo=mysql&logoColor=white) ![Map](https://img.shields.io/badge/Map-Leaflet.js-199900?logo=leaflet&logoColor=white) ![License](https://img.shields.io/badge/License-MIT-green)

Sistem **tongkat tunanetra pintar** berbasis IoT yang menggabungkan **pelacakan lokasi real-time (GPS + web tracking)** dengan **navigasi aktif**: deteksi halangan dan pendeteksian jalur pemandu kuning (*guiding block*).

Proyek ini merupakan implementasi Tugas Akhir S1 Teknik Komputer — Universitas Teknokrat Indonesia, yang telah **diuji coba langsung bersama mitra di SLB-A Bina Insani Bandar Lampung**.

## ✨ Fitur

### Perangkat Keras (Smart Cane)
- **Pelacakan lokasi** — GPS Neo-6M membaca koordinat dan mengirimkannya ke server via WiFi (interval terkonfigurasi, default 10 detik).
- **Deteksi halangan** — Ultrasonik HC-SR04 + buzzer; jarak ambang diatur lewat potensiometer (±5–100 cm).
- **Deteksi jalur kuning** — Sensor warna TCS34725; motor vibrator mati otomatis saat tongkat berada di jalur pemandu yang benar.
- **Konektivitas pintar** — `WiFiManager`: ganti jaringan WiFi tanpa pemrograman ulang (tombol reset fisik saat boot).
- **Reverse geocoding** — API Geoapify mengubah koordinat menjadi nama kota secara otomatis.

### Web Dashboard (PWA)
- Peta interaktif **Leaflet.js + OpenStreetMap** dengan marker lokasi terakhir dan jalur perjalanan.
- **Auto-refresh** posisi serta histori lokasi berdasarkan **filter tanggal**.
- **Statistik** jumlah titik lokasi dan estimasi jarak tempuh per hari.
- Mode terang/gelap, dapat di-*install* sebagai **PWA** (service worker + manifest).

## 🏗️ Arsitektur

```
┌─────────────────────────────────────┐
│  TONGKAT (ESP32)                    │
│  GPS Neo-6M · HC-SR04 · TCS34725    │
│  Buzzer · Vibrator · Potensiometer  │
└──────────────┬──────────────────────┘
               │ HTTP POST (WiFi)
               ▼
┌──────────────────────┐      ┌──────────┐
│  save_location.php   │ ───► │  MySQL   │
└──────────────────────┘      └────┬─────┘
                                   │ AJAX
               ┌───────────────────┴──────────┐
               │  index.html + Leaflet.js     │
               │  (get_locations.php)         │
               └──────────────────────────────┘
```

## 🔌 Komponen & Wiring

| Komponen | Pin ESP32 | Keterangan |
|---|---|---|
| GPS Neo-6M VCC | VIN | Daya 5V |
| GPS Neo-6M GND | GND | Ground bersama |
| GPS Neo-6M TX | GPIO16 (RX2) | Data GPS → ESP32 |
| GPS Neo-6M RX | GPIO17 (TX2) | Opsional |
| Tombol reset WiFi | GPIO15 – GND | Reset konfigurasi WiFiManager saat boot |
| HC-SR04 TRIG | GPIO5 | Trigger ultrasonik |
| HC-SR04 ECHO | GPIO18 | Echo ultrasonik |
| TCS34725 | I2C (SDA/SCL default) | Sensor warna jalur kuning |
| Buzzer | GPIO19 | Alarm halangan |
| Motor vibrator | GPIO25 | Getaran saat keluar jalur |
| Potensiometer | GPIO34 (ADC) | Pengatur jarak ambang |

## ⚙️ Instalasi Firmware

1. Siapkan **Arduino IDE** + dukungan board ESP32 (tambahkan *Boards Manager URL* ESP32 di Preferences).
2. Install library via Library Manager: **TinyGPS++**, **WiFiManager**, **Adafruit TCS34725**, **ArduinoJson**.
3. Buka `firmware/smart_blind_cane.ino` (letakkan di folder bernama `smart_blind_cane` agar dikenali Arduino IDE).
4. Ganti placeholder `GANTI_DENGAN_GEOAPIFY_API_KEY` dengan API key Anda (daftar gratis di [geoapify.com](https://www.geoapify.com/)).
5. Upload ke ESP32, lalu hubungkan ke WiFi lewat hotspot konfigurasi **"GPS-Tracker-Setup"** (password default: `12345678` — disarankan diganti).

## 🌐 Instalasi Web Dashboard

1. Install **XAMPP/LAMPP** (PHP 7+ dan MySQL).
2. Salin seluruh isi folder `web/` ke direktori server, misal `htdocs/blind-cane`.
3. Buat database dan tabel (sesuaikan bila struktur database produksi Anda berbeda):

   ```sql
   CREATE DATABASE gps_tracker;
   USE gps_tracker;
   CREATE TABLE locations (
     id INT AUTO_INCREMENT PRIMARY KEY,
     latitude DOUBLE NOT NULL,
     longitude DOUBLE NOT NULL,
     city VARCHAR(100) DEFAULT 'Unknown',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. Salin `db_config.example.php` menjadi `db_config.php`, lalu isi kredensial database Anda.
5. Akses dashboard di `http://localhost/blind-cane`.

## 📁 Struktur Repository

```
smart-blind-cane-tracker/
├── firmware/
│   └── smart_blind_cane.ino    # Firmware ESP32 (GPS + ultrasonik + sensor warna)
├── web/                        # Dashboard PWA (PHP + Leaflet.js)
│   ├── index.html              # Halaman utama dashboard
│   ├── script.js               # Logika peta, AJAX, reverse geocoding
│   ├── style.css               # Styling (light/dark mode)
│   ├── save_location.php       # Endpoint POST lokasi dari ESP32
│   ├── get_locations.php       # Endpoint pengambilan histori lokasi
│   ├── db_config.example.php   # Contoh konfigurasi database
│   ├── manifest.json / service-worker.js / icons
│   └── assets/
├── docs/
│   └── LAPORAN-PROTOTIPE-GPS-WEB-TRACKING.pdf   # Laporan lengkap Tugas Akhir
└── LICENSE
```

## 🧪 Hasil Pengujian (Ringkasan)

Pengujian lapangan dilakukan di **2 wilayah administratif** Kota Bandar Lampung:

| Aspek | SLB-A Bina Insani | Kantor Kelurahan & Lapangan Way Dadi |
|---|---|---|
| Akurasi GPS | Stabil (15–26 m) | Stabil (17–19 m) |
| Reverse geocoding | Konsisten "Bandar Lampung" | Konsisten "Bandar Lampung" |
| Keutuhan data | Tidak ada kehilangan data | Tidak ada kehilangan data |
| Tampilan web | Real-time & histori normal | Real-time & histori normal |

Detail lengkap pengujian, skematik, dan flowchart tersedia di [`docs/LAPORAN-PROTOTIPE-GPS-WEB-TRACKING.pdf`](docs/LAPORAN-PROTOTIPE-GPS-WEB-TRACKING.pdf).

## 📸 Dokumentasi Visual

Screenshot yang disarankan untuk melengkapi README ini (letakkan di `docs/screenshots/` lalu sisipkan di bagian ini):
- `dashboard.png` — tampilan peta dashboard web
- `perangkat.jpg` — foto prototipe tongkat

## 🔐 Catatan Keamanan

- API key Geoapify **dibersihkan** dari kode sebelum dipublikasikan — gunakan key milik Anda sendiri.
- `db_config.php` berisi kredensial asli **tidak ikut** di-commit (masuk `.gitignore`); hanya contoh (`db_config.example.php`) yang dibagikan.
- Bila sebelumnya pernah mempublikasikan kredensial, **rotasi** password database dan API key lama.

## 🗺️ Roadmap

- Panic button + notifikasi geofence (zona aman).
- Dukungan jaringan GSM (SIM800L) untuk area tanpa WiFi.
- Login berbasis peran (guru / orang tua / admin).
- Pengujian jangka panjang bersama mitra.

## 📄 Lisensi

Dirilis di bawah [Lisensi MIT](LICENSE).
