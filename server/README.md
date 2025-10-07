# PlayCard Backend (Express + ws)

Minimal backend to pair with the PlayCard frontend.

## Features
- REST routes used by the frontend
- WebSocket endpoint at `/ws` for live scan updates
- In-memory store for cards and history (swap with DB later)

## Install
```bash
cd server
npm install
```

## Configure
- Copy environment example and edit values:
```bash
copy .env.example .env   # Windows PowerShell: cp .env.example .env
```
- Set `MONGODB_URI` to your Mongo connection string.

## Run (development)
```bash
npm run dev
```

Server starts at `http://localhost:4000`. WS at `ws://localhost:4000/ws`.

## Routes
- GET `/health`
- GET `/cards/:cardId`
- GET `/cards/:cardId/history`
- POST `/cards/:cardId/recharge` { amount }
- PUT `/cards/:cardId/player` { name, phone, notes }
- POST `/esp/scan` { cardId }  (from ESP32)
- GET `/admin/search?type={id|name|phone}&query={searchTerm}` (Admin search)

## Test quickly
```bash
curl http://localhost:4000/health
curl http://localhost:4000/cards/ABC123
curl -X POST http://localhost:4000/esp/scan -H "Content-Type: application/json" -d '{"cardId":"ABC123"}'
```

## Next steps
- Replace in-memory store with MySQL/Postgres (Prisma) or MongoDB
- Add auth & rate limiting
- Persist history and add pagination
- Validate payloads (zod/joi) and add error handling middleware
