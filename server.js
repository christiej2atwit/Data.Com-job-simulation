const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Hardcoded user list (replace or integrate with real user service)
const users = [
  { id: 'u1', name: 'Alice Johnson', role: 'Engineer' },
  { id: 'u2', name: 'Bob Lee', role: 'Product' },
  { id: 'u3', name: 'Carla Gomez', role: 'Design' },
  { id: 'u4', name: 'David Kim', role: 'QA' }
];

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'kudos.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let kudos = [];
try {
  if (fs.existsSync(dataFile)) kudos = JSON.parse(fs.readFileSync(dataFile, 'utf8') || '[]');
  else fs.writeFileSync(dataFile, '[]', 'utf8');
} catch (e) {
  console.error('Failed to load kudos data, starting with empty list', e);
  kudos = [];
}

function persist() {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(kudos, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to persist kudos', e);
  }
}

// Admin token for demo purposes. In production use proper auth/SSO.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret';

// Simple in-memory rate-limiting and duplicate detection
const rateLimitWindowMs = 60 * 1000; // 1 minute
const rateLimitMax = 5; // max kudos per sender per window
const rateBuckets = new Map(); // key: sender (fromUserName), value: array of timestamps

function isRateLimited(sender) {
  if (!sender) return false;
  const now = Date.now();
  const arr = rateBuckets.get(sender) || [];
  const recent = arr.filter(t => t > now - rateLimitWindowMs);
  recent.push(now);
  rateBuckets.set(sender, recent);
  return recent.length > rateLimitMax;
}

function isDuplicate(fromUserName, toUserId, message) {
  const now = Date.now();
  // consider duplicate if identical message from same sender to same recipient within 60s
  return kudos.some(k =>
    k.fromUserName === fromUserName &&
    k.toUserId === toUserId &&
    k.message === message &&
    (now - k.timestamp) < 60 * 1000
  );
}

function isAdmin(req) {
  const token = req.get('x-admin-token') || '';
  if (token === ADMIN_TOKEN) return true;
  // fallback role header for demo
  const role = req.get('x-user-role') || '';
  return role.toLowerCase() === 'admin';
}

app.get('/api/users', (req, res) => {
  res.json(users);
});

app.get('/api/kudos', (req, res) => {
  const includeHidden = req.query.include_hidden === 'true';
  let list = [...kudos];
  if (!includeHidden) list = list.filter(k => k.is_visible && !k.deleted);
  else if (!isAdmin(req)) return res.status(403).json({ error: 'admin_required' });
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
  const recent = list.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  res.json(recent);
});

app.post('/api/kudos', (req, res) => {
  const { toUserId, fromUserName, message } = req.body || {};
  if (!toUserId || !fromUserName || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (String(message).length > 500) return res.status(400).json({ error: 'Message too long' });
  const toUser = users.find(u => u.id === toUserId);
  if (!toUser) return res.status(400).json({ error: 'Invalid recipient' });

  if (isRateLimited(fromUserName)) return res.status(429).json({ error: 'rate_limited' });
  if (isDuplicate(fromUserName, toUserId, message)) return res.status(409).json({ error: 'duplicate' });

  const entry = {
    id: String(Date.now()),
    toUserId,
    toUserName: toUser.name,
    fromUserName,
    message: String(message).slice(0, 500),
    timestamp: Date.now(),
    is_visible: true,
    moderated_by: null,
    moderated_at: null,
    reason_for_moderation: null,
    deleted: false
  };
  kudos.push(entry);
  persist();
  res.status(201).json(entry);
});

// Admin: patch moderation fields
app.patch('/api/kudos/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'admin_required' });
  const id = req.params.id;
  const item = kudos.find(k => k.id === id);
  if (!item) return res.status(404).json({ error: 'not_found' });
  const { is_visible, moderated_by, reason_for_moderation } = req.body || {};
  if (typeof is_visible === 'boolean') item.is_visible = is_visible;
  if (moderated_by) item.moderated_by = moderated_by;
  if (reason_for_moderation) item.reason_for_moderation = reason_for_moderation;
  item.moderated_at = Date.now();
  persist();
  res.json(item);
});

// Admin: soft-delete
app.delete('/api/kudos/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'admin_required' });
  const id = req.params.id;
  const item = kudos.find(k => k.id === id);
  if (!item) return res.status(404).json({ error: 'not_found' });
  item.deleted = true;
  item.is_visible = false;
  item.moderated_at = Date.now();
  persist();
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Kudos app listening on http://localhost:${PORT}`);
});
