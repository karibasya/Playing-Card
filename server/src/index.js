import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { connectMongo, Card } from './db.js';

dotenv.config();
const PORT = process.env.PORT || 4000;

async function getOrCreateCard(cardId) {
  let card = await Card.findById(cardId).exec();
  if (!card) {
    card = await Card.create({ _id: cardId, balance: 0, status: 'active' });
  }
  return card;
}

function pushHistory(cardDoc, entry) {
  const enriched = { title: entry.title, meta: new Date().toISOString(), amount: entry.amount ?? '' };
  cardDoc.history.unshift(enriched);
  if (cardDoc.history.length > 50) cardDoc.history = cardDoc.history.slice(0, 50);
  return enriched;
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Create a new card with optional player and initial balance
app.post('/cards', async (req, res) => {
  const { cardId, player, balance } = req.body || {};
  if (!cardId || typeof cardId !== 'string') return res.status(400).json({ message: 'cardId required' });
  const existing = await Card.findById(cardId).exec();
  if (existing) return res.status(409).json({ message: 'Card already exists', card: existing.toPublic() });
  const card = new Card({ _id: cardId, balance: Number(balance) || 0, status: 'active', player: {
    name: player?.name || '',
    phone: player?.phone || '',
    notes: player?.notes || '',
  }, history: [] });
  const historyItem = pushHistory(card, { title: 'Card created', amount: '' });
  if (player?.name) pushHistory(card, { title: 'Player created', amount: '' });
  await card.save();
  broadcast({ type: 'update', data: { card: card.toPublic(), historyItem } });
  res.status(201).json(card.toPublic());
});

app.get('/cards/:cardId', async (req, res) => {
  const card = await getOrCreateCard(req.params.cardId);
  res.json(card.toPublic());
});

app.get('/cards/:cardId/history', async (req, res) => {
  const card = await getOrCreateCard(req.params.cardId);
  res.json(card.history);
});

app.post('/cards/:cardId/recharge', async (req, res) => {
  const { amount } = req.body || {};
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: 'Invalid amount' });
  const card = await getOrCreateCard(req.params.cardId);
  card.balance += value;
  const historyItem = pushHistory(card, { title: 'Recharge', amount: `+₹ ${value}` });
  await card.save();
  broadcast({ type: 'update', data: { card: card.toPublic(), historyItem } });
  res.json(card.toPublic());
});

app.post('/cards/:cardId/deduct', async (req, res) => {
  const { amount } = req.body || {};
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ message: 'Invalid amount' });
  const card = await getOrCreateCard(req.params.cardId);
  if (card.balance - value < 0) return res.status(400).json({ message: 'Insufficient balance' });
  card.balance -= value;
  const historyItem = pushHistory(card, { title: 'Deduct', amount: `-₹ ${value}` });
  await card.save();
  broadcast({ type: 'update', data: { card: card.toPublic(), historyItem } });
  res.json(card.toPublic());
});

app.put('/cards/:cardId/player', async (req, res) => {
  const { name, phone, notes } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ message: 'Name required' });
  const card = await getOrCreateCard(req.params.cardId);
  card.player = { name, phone: phone || '', notes: notes || '' };
  const historyItem = pushHistory(card, { title: 'Player updated', amount: '' });
  await card.save();
  broadcast({ type: 'update', data: { card: card.toPublic(), historyItem } });
  res.json(card.toPublic());
});

// Endpoint for ESP32 to push scans via HTTP
app.post('/esp/scan', async (req, res) => {
  const { cardId } = req.body || {};
  if (!cardId) return res.status(400).json({ message: 'cardId required' });
  await getOrCreateCard(cardId);
  const payload = { type: 'scan', data: { cardId } };
  broadcast(payload);
  res.json({ ok: true });
});

const server = http.createServer(app);

// Plain WebSocket server at /ws
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(String(msg));
      if (data && data.type === 'scan' && data.data?.cardId) {
        await getOrCreateCard(data.data.cardId);
        broadcast({ type: 'scan', data: { cardId: data.data.cardId } });
      }
    } catch (_) {}
  });
});

function broadcast(obj) {
  const json = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(json);
    }
  }
}

async function start() {
  const uri = process.env.MONGODB_URI;
  await connectMongo(uri);
  server.listen(PORT, () => {
    console.log(`PlayCard backend listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


