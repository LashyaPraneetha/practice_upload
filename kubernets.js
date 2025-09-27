// backend/server.js
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGO_URI || 'mongodb://mongo-0.mongo.ramayana.svc.cluster.local:27017/ramayana';
const dbName = process.env.MONGO_DB || 'ramayana';
const collectionName = process.env.MONGO_COLLECTION || 'records';

let dbClient;
let col;

async function connect() {
  dbClient = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  await dbClient.connect();
  console.log('Connected to MongoDB:', mongoUri);
  col = dbClient.db(dbName).collection(collectionName);

  // Optional: create text index for simple full-text search used by the frontend
  try {
    await col.createIndex({ name: "text", description: "text", tags: "text" });
  } catch (e) {
    console.warn('Index creation warning:', e.message);
  }
}

connect().catch(err => {
  console.error('Mongo connect error', err);
  process.exit(1);
});

// GET /api/records?q=...
app.get('/api/records', async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.toString() : '';
    const filter = q ? { $text: { $search: q } } : {};
    const docs = await col.find(filter).limit(100).toArray();
    // transform _id to id for frontend convenience
    const out = docs.map(d => ({ ...d, id: d._id }));
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to list records' });
  }
});

// POST /api/records
app.post('/api/records', async (req, res) => {
  try {
    const payload = req.body || {};
    if (typeof payload.tags === 'string') {
      payload.tags = payload.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    payload.createdAt = new Date().toISOString();
    const r = await col.insertOne(payload);
    const created = await col.findOne({ _id: r.insertedId });
    res.json({ ...created, id: created._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create record' });
  }
});

// GET /api/records/:id
app.get('/api/records/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await col.findOne({ _id: new ObjectId(id) });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ...doc, id: doc._id });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'invalid id' });
  }
});

// DELETE /api/records/:id
app.delete('/api/records/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await col.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'invalid id' });
  }
});

// POST /api/commands
app.post('/api/commands', async (req, res) => {
  try {
    const { recordId, command } = req.body || {};
    // This is a mock runner — replace with your real command execution if needed.
    const output = `Executed command: "${command}" against record: ${recordId || 'none'}`;
    res.json({ output, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'command execution failed' });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on ${port}`);
});
