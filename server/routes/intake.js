import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { assetFiles, backupsDir, dataDir, intakeDraftsPath, uploadFolders, uploadIndexPath } from '../utils/paths.js';
import { ensureJsonArrayFile, readJsonArray, writeJsonArray } from '../utils/jsonStore.js';

const router = Router();
const draftsPath = intakeDraftsPath;
const assetTypes = ['factions', 'districts', 'pois', 'characters', 'storylines'];
const idPrefixes = { factions: 'faction', districts: 'district', pois: 'poi', characters: 'char', storylines: 'story' };
const typeLabels = { factions: 'Faction', districts: 'District', pois: 'POI', characters: 'Character', storylines: 'Storyline' };
const arrayFields = new Set(['aliases','tags','narrativeConstraints','doNotRevealYet','sourceNotes','relatedFactionIds','relatedDistrictIds','relatedPoiIds','relatedCharacterIds','relatedStorylineIds','playableScripts','territoryDistrictIds','headquartersPoiIds','coreBusiness','allies','enemies','visualKeywords','missionTypes','atmosphere','dominantFactions','keyPoiIds','storyUsage','gameplayUsage','relatedPlayableCharacters','relatedBosses']);

const readDrafts = async () => {
  await ensureJsonArrayFile(draftsPath);
  return readJsonArray(draftsPath);
};
const writeDrafts = (records) => writeJsonArray(draftsPath, records);
const safeId = (value) => path.basename(String(value || ''));
const extensionOf = (file = {}) => path.extname(file.name || file.filename || '').toLowerCase();
const nowStamp = () => new Date().toISOString();
const cleanName = (name) => String(name || 'Untitled Dossier').replace(/\.[^.]+$/, '').trim() || 'Untitled Dossier';
const splitList = (value) => {
  if (Array.isArray(value)) return value.map(String).map((x) => x.trim()).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(/[;,，、|]/).map((x) => x.trim()).filter(Boolean);
};
const scalar = (value) => Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();

const normalizeAsset = (type, value = {}) => {
  const base = {
    id: value.id || '',
    name: scalar(value.name) || 'Untitled Dossier',
    chineseName: scalar(value.chineseName),
    englishName: scalar(value.englishName) || scalar(value.name),
    aliases: splitList(value.aliases),
    category: scalar(value.category) || typeLabels[type],
    summary: scalar(value.summary),
    details: scalar(value.details),
    tags: splitList(value.tags),
    status: scalar(value.status) || 'draft',
    spoilerLevel: scalar(value.spoilerLevel) || 'internal',
    relatedFactionIds: splitList(value.relatedFactionIds),
    relatedDistrictIds: splitList(value.relatedDistrictIds),
    relatedPoiIds: splitList(value.relatedPoiIds),
    relatedCharacterIds: splitList(value.relatedCharacterIds),
    relatedStorylineIds: splitList(value.relatedStorylineIds),
    narrativeConstraints: splitList(value.narrativeConstraints),
    doNotRevealYet: splitList(value.doNotRevealYet),
    sourceNotes: splitList(value.sourceNotes),
  };
  if (type === 'characters') return { ...base, characterType: scalar(value.characterType) || 'story_npc', gender: scalar(value.gender), age: scalar(value.age), nationality: scalar(value.nationality), ethnicity: scalar(value.ethnicity), occupation: scalar(value.occupation), factionId: scalar(value.factionId), districtId: scalar(value.districtId), weapon: scalar(value.weapon), attribute: scalar(value.attribute), playableScripts: splitList(value.playableScripts), characterArc: scalar(value.characterArc), currentTimelineStatus: scalar(value.currentTimelineStatus) };
  if (type === 'factions') return { ...base, factionCategory: scalar(value.factionCategory), culturalRoot: splitList(value.culturalRoot), territoryDistrictIds: splitList(value.territoryDistrictIds), headquartersPoiIds: splitList(value.headquartersPoiIds), coreBusiness: splitList(value.coreBusiness), allies: splitList(value.allies), enemies: splitList(value.enemies), visualKeywords: splitList(value.visualKeywords), missionTypes: splitList(value.missionTypes) };
  if (type === 'districts') return { ...base, realWorldReference: scalar(value.realWorldReference), atmosphere: splitList(value.atmosphere), dominantFactions: splitList(value.dominantFactions), keyPoiIds: splitList(value.keyPoiIds), storyUsage: splitList(value.storyUsage), gameplayUsage: splitList(value.gameplayUsage), districtStatus: scalar(value.districtStatus) };
  if (type === 'pois') return { ...base, districtId: scalar(value.districtId), poiTier: scalar(value.poiTier) || 'landmark', realWorldReference: scalar(value.realWorldReference), addressReference: scalar(value.addressReference), gameplayUsage: splitList(value.gameplayUsage), storyUsage: splitList(value.storyUsage) };
  return { ...base, storylineType: scalar(value.storylineType) || 'side', timeline: scalar(value.timeline), act: scalar(value.act), relatedPlayableCharacters: splitList(value.relatedPlayableCharacters), relatedBosses: splitList(value.relatedBosses), mainConflict: scalar(value.mainConflict), playerGoal: scalar(value.playerGoal), endingState: scalar(value.endingState), timelinePlacement: scalar(value.timelinePlacement), pitchStatus: scalar(value.pitchStatus) || 'under_review' };
};

