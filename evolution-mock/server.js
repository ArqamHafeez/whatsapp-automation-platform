const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// In-memory store for development
const instances = {};
const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/incoming-message';

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Create instance (WhatsApp connection)
app.post('/api/instances/create', (req, res) => {
  const { name } = req.body;
  const instanceId = uuidv4();
  const externalId = `wa_${Math.random().toString(36).substr(2, 9)}`;

  instances[instanceId] = {
    id: instanceId,
    externalId,
    name,
    status: 'pending',
    qrcode: `https://fake-qr.example.com/${instanceId}`,
    createdAt: new Date(),
  };

  res.status(201).json({
    status: 'success',
    data: {
      instanceId,
      ...instances[instanceId],
    },
  });
});

// List instances
app.get('/api/instances', (req, res) => {
  res.json({
    status: 'success',
    data: Object.values(instances),
  });
});

// Get instance details
app.get('/api/instances/:instanceId', (req, res) => {
  const { instanceId } = req.params;
  const instance = instances[instanceId];

  if (!instance) {
    return res.status(404).json({ status: 'error', message: 'Instance not found' });
  }

  res.json({
    status: 'success',
    data: instance,
  });
});

// Get QR code
app.post('/api/instances/:instanceId/qrcode', (req, res) => {
  const { instanceId } = req.params;
  const instance = instances[instanceId];

  if (!instance) {
    return res.status(404).json({ status: 'error', message: 'Instance not found' });
  }

  // Simulate QR refresh
  instance.qrcode = `https://fake-qr.example.com/${instanceId}-${Date.now()}`;
  instance.status = 'pending';

  res.json({
    status: 'success',
    data: {
      qrcode: instance.qrcode,
      timeout: 60,
    },
  });
});

// Disconnect instance
app.post('/api/instances/:instanceId/disconnect', (req, res) => {
  const { instanceId } = req.params;
  const instance = instances[instanceId];

  if (!instance) {
    return res.status(404).json({ status: 'error', message: 'Instance not found' });
  }

  instance.status = 'disconnected';

  res.json({
    status: 'success',
    data: { instanceId, status: 'disconnected' },
  });
});

// List chats for an instance
app.get('/api/instances/:instanceId/chats', (req, res) => {
  const { instanceId } = req.params;
  const instance = instances[instanceId];

  if (!instance) {
    return res.status(404).json({ status: 'error', message: 'Instance not found' });
  }

  // Return fake chats
  const fakeChats = [
    {
      id: 'chat_1',
      name: 'General Updates',
      type: 'GROUP',
      participants: 50,
    },
    {
      id: 'chat_2',
      name: 'Job Postings',
      type: 'GROUP',
      participants: 120,
    },
    {
      id: 'chat_3',
      name: 'Personal Chat',
      type: 'CHAT',
      participants: 1,
    },
  ];

  res.json({
    status: 'success',
    data: fakeChats,
  });
});

// Send message (stub)
app.post('/api/instances/:instanceId/send', (req, res) => {
  const { instanceId } = req.params;
  const { chatId, text } = req.body;
  const instance = instances[instanceId];

  if (!instance) {
    return res.status(404).json({ status: 'error', message: 'Instance not found' });
  }

  res.json({
    status: 'success',
    data: {
      messageId: uuidv4(),
      chatId,
      text,
      sentAt: new Date(),
    },
  });
});

// Webhook emitter endpoint (for testing)
app.post('/api/test/emit-message', (req, res) => {
  const { instanceId, chatId, text, sender } = req.body;

  // Simulate incoming message by posting to the webhook URL
  const messagePayload = {
    event: 'message.create',
    data: {
      messageId: uuidv4(),
      instanceId,
      chatId,
      text,
      sender: sender || 'test-user',
      timestamp: new Date(),
      type: 'text',
    },
  };

  // Try to emit webhook (non-blocking)
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messagePayload),
  }).catch((err) => console.log('Webhook emit failed (expected if backend not running):', err.message));

  res.json({
    status: 'success',
    message: 'Mock message emitted to webhook',
    payload: messagePayload,
  });
});

const PORT = process.env.EVOLUTION_MOCK_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mock Evolution API running on http://localhost:${PORT}`);
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log('\nAvailable endpoints:');
  console.log(`  GET  /api/health`);
  console.log(`  POST /api/instances/create`);
  console.log(`  GET  /api/instances`);
  console.log(`  GET  /api/instances/:id`);
  console.log(`  POST /api/instances/:id/qrcode`);
  console.log(`  POST /api/instances/:id/disconnect`);
  console.log(`  GET  /api/instances/:id/chats`);
  console.log(`  POST /api/instances/:id/send`);
  console.log(`  POST /api/test/emit-message (simulate incoming message)`);
});
