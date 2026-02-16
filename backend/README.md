# Pet Feeder Backend

Node.js/Express backend for the IoT Pet Feeder system.

## Stack

- Node.js / Express
- MariaDB
- Mosquitto MQTT
- JWT Authentication

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=petfeeder

MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=your_mqtt_user
MQTT_PASSWORD=your_mqtt_password

JWT_SECRET=your_secret_key
PORT=3000
```

3. Start the server:
```bash
node server.js
```

The database tables are created automatically on startup.

## API Endpoints

All endpoints except auth require `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | `{ username, password }` |
| POST | `/api/auth/login` | Login | `{ username, password }` |

### Devices

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/devices` | List user's devices | - |
| POST | `/api/devices/register` | Register/link device | `{ device_id }` |
| PUT | `/api/devices/:device_id/rename` | Rename device | `{ name }` |
| DELETE | `/api/devices/:device_id` | Unlink device | - |

### Cats

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/cats` | Create cat | `{ device_id, rfid_tag, name }` |
| GET | `/api/cats/device/:device_id` | List cats for device | - |
| PUT | `/api/cats/:rfid/rename` | Rename cat | `{ name }` |
| DELETE | `/api/cats/:rfid` | Delete cat | - |

### Schedules

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/schedules/device/:device_id` | Get schedules | - |
| PUT | `/api/schedules/device/:device_id` | Set schedules | `{ schedules: [{ hour, minute, amount }] }` |

### Events

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/events/device/:device_id` | Get event history | `limit`, `offset` |

## MQTT Topics

### Commands (App → Device)
Topic: `petfeeder/{device_id}/command`
```json
{ "type": "feed", "amount": 50 }
{ "type": "schedule", "schedules": [...] }
```

### Events (Device → App/Backend)
Topic: `petfeeder/{device_id}/event`
```json
{ "type": "dispense_status", "amount": 50, "success": true }
{ "type": "schedule_saved" }
{ "type": "cat_identified", "rfid_tag": "ABC123", "name": "Whiskers" }
{ "type": "unknown_rfid", "rfid_tag": "XYZ789" }
{ "type": "cat_came"}
{ "type": "cat_left"}
{ "type": "tank_level", "percent": 75 }
{ "type": "food_eaten", "amount": 10}
```

## Project Structure
```
backend/
├── db/
│   ├── database.js    # Database functions
│   └── schema.sql     # Table definitions
├── middleware/
│   └── auth.js        # JWT verification
├── mqtt/
│   └── client.js      # MQTT client for logging events
├── routes/
│   ├── auth.js        # Login/register
│   ├── devices.js     # Device management
│   ├── cats.js        # Cat management
│   ├── schedules.js   # Schedule management
│   └── events.js      # Event history
├── .env               # Configuration (not in git)
├── package.json
└── server.js          # Main app
```