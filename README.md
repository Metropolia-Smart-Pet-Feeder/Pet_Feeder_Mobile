# Pet Feeder Mobile

Mobile app + backend for a smart IoT pet feeder. The app communicates with the device over MQTT (real-time commands/events) and with the backend over HTTP REST (data persistence).

---

## Project Structure

```
Pet_Feeder_Mobile/
├── app/          # React Native / Expo mobile frontend
└── backend/      # Node.js / Express API server
```

---

## Backend

### Prerequisites

- Node.js 18+
- MySQL / MariaDB running locally
- Mosquitto MQTT broker running locally

### Setup

```bash
cd backend
npm install
```

Create a `.env` file (see `.env.example` if available — do not commit real credentials):

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=petfeeder_admin
DB_PASSWORD=your_password
DB_NAME=petfeeder
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=petfeeder_admin
MQTT_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

Initialize the database schema:

```bash
mysql -u petfeeder_admin -p petfeeder < db/schema.sql
```

### Running

```bash
node server.js
```

Or with PM2 for production:

```bash
pm2 start server.js --name petfeeder-backend
pm2 save
```

> **Note:** If you restart the server, make sure no old processes are still running. Use `pm2 list` or `ps aux | grep node` to check. Multiple running instances will cause duplicate events.

### API Endpoints

Base URL: `http://<server-ip>:3000/api`

All endpoints except `/auth/*` and `/photos/upload/*` require a Bearer token:
```
Authorization: Bearer <jwt_token>
```

#### Auth
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | `{ username, password }` | Create account |
| POST | `/auth/login` | `{ username, password }` | Returns JWT token |

#### Devices
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/devices` | — | List user's devices |
| POST | `/devices/register` | `{ device_id }` | Link device to account |
| PUT | `/devices/:device_id/rename` | `{ name }` | Rename device |
| DELETE | `/devices/:device_id` | — | Unlink device |

#### Cats
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/cats/device/:device_id` | — | List cats for device |
| POST | `/cats` | `{ device_id, rfid, name }` | Register cat |
| PUT | `/cats/:rfid/rename` | `{ device_id, name }` | Rename cat |
| DELETE | `/cats/:rfid` | `{ device_id }` | Remove cat |

#### Schedules
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/schedules/device/:device_id` | — | Get feeding schedules |
| PUT | `/schedules/device/:device_id` | `{ schedules: [{ hour, minute, amount }] }` | Update schedules |

#### Events
| Method | Path | Query | Description |
|--------|------|-------|-------------|
| GET | `/events/device/:device_id` | `limit`, `offset` | Get event history |

#### Photos
| Method | Path | Description |
|--------|------|-------------|
| POST | `/photos/upload/:device_id` | Upload photo (no auth, used by device) |
| GET | `/photos/device/:device_id` | List photos |
| GET | `/photos/device/:device_id/:photo_id` | Download photo (`?token=` accepted) |

#### Health
```
GET /health  →  { "status": "ok" }
```

### Testing the Backend

Use `curl` or any REST client (Insomnia, Postman).

**Login and get token:**
```bash
curl -X POST http://104.168.122.188:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "youruser", "password": "yourpass"}'
```

**List devices (with token):**
```bash
curl http://104.168.122.188:3000/api/devices \
  -H "Authorization: Bearer <token>"
```

**Simulate an MQTT event (see MQTT section below):**
```bash
mqttx pub -h 104.168.122.188 -p 1883 \
  -u petfeeder_admin -P admin \
  -t "petfeeder/<device_id>/event" \
  -m '{"type":"tank_level","level":80}'
