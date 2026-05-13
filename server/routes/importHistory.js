import { Router } from 'express';
import { addImportHistory, readHistory, writeHistory } from '../utils/maintenance.js';
const router = Router();
router.get('/', async (_req, res, next) => { try { res.json(await readHistory()); } catch (error) { next(error); } });
router.post('/', async (req, res, next) => { try { res.status(201).json(await addImportHistory(req.body || {})); } catch (error) { next(error); } });
router.post('/:id/check', async (req, res, next) => { try { const records = await readHistory(); const nextRecords = records.map((r) => r.id === req.params.id ? { ...r, status: r.status || 'completed', checkedAt: new Date().toISOString(), notes: req.body?.notes ?? r.notes } : r); await writeHistory(nextRecords); res.json(nextRecords.find((r) => r.id === req.params.id)); } catch (error) { next(error); } });
export default router;
