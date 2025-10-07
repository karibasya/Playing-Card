#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// Fill these - UPDATE API_BASE with your computer's IP address
const char* WIFI_SSID = "vivoY33t";
const char* WIFI_PASS = "saiiiiiii";
const char* API_BASE = "http://10.153.217.39:4000"; // Your computer's IP
const char* DEVICE_ID = "esp32-rfid-1";

// RC522 Pins (SDA, SCK, MOSI, MISO, RST) — adjust to your wiring
#define SS_PIN 5
#define RST_PIN 27
MFRC522 rfid(SS_PIN, RST_PIN);

// LCD I2C (address 0x27 for 16x2, change to 0x3F if needed)
LiquidCrystal_I2C lcd(0x27, 16, 2);

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
  
  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("PlayCard System");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" connected");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected!");
  lcd.setCursor(0, 1);
  lcd.print("Ready to scan");
  delay(1500);

  SPI.begin();
  rfid.PCD_Init();
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scan Your Card");
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
      
      if (!error) {
        String cardId = doc["id"] | uid;
        String playerName = doc["player"]["name"] | "Unknown";
        int balance = doc["balance"] | 0;
        
        // Display on LCD
        lcd.clear();
        lcd.setCursor(0, 0);
        if (playerName != "Unknown" && playerName != "") {
          lcd.print(playerName.substring(0, 16)); // Max 16 chars
        } else {
          lcd.print("ID:" + cardId.substring(0, 13));
        }
        lcd.setCursor(0, 1);
        lcd.print("Bal: Rs." + String(balance));
        
        Serial.printf("Player: %s, Balance: %d\n", playerName.c_str(), balance);
      } else {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Parse Error");
      }
    } else {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Card: " + uid.substring(0, 11));
      lcd.setCursor(0, 1);
      lcd.print("Fetch Failed");
    }
    http.end();
    
    delay(3000); // Show details for 3 seconds
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Scan Your Card");
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}