```

---

## Frontend (Mobile App)

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- For Android: Android Studio with an emulator, or a physical Android device with USB debugging enabled
- For iOS: Xcode (macOS only)
- Expo Go app on your phone (for development)

### Setup

```bash
cd app
npm install
```

**Update the server IP** if your backend is running on a different address. Change the hardcoded values in:

- [app/services/api.ts](app/services/api.ts) — `API_URL`
- [app/services/mqtt.ts](app/services/mqtt.ts) — broker URL

### Running in Development

```bash
cd app
npx expo start
```

This opens the Expo dev server. You can then:

- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator
- Scan the QR code with the **Expo Go** app on your phone (must be on the same Wi-Fi network as your dev machine, or use tunnel mode)
- Press `r` to reload the app after code changes

### Building for Production

**Android APK / AAB (via EAS):**
```bash
npm install -g eas-cli
eas build --platform android
```

**Local Android build (requires Android Studio):**
```bash
npx expo prebuild        # generates the android/ folder
npx expo run:android     # builds and installs on connected device/emulator
```

> The `android/` and `ios/` folders are in `.gitignore` — they are generated by `expo prebuild` and should not be committed.

### Running on a Physical Device

1. Enable **Developer Options** and **USB Debugging** on your Android phone
2. Connect via USB
3. Run `npx expo run:android` — it will detect the device and install the app
4. Or use **Expo Go**: run `npx expo start` and scan the QR code

---

## MQTT

### Broker Details

| Setting | Value |
|---------|-------|
| Host | `104.168.122.188` |
| TCP Port | `1883` (backend/device) |
| WebSocket Port | `9001` (frontend app) |
| Username | `petfeeder_admin` |
| Password | `admin` |

### Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `petfeeder/{device_id}/event` | Device → Backend/App | Device publishes events |
| `petfeeder/{device_id}/command` | App → Device | App sends commands |

### Event Messages (Device → Backend)

All payloads are JSON on topic `petfeeder/{device_id}/event`.

**Food dispensed:**
```json
{ "type": "dispense", "amount": 50 }
```

**Tank level update:**
```json
{ "type": "tank_level", "level": 75 }
```

**Cat detected by RFID:**
```json
{ "type": "cat_identified", "rfid": "ABC123" }
```
> The backend resolves the RFID to a cat name before storing the event.

**Cat arrived at feeder:**
```json
{ "type": "cat_came" }
```

**Cat left feeder:**
```json
{ "type": "cat_leave" }
```

**Food consumed by cat:**
```json
{ "type": "food_eaten", "amount": 15 }
```

**Schedule confirmed saved on device:**
```json
{ "type": "schedule_saved" }
```

### Command Messages (App → Device)

All payloads are JSON on topic `petfeeder/{device_id}/command`.

**Trigger manual feed:**
```json
{ "type": "feed", "amount": 50 }
```

**Update feeding schedule:**
```json
{
  "type": "schedule",
  "schedules": [
    { "hour": 8, "minute": 0, "amount": 30 },
    { "hour": 18, "minute": 30, "amount": 30 }
  ]
}
```

### Testing MQTT with MQTTx CLI

Install: `npm install -g mqttx-cli`

**Publish an event (simulate device):**
```bash
mqttx pub -h 104.168.122.188 -p 1883 \
  -u petfeeder_admin -P admin \
  -t "petfeeder/<device_id>/event" \
  -m '{"type":"tank_level","level":60}'
```

**Subscribe to all device events (monitor mode):**
```bash
mqttx sub -h 104.168.122.188 -p 1883 \
  -u petfeeder_admin -P admin \
  -t "petfeeder/+/event"
```

**Subscribe to commands sent by the app:**
```bash
mqttx sub -h 104.168.122.188 -p 1883 \
  -u petfeeder_admin -P admin \
  -t "petfeeder/<device_id>/command"
```

---

## Device Provisioning (BLE)

New devices are provisioned via Bluetooth Low Energy:

1. Open the app → Devices → Add Device
2. The app scans for BLE devices advertising the pet feeder service
3. Once connected, the app sends WiFi credentials (SSID + password) to the device
4. The device connects to WiFi and starts communicating over MQTT

**BLE UUIDs:**

| | UUID |
|-|------|
| Service | `4fafc201-1fb5-459e-8fcc-c5c9c331914b` |
| Characteristic | `beb5483e-36e1-4688-b7f5-ea07361b26a8` |

---

## Architecture Overview

```
[ESP Device]
     │
     ├─── BLE ──────────────────► [Mobile App]
     │                                  │
     └─── MQTT (TCP 1883) ──────► [MQTT Broker] ◄── MQTT (WS 9001) ──┘
                                        │
                                  [Backend Server]
                                        │
                                   [MySQL DB]
```

- The **device** publishes events to MQTT and subscribes to commands
- The **backend** subscribes to MQTT events and persists them to the database
- The **app** subscribes to MQTT events for real-time UI updates and uses the REST API for persistent data (history, schedules, cats)
