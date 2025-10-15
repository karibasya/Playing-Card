#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// Fill these - UPDATE API_BASE with your computer's IP address
const char* WIFI_SSID = "Niru";
const char* WIFI_PASS = "niru@1234";

// Backup hotspot for testing
const char* HOTSPOT_SSID = "YourPhoneHotspot";
const char* HOTSPOT_PASS = "hotspot123";
const char* API_BASE = "http://10.95.158.49:4000"; // Your computer's IP
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
  delay(1000);
  
  Serial.println("=== ESP32 PlayCard System ===");
  Serial.println("Initializing RFID and WiFi...");
  
  // WiFi diagnostics
  Serial.println("WiFi Mode: Setting to STA");
  WiFi.mode(WIFI_STA);
  delay(100);
  
  Serial.print("WiFi Status: ");
  Serial.println(WiFi.status());
  
  // Check if WiFi is properly initialized
  if (WiFi.getMode() != WIFI_STA) {
    Serial.println("ERROR: WiFi mode not set correctly!");
    while(true) delay(1000);
  }
  
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  // Add timeout for WiFi connection (30 seconds)
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength: ");
    Serial.println(WiFi.RSSI());
    Serial.println("Ready to scan cards");
  } else {
    Serial.println(" FAILED!");
    Serial.println("WiFi connection failed. Check credentials.");
    Serial.println("Continuing in offline mode...");
  }

  SPI.begin();
  rfid.PCD_Init();
  Serial.println("RFID initialized - ready to scan cards");
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
    // Step 1: Send scan event to backend
    HTTPClient http;
    String scanUrl = String(API_BASE) + "/esp/scan";
    http.begin(scanUrl);
    http.addHeader("Content-Type", "application/json");
    String payload = String("{\"cardId\":\"") + uid + "\"}";
    int code = http.POST(payload);
    Serial.printf("POST %s -> %d\n", scanUrl.c_str(), code);
    http.end();
    
    // Step 2: Fetch card details
    String cardUrl = String(API_BASE) + "/cards/" + uid;
    http.begin(cardUrl);
    int getCode = http.GET();
    
    if (getCode == 200) {
      String response = http.getString();
      Serial.println("Card details: " + response);
      
      // Parse JSON
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, response);
      
      Serial.print("JSON Parse result: ");
      Serial.println(error.c_str());
      
      if (!error) {
        String cardId = doc["id"] | uid;
        String playerName = doc["player"]["name"] | "Unknown";
        String playerPhone = doc["player"]["phone"] | "";
        int balance = doc["balance"] | 0;
        
        Serial.println("=== Card Details ===");
        Serial.println("Name: " + playerName);
        Serial.println("Phone: " + playerPhone);
        Serial.println("Balance: Rs." + String(balance));
        Serial.printf("Player: %s, Phone: %s, Balance: %d\n", playerName.c_str(), playerPhone.c_str(), balance);
      } else {
        Serial.println("JSON parsing failed!");
      }
    } else {
      Serial.println("Server error - could not fetch card details");
    }
    http.end();
  } else {
    // Offline mode - just show card UID
    Serial.println("OFFLINE MODE - WiFi not connected");
    Serial.println("Card UID: " + uid);
    
    // Try to reconnect WiFi occasionally
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 30000) { // Try every 30 seconds
      lastReconnectAttempt = millis();
      Serial.println("Attempting WiFi reconnection...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
      
      // Quick connection attempt (5 seconds)
      int quickAttempts = 0;
      while (WiFi.status() != WL_CONNECTED && quickAttempts < 10) {
        delay(500);
        quickAttempts++;
      }
      
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("WiFi reconnected!");
      }
    }
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  
  Serial.println("---"); // Separator for next scan
}