const makeDraft = ({ targetType, asset, file, parserMode }) => ({
  id: `draft-${crypto.randomUUID()}`,
  targetType,
  asset: normalizeAsset(targetType, asset),
  sourceFileId: file.id || file.filename || file.name || 'inline-evidence',
  sourceFileName: file.name || file.filename || 'Inline Evidence',
  sourceFilePath: file.filename ? `uploads/${file.folder || 'documents'}/${file.filename}` : '',
  parserMode,
  status: 'needs_review',
  createdAt: nowStamp(),
  updatedAt: nowStamp(),
});

const findUpload = async (id) => {
  const index = await readJsonArray(uploadIndexPath);
  const record = index.find((item) => item.id === id || item.filename === id);
  if (!record) return undefined;
  const folder = record.folder || (record.filename && ['.jpg','.jpeg','.png','.gif','.webp','.svg'].includes(path.extname(record.filename).toLowerCase()) ? 'images' : 'documents');
  return { ...record, folder };
};
const uploadPath = (file) => file.filename ? path.join(uploadFolders[file.folder || 'documents'], file.filename) : undefined;

const detectParserMode = (file) => {
  const ext = extensionOf(file);
  if ((file.type || '').startsWith('image/') || ['.png','.jpg','.jpeg','.webp'].includes(ext)) return 'Image Evidence';
  if (['.csv','.xlsx','.xls'].includes(ext)) return 'Sheet';
  if (['.md','.markdown','.txt'].includes(ext)) return 'Raw Text';
  if (ext === '.json') return 'Existing Archive JSON';
  if (['.pdf','.doc','.docx'].includes(ext)) return 'raw_document';
  return 'Raw Text';
};

const targetTypeFromMode = (mode, fallback = 'characters') => {
  const normalized = String(mode || '').toLowerCase();
  if (normalized.includes('faction')) return 'factions';
  if (normalized.includes('district')) return 'districts';
  if (normalized.includes('poi')) return 'pois';
  if (normalized.includes('storyline')) return 'storylines';
  if (normalized.includes('character')) return 'characters';
  return fallback;
};

const draftTargetType = (value, fallback = 'characters') => assetTypes.includes(value) ? value : fallback;

const requestFileInfo = (body = {}) => {
  const supplied = body.file && typeof body.file === 'object' ? body.file : {};
  const name = supplied.name || body.fileName || body.name || supplied.filename || body.filename || 'Inline Evidence';
  const filename = supplied.filename || body.filename || '';
  return {
    ...supplied,
    id: supplied.id || body.fileId || filename || name,
    name,
    filename,
    type: supplied.type || body.fileType || body.type || '',
    folder: supplied.folder || (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(path.extname(filename || name).toLowerCase()) ? 'images' : 'documents'),
  };
};

const fileExists = async (filePath) => Boolean(filePath && await fs.access(filePath).then(() => true).catch(() => false));
const inlineText = (body = {}) => {
  if (typeof body.content === 'string') return body.content;
  if (typeof body.text === 'string') return body.text;
  if (typeof body.file?.content === 'string') return body.file.content;
  return undefined;
};

const parseCsv = (text) => {
  const rows = []; let row = []; let value = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]; const next = text[i + 1];
    if (quoted && char === '"' && next === '"') { value += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && char === ',') { row.push(value.trim()); value = ''; continue; }
    if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && next === '\n') i += 1; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ''; continue; }
    value += char;
  }
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  const headers = rows[0] || [];
  return { headers, rows: rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))), previewRows: rows.slice(1, 11) };
};

