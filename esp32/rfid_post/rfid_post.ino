#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

// Fill these
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* API_BASE = "http://YOUR_PC_IP:8000"; // e.g. http://192.168.1.10:8000
const char* DEVICE_ID = "esp32-rfid-1";

// RC522 Pins (SDA, SCK, MOSI, MISO, RST) — adjust to your wiring
#define SS_PIN 5
#define RST_PIN 27
MFRC522 rfid(SS_PIN, RST_PIN);

String uidToHex(MFRC522::Uid *uid) {
  String hex = "";
  for (byte i = 0; i < uid->size; i++) {
    if (uid->uidByte[i] < 0x10) hex += "0";
    hex += String(uid->uidByte[i], HEX);
  }
  hex.toLowerCase();
  return hex;
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" connected");

  SPI.begin();
  rfid.PCD_Init();
}

unsigned long lastPostMs = 0;

void loop() {
  if ( ! rfid.PICC_IsNewCardPresent() || ! rfid.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  String uid = uidToHex(&rfid.uid);
  Serial.print("Card UID: ");
  Serial.println(uid);

  // Debounce posts slightly
  if (millis() - lastPostMs < 500) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  lastPostMs = millis();

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(API_BASE) + "/api/scans";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String payload = String("{\"uid\":\"") + uid + "\",\"device_id\":\"" + DEVICE_ID + "\"}";
    int code = http.POST(payload);
    Serial.printf("POST %s -> %d\n", url.c_str(), code);
    String resp = http.getString();
    Serial.println(resp);
    http.end();
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}


