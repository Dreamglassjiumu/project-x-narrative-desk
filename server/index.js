import express from 'express';
import assetsRouter from './routes/assets.js';
import uploadsRouter, { streamUploadedFile } from './routes/uploads.js';
import backupRouter from './routes/backup.js';
import intakeRouter from './routes/intake.js';
import { dataDir, documentsDir, imagesDir, uploadsDir } from './utils/paths.js';
import { ensureWorkspace } from './utils/jsonStore.js';

const PORT = Number(process.env.PORT ?? 4317);
const HOST = '127.0.0.1';

await ensureWorkspace();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.options('*', (_req, res) => res.sendStatus(204));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'local-first', dataDir, uploadsDir, imagesDir, documentsDir });
});

app.use('/api/assets', assetsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/backup', backupRouter);
app.use('/api/intake', intakeRouter);
app.get('/uploads/:folder/:id', streamUploadedFile);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message ?? 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Project:X local API listening at http://localhost:${PORT}`);
  console.log(`Data directory: ${dataDir}`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(`Images directory: ${imagesDir}`);
  console.log(`Documents directory: ${documentsDir}`);
});