const guessField = (header = '', targetType) => {
  const h = header.toLowerCase().replace(/[\s_-]/g, '');
  const has = (...keys) => keys.some((key) => h.includes(key));
  if (has('角色名','姓名','名称','name','title')) return 'name';
  if (has('中文名','chinesename','cnname')) return 'chineseName';
  if (has('英文名','englishname','enname')) return 'englishName';
  if (has('别名','alias')) return 'aliases';
  if (has('简介','summary','brief')) return 'summary';
  if (has('详情','设定','details','description','desc')) return 'details';
  if (has('标签','tags')) return 'tags';
  if (has('状态','status')) return 'status';
  if (has('剧透','spoiler')) return 'spoilerLevel';
  if (has('限制','constraint')) return 'narrativeConstraints';
  if (has('暂不透露','donotreveal')) return 'doNotRevealYet';
  if (has('来源','备注','sourcenotes','notes')) return 'sourceNotes';
  if (has('所属帮派','faction')) return targetType === 'characters' ? 'factionId' : 'relatedFactionIds';
  if (has('区域','district')) return targetType === 'characters' || targetType === 'pois' ? 'districtId' : 'relatedDistrictIds';
  if (has('职业','occupation')) return 'occupation';
  if (has('武器','weapon')) return 'weapon';
  if (has('性别','gender')) return 'gender';
  if (has('年龄','age')) return 'age';
  if (has('文化','cultural')) return 'culturalRoot';
  if (has('生意','business')) return 'coreBusiness';
  if (has('盟友','allies')) return 'allies';
  if (has('敌人','enemies')) return 'enemies';
  if (has('氛围','atmosphere')) return 'atmosphere';
  if (has('剧情','storyusage')) return 'storyUsage';
  if (has('玩法','gameplay')) return 'gameplayUsage';
  return '';
};

const rowsToDrafts = (rows, mapping, targetType, file, parserMode) => rows.map((row, index) => {
  const asset = {};
  for (const [header, field] of Object.entries(mapping || {})) {
    if (!field) continue;
    asset[field] = arrayFields.has(field) ? splitList(row[header]) : row[header];
  }
  if (!asset.name) asset.name = cleanName(`${file.name} Row ${index + 1}`);
  asset.sourceNotes = [...splitList(asset.sourceNotes), `Imported from sheet evidence: ${file.name}`];
  return makeDraft({ targetType, asset, file, parserMode });
});

const splitMarkdownHeadings = (text) => {
  const lines = text.split(/\r?\n/); const chunks = []; let current;
  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (match) { if (current) chunks.push(current); current = { name: match[2].trim(), body: [] }; }
    else if (current) current.body.push(line);
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks.map((chunk) => ({ name: chunk.name, details: chunk.body.join('\n').trim() })) : [{ name: 'Untitled Text Dossier', details: text.trim() }];
};

const createBackup = async () => {
  await fs.mkdir(backupsDir, { recursive: true });
  const date = new Date(); const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const payload = {};
  for (const [type, fileName] of Object.entries(assetFiles)) {
    payload[type] = await readJsonArray(path.join(dataDir, fileName));
  }
  payload.intakeDrafts = await readDrafts();
  const backupPath = path.join(backupsDir, `backup-before-import-${stamp}.json`);
  await fs.writeFile(backupPath, `${JSON.stringify({ createdAt: nowStamp(), payload }, null, 2)}\n`, 'utf8');
  return { path: backupPath, filename: path.basename(backupPath) };
};

const fileDraft = async (draft, { mergeIntoId } = {}) => {
  if (!assetTypes.includes(draft.targetType)) throw new Error(`Unknown target type: ${draft.targetType}`);
  const filePath = path.join(dataDir, assetFiles[draft.targetType]);
  const records = await readJsonArray(filePath);
  const asset = normalizeAsset(draft.targetType, draft.asset);
  let filed;
  if (mergeIntoId) {
    const index = records.findIndex((item) => item.id === mergeIntoId);
    if (index === -1) throw new Error(`Merge target not found: ${mergeIntoId}`);
    filed = { ...records[index], ...asset, id: mergeIntoId };
    records[index] = filed;
  } else {
    filed = { ...asset, id: asset.id || `${idPrefixes[draft.targetType]}-${crypto.randomUUID()}` };
    records.unshift(filed);
  }
  await writeJsonArray(filePath, records);

  const uploads = await readJsonArray(uploadIndexPath);
  const nextUploads = uploads.map((upload) => {
    if (upload.id !== draft.sourceFileId && upload.filename !== draft.sourceFileId) return upload;
    return { ...upload, linkedAssetIds: [...new Set([...(upload.linkedAssetIds || []), filed.id])] };
  });
  await writeJsonArray(uploadIndexPath, nextUploads);
  return filed;
};

