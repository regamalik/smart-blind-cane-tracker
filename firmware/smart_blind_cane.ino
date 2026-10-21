// === LIBRARIES ===
#include <TinyGPS++.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "Adafruit_TCS34725.h"

#define RXD2 16              // Pin RX untuk Serial2, biasanya untuk GPS module
#define TXD2 17              // Pin TX untuk Serial2, biasanya untuk GPS module
#define RESET_BUTTON_PIN 15  // Tombol reset (mungkin untuk reset WiFiManager atau fungsi lain)
#define LED_PIN 2            // LED indikator, biasanya LED bawaan di ESP32
#define BUZZER_PIN 19        // Buzzer untuk suara/alert
#define TRIG_PIN 5           // Pin TRIG untuk sensor ultrasonik HC-SR04
#define ECHO_PIN 18          // Pin ECHO untuk sensor ultrasonik HC-SR04
#define POT_PIN 34           // Pin input analog untuk potensiometer
#define VIBRATOR_PIN 25      // Pin output untuk motor vibrator


// === OBJECTS ===
TinyGPSPlus gps;
WiFiManager wm;
Adafruit_TCS34725 tcs = Adafruit_TCS34725(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);

// === GLOBAL VARIABLES ===
const char* apiKey = "GANTI_DENGAN_GEOAPIFY_API_KEY";
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 10000;
bool alreadyReset = false;
unsigned long lastReconnectAttempt = 0;

bool sedangGetar = false;
bool sebelumnyaKuning = false;
unsigned long vibratorStartTime = 0;
const unsigned long durasiVibrator = 300;

bool tcsAvailable = false;
const int bufferSize = 3;  // Ukuran buffer lebih kecil agar responsif
uint16_t rBuffer[bufferSize], gBuffer[bufferSize], bBuffer[bufferSize], cBuffer[bufferSize];
int bufferIndex = 0;


bool isWarnaKuning(uint16_t r, uint16_t g, uint16_t b, uint16_t c) {
  if (c < 10 || c > 40000) return false;

  // Periksa apakah r dan g tinggi, dan b lebih rendah dari keduanya
  if (r >= 60 && g >= 60 && b <= 55) {
    // Tambahan: pastikan selisih R dan G tidak terlalu besar
    int16_t selisihRG = abs((int)r - (int)g);
    if (selisihRG <= 10) {
      return true;
    }
  }

  return false;
}


// === Fungsi Rata-rata ===
uint16_t average(uint16_t* buffer) {
  uint32_t sum = 0;
  for (int i = 0; i < bufferSize; i++) {
    sum += buffer[i];
  }
  return sum / bufferSize;
}


// === SETUP ===
void setup() {
  delay(2000);
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);

  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(VIBRATOR_PIN, OUTPUT);

  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(VIBRATOR_PIN, LOW);

  // === CEK TOMBOL RESET SAAT BOOT ===
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    Serial.println("Tombol ditekan saat boot. Reset WiFi config...");
    wm.resetSettings();
    delay(1000);
    ESP.restart();
  }

  // === WIFI SETUP ===
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  wm.setConnectTimeout(10); // jangan terlalu lama tunggu konek WiFi

  bool res = wm.autoConnect("GPS-Tracker-Setup", "12345678");

  if (!res) {
    Serial.println("WiFi gagal konek. Reset konfigurasi dan mulai ulang.");
    wm.resetSettings();
    delay(1000);
    ESP.restart();
  } else {
    Serial.print("WiFi TERHUBUNG ke: ");
    Serial.println(WiFi.SSID());
    digitalWrite(LED_PIN, HIGH);
  }

  // === SENSOR WARNA ===
  if (tcs.begin()) {
  tcsAvailable = true;
  Serial.println("Sensor warna siap.");

  // ISI BUFFER DI AWAL DENGAN DATA AKTUAL
  for (int i = 0; i < bufferSize; i++) {
    uint16_t r, g, b, c;
    tcs.getRawData(&r, &g, &b, &c);
    rBuffer[i] = r;
    gBuffer[i] = g;
    bBuffer[i] = b;
    cBuffer[i] = c;
    delay(10);  // beri waktu antar-sampling
  }
} else {
  Serial.println("Sensor warna tidak ditemukan!");
}

  Serial.println("Sistem siap (GPS mungkin tunggu WiFi)...");
}

// === LOOP ===
void loop() {
  checkResetButton();    // <- WAJIB, agar reset bisa kapan saja
  handleWiFi();          // tetap pantau WiFi
  updateGPS();
  handleColorSensor();
  handleUltrasonic();
  sendGPSData();
}

// === RESET BUTTON ===
void checkResetButton() {
  if (digitalRead(RESET_BUTTON_PIN) == LOW && !alreadyReset) {
    Serial.println("Tombol reset ditekan. Reset WiFi config...");
    wm.resetSettings();
    alreadyReset = true;
    delay(1000);
    ESP.restart();
  }
}

