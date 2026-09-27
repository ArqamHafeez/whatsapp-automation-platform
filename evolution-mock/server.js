<<<<<<< HEAD
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

/** @type {Record<string, any>} */
const instances = {};

const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/evolution';
const PORT = process.env.EVOLUTION_MOCK_PORT || 8081;

function fakeQrBase64() {
  // 1x1 transparent PNG
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

app.get('/instance/connectionState/:instanceName', (req, res) => {
  const instance = instances[req.params.instanceName];
  if (!instance) {
    return res.status(404).json({ message: 'Instance not found' });
  }
  res.json({ instance: { instanceName: req.params.instanceName, state: instance.state } });
});

app.post('/instance/create', (req, res) => {
  const instanceName = req.body.instanceName || `mock-${uuidv4().slice(0, 8)}`;
  instances[instanceName] = {
    instanceName,
    state: 'close',
    createdAt: new Date(),
  };
  res.status(201).json({
    instance: { instanceName, status: 'created' },
    hash: { apikey: 'dev-key' },
    qrcode: { base64: fakeQrBase64() },
  });
});

app.get('/instance/connect/:instanceName', (req, res) => {
  const instance = instances[req.params.instanceName];
  if (!instance) {
    return res.status(404).json({ message: 'Instance not found' });
  }
  if (instance.state === 'open') {
    return res.json({ instance: { state: 'open' } });
  }
  res.json({ base64: fakeQrBase64(), count: 1 });
});

app.delete('/instance/delete/:instanceName', (req, res) => {
  delete instances[req.params.instanceName];
  res.json({ deleted: true });
});

app.post('/chat/findChats/:instanceName', (req, res) => {
  res.json([
    { remoteJid: '120363012345678901@g.us', pushName: 'Job Postings', updatedAt: Date.now() },
    { remoteJid: '120363098765432109@g.us', pushName: 'IT Opportunities', updatedAt: Date.now() },
    { remoteJid: '5511999999999@s.whatsapp.net', pushName: 'Personal Chat', updatedAt: Date.now() },
    { remoteJid: '120363011111111111@newsletter', pushName: 'Announcements Channel', updatedAt: Date.now() },
  ]);
});

app.get('/chat/findChats/:instanceName', (req, res) => {
  res.json([
    { remoteJid: '120363012345678901@g.us', pushName: 'Job Postings', updatedAt: Date.now() },
    { remoteJid: '120363098765432109@g.us', pushName: 'IT Opportunities', updatedAt: Date.now() },
    { remoteJid: '5511999999999@s.whatsapp.net', pushName: 'Personal Chat', updatedAt: Date.now() },
    { remoteJid: '120363011111111111@newsletter', pushName: 'Announcements Channel', updatedAt: Date.now() },
  ]);
});

app.post('/message/sendText/:instanceName', (req, res) => {
  res.json({ key: { id: uuidv4() }, status: 'PENDING' });
});

app.post('/message/sendMedia/:instanceName', (req, res) => {
  res.json({ key: { id: uuidv4() }, status: 'PENDING' });
});

app.post('/message/sendWhatsAppAudio/:instanceName', (req, res) => {
  res.json({ key: { id: uuidv4() }, status: 'PENDING' });
});

// Mark instance connected (dev helper)
app.post('/mock/connect/:instanceName', (req, res) => {
  const instance = instances[req.params.instanceName];
  if (!instance) {
    return res.status(404).json({ message: 'Instance not found' });
  }
  instance.state = 'open';
  res.json({ instanceName: req.params.instanceName, state: 'open' });
});

app.post('/mock/emit-message', async (req, res) => {
  const { instanceName, remoteJid, text } = req.body;
  const payload = {
    instance: instanceName,
    event: 'messages.upsert',
    data: {
      key: { id: uuidv4(), remoteJid: remoteJid || '120363012345678901@g.us', fromMe: false },
      pushName: 'Mock Sender',
      message: { conversation: text || 'Hello from mock Evolution API' },
    },
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Webhook emit failed:', err.message);
  }

  res.json({ ok: true, payload });
});

/** 1x1 PNG for media tests */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

app.post('/mock/emit-image', async (req, res) => {
  const { instanceName, remoteJid, caption, base64 } = req.body;
  const payload = {
    instance: instanceName,
    event: 'messages.upsert',
    data: {
      key: { id: uuidv4(), remoteJid: remoteJid || '120363012345678901@g.us', fromMe: false },
      pushName: 'Mock Sender',
      base64: base64 || TINY_PNG_BASE64,
      message: {
        imageMessage: {
          caption: caption || 'Test image caption',
          mimetype: 'image/png',
        },
      },
    },
  };
  try {
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (err) {
    console.warn('Webhook emit failed:', err.message);
  }
  res.json({ ok: true, payload });
});

app.post('/mock/emit-video', async (req, res) => {
  const { instanceName, remoteJid, caption, base64 } = req.body;
  const payload = {
    instance: instanceName,
    event: 'messages.upsert',
    data: {
      key: { id: uuidv4(), remoteJid: remoteJid || '120363012345678901@g.us', fromMe: false },
      pushName: 'Mock Sender',
      base64: base64 || TINY_PNG_BASE64,
      message: {
        videoMessage: {
          caption: caption || 'Test video caption',
          mimetype: 'video/mp4',
        },
      },
    },
  };
  try {
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (err) {
    console.warn('Webhook emit failed:', err.message);
  }
  res.json({ ok: true, payload });
});

app.post('/chat/getBase64FromMediaMessage/:instanceName', (req, res) => {
  res.json({
    base64: TINY_PNG_BASE64,
    mimetype: 'image/png',
  });
});

app.listen(PORT, () => {
  console.log(`Mock Evolution API v2 running on http://localhost:${PORT}`);
  console.log(`Webhook URL: ${webhookUrl}`);
});
=======
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

/** @type {Record<string, any>} */
const instances = {};

const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/evolution';
const PORT = process.env.EVOLUTION_MOCK_PORT || 8081;

function fakeQrBase64() {
  // 1x1 transparent PNG
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
}

app.get('/instance/connectionState/:instanceName', (req, res) => {
  const instance = instances[req.params.instanceName];
  if (!instance) {
    return res.status(404).json({ message: 'Instance not found' });
  }
  res.json({ instance: { instanceName: req.params.instanceName, state: instance.state } });
});

app.post('/instance/create', (req, res) => {
  const instanceName = req.body.instanceName || `mock-${uuidv4().slice(0, 8)}`;
  instances[instanceName] = {
    instanceName,
    state: 'close',
    createdAt: new Date(),
  };
  res.status(201).json({
    instance: { instanceName, status: 'created' },
    hash: { apikey: 'dev-key' },
    qrcode: { base64: fakeQrBase64() },
  });
});

app.get('/instance/connect/:instanceName', (req, res) => {
  const instance = instances[req.params.instanceName];
  if (!instance) {
    return res.status(404).json({ message: 'Instance not found' });
  }
  if (instance.state === 'open') {
    return res.json({ instance: { state: 'open' } });
  }
  res.json({ base64: fakeQrBase64(), count: 1 });
});

app.delete('/instance/delete/:instanceName', (req, res) => {
  delete instances[req.params.instanceName];
  res.json({ deleted: true });
});

app.post('/chat/findChats/:instanceName', (req, res) => {
  res.json([
    { remoteJid: '120363012345678901@g.us', pushName: 'Job Postings', updatedAt: Date.now() },
    { remoteJid: '120363098765432109@g.us', pushName: 'IT Opportunities', updatedAt: Date.now() },
    { remoteJid: '5511999999999@s.whatsapp.net', pushName: 'Personal Chat', updatedAt: Date.now() },
    { remoteJid: '120363011111111111@newsletter', pushName: 'Announcements Channel', updatedAt: Date.now() },
  ]);
});

app.get('/chat/findChats/:instanceName', (req, res) => {
  res.json([
    { remoteJid: '120363012345678901@g.us', pushName: 'Job Postings', updatedAt: Date.now() },
    { remoteJid: '120363098765432109@g.us', pushName: 'IT Opportunities', updatedAt: Date.now() },
    { remoteJid: '5511999999999@s.whatsapp.net', pushName: 'Personal Chat', updatedAt: Date.now() },
    { remoteJid: '120363011111111111@newsletter', pushName: 'Announcements Channel', updatedAt: Date.now() },
  ]);
});

app.post('/message/sendText/:instanceName', (req, res) => {
  res.json({ key: { id: uuidv4() }, status: 'PENDING' });
});

app.post('/message/sendMedia/:instanceName', (req, res) => {
  res.json({ key: { id: uuidv4() }, status: 'PENDING' });
});

app.post('/message/sendWhatsAppAudio/:instanceName', (req, res) => {
  res.json({ key: { id: uuidv4() }, status: 'PENDING' });
});

// Mark instance connected (dev helper)
app.post('/mock/connect/:instanceName', (req, res) => {
  const instance = instances[req.params.instanceName];
  if (!instance) {
    return res.status(404).json({ message: 'Instance not found' });
  }
  instance.state = 'open';
  res.json({ instanceName: req.params.instanceName, state: 'open' });
});

app.post('/mock/emit-message', async (req, res) => {
  const { instanceName, remoteJid, text } = req.body;
  const payload = {
    instance: instanceName,
    event: 'messages.upsert',
    data: {
      key: { id: uuidv4(), remoteJid: remoteJid || '120363012345678901@g.us', fromMe: false },
      pushName: 'Mock Sender',
      message: { conversation: text || 'Hello from mock Evolution API' },
    },
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Webhook emit failed:', err.message);
  }

  res.json({ ok: true, payload });
});

/** 1x1 PNG for media tests */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

app.post('/mock/emit-image', async (req, res) => {
  const { instanceName, remoteJid, caption, base64 } = req.body;
  const payload = {
    instance: instanceName,
    event: 'messages.upsert',
    data: {
      key: { id: uuidv4(), remoteJid: remoteJid || '120363012345678901@g.us', fromMe: false },
      pushName: 'Mock Sender',
      base64: base64 || TINY_PNG_BASE64,
      message: {
        imageMessage: {
          caption: caption || 'Test image caption',
          mimetype: 'image/png',
        },
      },
    },
  };
  try {
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (err) {
    console.warn('Webhook emit failed:', err.message);
  }
  res.json({ ok: true, payload });
});

app.post('/mock/emit-video', async (req, res) => {
  const { instanceName, remoteJid, caption, base64 } = req.body;
  const payload = {
    instance: instanceName,
    event: 'messages.upsert',
    data: {
      key: { id: uuidv4(), remoteJid: remoteJid || '120363012345678901@g.us', fromMe: false },
      pushName: 'Mock Sender',
      base64: base64 || TINY_PNG_BASE64,
      message: {
        videoMessage: {
          caption: caption || 'Test video caption',
          mimetype: 'video/mp4',
        },
      },
    },
  };
  try {
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (err) {
    console.warn('Webhook emit failed:', err.message);
  }
  res.json({ ok: true, payload });
});

app.post('/chat/getBase64FromMediaMessage/:instanceName', (req, res) => {
  res.json({
    base64: TINY_PNG_BASE64,
    mimetype: 'image/png',
  });
});

app.listen(PORT, () => {
  console.log(`Mock Evolution API v2 running on http://localhost:${PORT}`);
  console.log(`Webhook URL: ${webhookUrl}`);
});
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