router.post('/parse', async (req, res, next) => {
  try {
    const body = req.body || {};
    await ensureJsonArrayFile(draftsPath);
    const uploadedFile = body.fileId ? await findUpload(safeId(body.fileId)) : undefined;
    const file = uploadedFile || requestFileInfo(body);
    const mode = body.parserMode === 'Auto Detect' || !body.parserMode ? detectParserMode(file) : body.parserMode;
    const ext = extensionOf(file);
    const fullPath = uploadPath(file);
    const response = { file, parserMode: mode, status: 'parsed', message: '', preview: undefined, drafts: [] };

    if (body.fileId && !uploadedFile) {
      response.status = 'failed';
      response.message = `Upload not found: ${body.fileId}`;
      return res.status(400).json(response);
    }

    if (mode === 'raw_document' || ['.pdf','.doc','.docx'].includes(ext)) {
      response.status = 'needs_review'; response.parserMode = 'raw_document'; response.message = 'Deep parsing not available yet';
      return res.json(response);
    }
    if (mode === 'Image Evidence' || (file.type || '').startsWith('image/')) {
      const template = body.template || 'story_npc';
      const typeByTemplate = { faction: 'factions', district: 'districts', poi: 'pois', storyline: 'storylines', playable_hero: 'characters', boss: 'characters', story_npc: 'characters' };
      const defaults = { playable_hero: { characterType: 'playable_hero' }, boss: { characterType: 'boss', spoilerLevel: 'secret' }, story_npc: { characterType: 'story_npc' } };
      response.drafts = [makeDraft({ targetType: typeByTemplate[template] || 'characters', asset: { ...(defaults[template] || {}), name: cleanName(file.name), sourceNotes: [`Created from image evidence: ${file.name}`], linkedFiles: [file.id] }, file, parserMode: 'Image Evidence' })];
      return res.json(response);
    }
    if (['.csv'].includes(ext) || mode.includes('Sheet')) {
      let table;
      const content = inlineText(body);
      if (!content && !await fileExists(fullPath)) { response.status = 'failed'; response.message = 'Uploaded sheet file is not available on disk.'; return res.json(response); }
      if (ext === '.csv' || content) table = parseCsv(content ?? await fs.readFile(fullPath, 'utf8'));
      else {
        try {
          const xlsx = await import('xlsx');
          const workbook = xlsx.readFile(fullPath); const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          const headers = (matrix[0] || []).map(String);
          table = { headers, previewRows: matrix.slice(1, 11), rows: matrix.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))) };
        } catch {
          response.status = 'failed'; response.message = 'XLSX parsing requires optional xlsx dependency. CSV import is available.'; return res.json(response);
        }
      }
      const targetType = draftTargetType(body.targetType, targetTypeFromMode(mode));
      const mapping = body.mapping || Object.fromEntries(table.headers.map((header) => [header, guessField(header, targetType)]));
      response.preview = { kind: 'sheet', headers: table.headers, rows: table.previewRows, guessedMapping: mapping };
      if (body.createDrafts) response.drafts = rowsToDrafts(table.rows, mapping, targetType, file, mode);
      return res.json(response);
    }
    if (['.md','.markdown','.txt'].includes(ext) || mode === 'Raw Text') {
      const content = inlineText(body);
      if (!content && !await fileExists(fullPath)) { response.status = 'failed'; response.message = 'Uploaded text file is not available on disk.'; return res.json(response); }
      const text = content ?? await fs.readFile(fullPath, 'utf8');
      const targetType = draftTargetType(body.targetType, targetTypeFromMode(mode));
      const splitMode = body.textSplitMode || 'full';
      let chunks = [{ name: cleanName(file.name), details: text.trim() }];
      if (splitMode === 'headings') chunks = splitMarkdownHeadings(text);
      if (splitMode === 'separator') chunks = text.split(body.separator || '---').map((body, index) => ({ name: cleanName(`${file.name} ${index + 1}`), details: body.trim() })).filter((chunk) => chunk.details);
      response.preview = { kind: 'text', text: text.slice(0, 8000), chunks: chunks.slice(0, 10) };
      if (body.createDrafts) response.drafts = chunks.map((chunk) => makeDraft({ targetType, asset: { name: chunk.name, details: chunk.details, summary: chunk.details.slice(0, 220), sourceNotes: [`Imported from text evidence: ${file.name}`] }, file, parserMode: 'Raw Text' }));
      return res.json(response);
    }
    if (ext === '.json' || mode === 'Existing Archive JSON') {
      const content = inlineText(body);
      if (!content && !await fileExists(fullPath)) { response.status = 'failed'; response.message = 'Uploaded JSON file is not available on disk.'; return res.json(response); }
      const raw = content ?? await fs.readFile(fullPath, 'utf8'); const parsed = JSON.parse(raw);
      response.preview = { kind: 'json', json: parsed };
      if (body.createDrafts) {
        const targetType = draftTargetType(body.targetType, targetTypeFromMode(mode)); const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed[targetType]) ? parsed[targetType] : [parsed];
        response.drafts = records.map((asset) => makeDraft({ targetType, asset: { ...asset, sourceNotes: [...splitList(asset.sourceNotes), `Imported from archive JSON evidence: ${file.name}`] }, file, parserMode: 'Existing Archive JSON' }));
      }
      return res.json(response);
    }
    response.status = 'failed'; response.message = 'Unsupported intake parser mode for this evidence.'; res.json(response);
  } catch (error) { next(error); }
});