// === WIFI HANDLER ===
void handleWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastReconnectAttempt > 5000) {
      Serial.println("WiFi terputus. Mencoba konek ulang...");
      WiFi.begin();
      lastReconnectAttempt = now;
    }
    digitalWrite(LED_PIN, LOW);
  } else {
    digitalWrite(LED_PIN, HIGH);
  }
}

// === GPS UPDATE ===
void updateGPS() {
  while (Serial2.available() > 0) {
    gps.encode(Serial2.read());
  }
}

// === GPS DATA SENDER ===
void sendGPSData() {
  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();

    // Pastikan lokasi valid dari GPS
    if (!gps.location.isValid()) {
      Serial.println("GPS belum mendapatkan lokasi yang valid.");
      return;
    }

    double lat = gps.location.lat();
    double lng = gps.location.lng();

    // Dapatkan nama kota, bisa "Tidak diketahui" jika gagal
    String city = getCityFromCoordinates(lat, lng);
    if (city == "") city = "Tidak diketahui";

    Serial.println("Latitude: " + String(lat, 6));
    Serial.println("Longitude: " + String(lng, 6));
    Serial.println("City: " + city);

    if (WiFi.status() == WL_CONNECTED) {
      WiFiClientSecure client;
      client.setInsecure(); // Aman untuk uji coba, gunakan sertifikat di produksi
      HTTPClient http;

      String postData = "latitude=" + String(lat, 6) +
                        "&longitude=" + String(lng, 6) +
                        "&city=" + city;

      http.begin(client, "https://teknoblindcane.my.id/save_location.php");
      http.addHeader("Content-Type", "application/x-www-form-urlencoded");
      http.setTimeout(5000); // 5 detik timeout

      int code = http.POST(postData);

      Serial.println("HTTP Response Code: " + String(code));
      Serial.println("Response: " + http.getString());

      http.end();
    } else {
      Serial.println("WiFi tidak terhubung.");
    }
  }
}

// === GEOAPIFY LOOKUP ===
String getCityFromCoordinates(double lat, double lng) {
  if (WiFi.status() != WL_CONNECTED) return "Tidak diketahui";

  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();

  String url = "https://api.geoapify.com/v1/geocode/reverse?lat=" + String(lat, 6) +
               "&lon=" + String(lng, 6) +
               "&apiKey=" + apiKey;

  http.begin(client, url);
  http.setTimeout(5000); // Hindari nge-freeze
  int httpCode = http.GET();

  if (httpCode != 200) {
    http.end();
    return "Tidak diketahui";
  }

  String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(8192);
  DeserializationError error = deserializeJson(doc, payload);
  if (error) return "Tidak diketahui";

  if (!doc["features"] || doc["features"].size() == 0) return "Tidak diketahui";

  JsonObject props = doc["features"][0]["properties"];
  const char* label = props["city"] | props["town"] | props["village"] |
                      props["municipality"] | props["county"] | props["state"];

  return label ? String(label) : "Tidak diketahui";
}

// === Fungsi Utama Deteksi Warna ===
void handleColorSensor() {
  if (!tcsAvailable) return;

  uint16_t r, g, b, c;
  tcs.getRawData(&r, &g, &b, &c);

  rBuffer[bufferIndex] = r;
  gBuffer[bufferIndex] = g;
  bBuffer[bufferIndex] = b;
  cBuffer[bufferIndex] = c;
  bufferIndex = (bufferIndex + 1) % bufferSize;

  uint16_t rAvg = average(rBuffer);
  uint16_t gAvg = average(gBuffer);
  uint16_t bAvg = average(bBuffer);
  uint16_t cAvg = average(cBuffer);

  Serial.print("R: "); Serial.print(rAvg);
  Serial.print(" G: "); Serial.print(gAvg);
  Serial.print(" B: "); Serial.print(bAvg);
  Serial.print(" C: "); Serial.println(cAvg);

  if (isWarnaKuning(rAvg, gAvg, bAvg, cAvg)) {
    digitalWrite(VIBRATOR_PIN, LOW);
  } else {
    digitalWrite(VIBRATOR_PIN, HIGH);
  }
}

// === ULTRASONIC SENSOR (VERSI LANCAR) ===
void handleUltrasonic() {
  static unsigned long lastUltrasonicTime = 0;
  const unsigned long ultrasonicInterval = 100; // tiap 100 ms

  if (millis() - lastUltrasonicTime < ultrasonicInterval) return;
  lastUltrasonicTime = millis();

  int potValue = analogRead(POT_PIN);
  float threshold_cm = map(potValue, 0, 4095, 5, 100);

  // Trigger sensor
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Baca pantulan (timeout 20 ms untuk hindari macet)
  long duration = pulseIn(ECHO_PIN, HIGH, 20000); // 20ms max = ±340cm
  float distance_cm = duration * 0.0343 / 2;

  // Validasi hasil
  if (duration > 0 && distance_cm > 0 && distance_cm < threshold_cm) {
    digitalWrite(BUZZER_PIN, HIGH);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  // Cetak ke serial (opsional, bisa dihapus untuk performa maksimal)
  Serial.print("Jarak: ");
  Serial.print(distance_cm);
  Serial.print(" cm | Threshold: ");
  Serial.println(threshold_cm);
}