router.get('/drafts', async (_req, res, next) => { try { res.json(await readDrafts()); } catch (error) { next(error); } });
router.post('/drafts', async (req, res, next) => { try { const incoming = Array.isArray(req.body) ? req.body : [req.body]; const drafts = await readDrafts(); const records = incoming.map((draft) => ({ ...draft, id: draft.id || `draft-${crypto.randomUUID()}`, status: draft.status || 'needs_review', createdAt: draft.createdAt || nowStamp(), updatedAt: nowStamp() })); await writeDrafts([...records, ...drafts]); res.status(201).json(records); } catch (error) { next(error); } });
router.put('/drafts/:id', async (req, res, next) => { try { const drafts = await readDrafts(); const index = drafts.findIndex((draft) => draft.id === req.params.id); if (index === -1) return res.status(404).json({ error: `Draft not found: ${req.params.id}` }); drafts[index] = { ...drafts[index], ...req.body, id: req.params.id, updatedAt: nowStamp() }; await writeDrafts(drafts); res.json(drafts[index]); } catch (error) { next(error); } });
router.delete('/drafts/:id', async (req, res, next) => { try { const drafts = await readDrafts(); const nextDrafts = drafts.map((draft) => draft.id === req.params.id ? { ...draft, status: 'rejected', updatedAt: nowStamp() } : draft); if (nextDrafts.every((draft) => draft.id !== req.params.id)) return res.status(404).json({ error: `Draft not found: ${req.params.id}` }); await writeDrafts(nextDrafts); res.sendStatus(204); } catch (error) { next(error); } });
router.post('/drafts/:id/file', async (req, res, next) => { try { const drafts = await readDrafts(); const index = drafts.findIndex((draft) => draft.id === req.params.id); if (index === -1) return res.status(404).json({ error: `Draft not found: ${req.params.id}` }); const asset = await fileDraft(drafts[index], req.body); drafts[index] = { ...drafts[index], status: 'filed', filedAssetId: asset.id, updatedAt: nowStamp() }; await writeDrafts(drafts); res.json({ draft: drafts[index], asset }); } catch (error) { next(error); } });
router.post('/drafts/file-batch', async (req, res, next) => { try { const ids = Array.isArray(req.body?.ids) ? req.body.ids : []; if (!ids.length) return res.status(400).json({ error: 'No draft ids supplied.' }); const backup = await createBackup(); const drafts = await readDrafts(); const filed = []; for (const id of ids) { const draft = drafts.find((item) => item.id === id); if (!draft || draft.status === 'filed' || draft.status === 'rejected') continue; const asset = await fileDraft(draft); draft.status = 'filed'; draft.filedAssetId = asset.id; draft.updatedAt = nowStamp(); filed.push(asset); } await writeDrafts(drafts); res.json({ backup, filed }); } catch (error) { next(error); } });
router.post('/backup', async (_req, res, next) => { try { res.json(await createBackup()); } catch (error) { next(error); } });

await ensureJsonArrayFile(draftsPath);
await fs.mkdir(backupsDir, { recursive: true });

export default router;
