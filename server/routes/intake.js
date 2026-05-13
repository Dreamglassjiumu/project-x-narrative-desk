import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import xlsx from 'xlsx';
import { assetFiles, backupsDir, dataDir, intakeDraftsPath, uploadFolders, uploadIndexPath } from '../utils/paths.js';
import { ensureJsonArrayFile, readJsonArray, writeJsonArray } from '../utils/jsonStore.js';
import { addImportHistory, createBackup as createMaintenanceBackup, unique } from '../utils/maintenance.js';

const router = Router();
const draftsPath = intakeDraftsPath;
const assetTypes = ['factions', 'districts', 'pois', 'characters', 'storylines', 'design-assets'];
const idPrefixes = { factions: 'faction', districts: 'district', pois: 'poi', characters: 'char', storylines: 'story', 'design-assets': 'design' };
const typeLabels = { factions: 'Faction', districts: 'District', pois: 'POI', characters: 'Character', storylines: 'Storyline', 'design-assets': 'Design Asset' };
const arrayFields = new Set(['aliases','tags','narrativeConstraints','doNotRevealYet','sourceNotes','relatedFactionIds','relatedDistrictIds','relatedPoiIds','relatedCharacterIds','relatedStorylineIds','playableScripts','territoryDistrictIds','headquartersPoiIds','coreBusiness','allies','enemies','visualKeywords','missionTypes','atmosphere','dominantFactions','keyPoiIds','storyUsage','gameplayUsage','relatedPlayableCharacters','relatedBosses','endings','visualKeywords']);

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
  return String(value).split(/[;,，、|\n\r]/).map((x) => x.trim()).filter(Boolean);
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
    linkedFiles: splitList(value.linkedFiles),
    primaryEvidenceId: scalar(value.primaryEvidenceId),
  };
  if (type === 'characters') return { ...base, characterType: scalar(value.characterType) || 'story_npc', gender: scalar(value.gender), age: scalar(value.age), nationality: scalar(value.nationality), ethnicity: scalar(value.ethnicity), occupation: scalar(value.occupation), factionId: scalar(value.factionId), districtId: scalar(value.districtId), weapon: scalar(value.weapon), attribute: scalar(value.attribute), playableScripts: splitList(value.playableScripts), characterArc: scalar(value.characterArc), currentTimelineStatus: scalar(value.currentTimelineStatus) };
  if (type === 'factions') return { ...base, factionCategory: scalar(value.factionCategory), culturalRoot: splitList(value.culturalRoot), territoryDistrictIds: splitList(value.territoryDistrictIds), headquartersPoiIds: splitList(value.headquartersPoiIds), coreBusiness: splitList(value.coreBusiness), allies: splitList(value.allies), enemies: splitList(value.enemies), visualKeywords: splitList(value.visualKeywords), missionTypes: splitList(value.missionTypes) };
  if (type === 'districts') return { ...base, districtType: scalar(value.districtType), realWorldReference: scalar(value.realWorldReference), atmosphere: splitList(value.atmosphere), dominantFactions: splitList(value.dominantFactions), keyPoiIds: splitList(value.keyPoiIds), storyUsage: splitList(value.storyUsage), gameplayUsage: splitList(value.gameplayUsage), districtStatus: scalar(value.districtStatus) };
  if (type === 'pois') return { ...base, districtId: scalar(value.districtId), poiType: scalar(value.poiType), poiTier: scalar(value.poiTier) || 'landmark', realWorldReference: scalar(value.realWorldReference), addressReference: scalar(value.addressReference || value.location), location: scalar(value.location), function: scalar(value.function), owner: scalar(value.owner), gameplayUsage: splitList(value.gameplayUsage), storyUsage: splitList(value.storyUsage) };
  if (type === 'design-assets') return { ...base, designAssetType: scalar(value.designAssetType) || 'other', visualKeywords: splitList(value.visualKeywords) };
  return { ...base, storylineType: scalar(value.storylineType) || 'side', background: scalar(value.background), timeline: scalar(value.timeline), act: scalar(value.act), relatedPlayableCharacters: splitList(value.relatedPlayableCharacters), relatedBosses: splitList(value.relatedBosses), mainConflict: scalar(value.mainConflict || value.coreConflict), playerGoal: scalar(value.playerGoal), endingState: scalar(value.endingState), endings: splitList(value.endings), dialogueText: scalar(value.dialogueText), timelinePlacement: scalar(value.timelinePlacement), pitchStatus: scalar(value.pitchStatus) || 'under_review' };
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
  rowNumber: asset.rowNumber,
  sourceRowPreview: asset.sourceRowPreview,
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
  if (!rows.length) throw new Error('CSV file is empty.');
  const headers = rows[0] || [];
  if (!headers.length || headers.every((header) => !String(header).trim())) throw new Error('CSV file is empty.');
  const dataRows = rows.slice(1).filter((cells) => cells.some((cell) => String(cell ?? '').trim()));
  return {
    kind: 'sheet',
    headers,
    rowCount: dataRows.length,
    rows: dataRows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))),
    previewRows: dataRows.slice(0, 10),
  };
};

const parseXlsx = (fullPath) => {
  let workbook;
  try { workbook = xlsx.readFile(fullPath); }
  catch (error) { throw new Error(`Failed to parse XLSX file: ${error instanceof Error ? error.message : 'Invalid workbook.'}`); }
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error('No worksheet found in this XLSX file.');
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error('No worksheet found in this XLSX file.');
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (!matrix.length) throw new Error('Worksheet is empty.');
  const headers = (matrix[0] || []).map((value) => String(value).trim());
  if (!headers.length || headers.every((header) => !header)) throw new Error('Worksheet is empty.');
  const dataRows = matrix.slice(1).filter((cells) => cells.some((cell) => String(cell ?? '').trim()));
  return {
    kind: 'sheet',
    sheetName,
    headers,
    rowCount: dataRows.length,
    rows: dataRows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))),
    previewRows: dataRows.slice(0, 10).map((cells) => headers.map((_header, index) => String(cells[index] ?? ''))),
  };
};

const normalizeHeader = (header = '') => String(header).trim().toLowerCase().replace(/[\s_-]/g, '');
const headerMatches = (header, candidates) => {
  const normalized = normalizeHeader(header);
  return candidates.some((candidate) => normalized === normalizeHeader(candidate));
};

const guessField = (header = '', targetType) => {
  if (headerMatches(header, ['name','Name','名称','角色名','姓名','帮派名','区域名','点位名','剧情名','title'])) return 'name';
  if (headerMatches(header, ['chineseName','Chinese Name','中文名','中文'])) return 'chineseName';
  if (headerMatches(header, ['englishName','English Name','英文名','英文'])) return 'englishName';
  if (headerMatches(header, ['aliases','alias','别名'])) return 'aliases';
  if (headerMatches(header, ['summary','Summary','简介','概述','一句话简介','short description'])) return 'summary';
  if (headerMatches(header, ['details','Details','详情','设定','描述','正文','description'])) return 'details';
  if (headerMatches(header, ['tags','Tags','标签','关键词'])) return 'tags';
  if (headerMatches(header, ['status','状态'])) return 'status';
  if (headerMatches(header, ['spoilerLevel','spoiler','保密等级','剧透等级'])) return 'spoilerLevel';
  if (headerMatches(header, ['characterType','角色类型','人物类型'])) return 'characterType';
  if (headerMatches(header, ['faction','factionId','所属帮派','关联帮派','帮派'])) return targetType === 'characters' ? 'factionId' : 'relatedFactionIds';
  if (headerMatches(header, ['district','districtId','所属区域','关联区域','区域'])) return targetType === 'characters' || targetType === 'pois' ? 'districtId' : 'relatedDistrictIds';
  if (headerMatches(header, ['occupation','职业'])) return 'occupation';
  if (headerMatches(header, ['weapon','武器'])) return 'weapon';
  if (headerMatches(header, ['characterArc','角色弧光','人物弧光'])) return 'characterArc';
  if (headerMatches(header, ['currentTimelineStatus','时间线状态','当前状态'])) return 'currentTimelineStatus';
  if (headerMatches(header, ['narrativeConstraints','叙事限制','限制'])) return 'narrativeConstraints';
  if (headerMatches(header, ['doNotRevealYet','暂不透露'])) return 'doNotRevealYet';
  if (headerMatches(header, ['sourceNotes','来源','备注','notes'])) return 'sourceNotes';
  const h = normalizeHeader(header);
  if (h.includes('gender') || h.includes('性别')) return 'gender';
  if (h.includes('age') || h.includes('年龄')) return 'age';
  if (h.includes('cultural') || h.includes('文化')) return 'culturalRoot';
  if (h.includes('business') || h.includes('生意')) return 'coreBusiness';
  if (h.includes('allies') || h.includes('盟友')) return 'allies';
  if (h.includes('enemies') || h.includes('敌人')) return 'enemies';
  if (h.includes('atmosphere') || h.includes('氛围')) return 'atmosphere';
  if (h.includes('storyusage') || h.includes('剧情用途')) return 'storyUsage';
  if (h.includes('gameplay') || h.includes('玩法')) return 'gameplayUsage';
  return '';
};

const rowsToDrafts = (rows, mapping, targetType, file, parserMode) => rows.map((row, index) => {
  const asset = {};
  for (const [header, field] of Object.entries(mapping || {})) {
    if (!field || field === '__ignore') continue;
    asset[field] = arrayFields.has(field) ? splitList(row[header]) : row[header];
  }
  const rowNumber = index + 2;
  if (!scalar(asset.name) && !scalar(asset.chineseName) && !scalar(asset.englishName)) asset.name = cleanName(`${file.name} Row ${rowNumber}`);
  if (!scalar(asset.name)) asset.name = scalar(asset.chineseName) || scalar(asset.englishName) || cleanName(`${file.name} Row ${rowNumber}`);
  asset.sourceNotes = [...splitList(asset.sourceNotes), `Imported from sheet evidence: ${file.name}`];
  asset.rowNumber = rowNumber;
  asset.sourceRowPreview = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, scalar(value)]));
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

const createBackup = async () => createMaintenanceBackup('backup-before-import');

const fileDraft = async (draft, { mergeIntoId } = {}) => {
  if (!assetTypes.includes(draft.targetType)) throw new Error(`Unknown target type: ${draft.targetType}`);
  const filePath = path.join(dataDir, assetFiles[draft.targetType]);
  const records = await readJsonArray(filePath);
  const sourceUpload = await findUpload(draft.sourceFileId);
  const sourceIsImage = Boolean(sourceUpload && ((sourceUpload.type || '').startsWith('image/') || sourceUpload.folder === 'images'));
  const asset = normalizeAsset(draft.targetType, { ...draft.asset, primaryEvidenceId: sourceIsImage ? (draft.asset?.primaryEvidenceId || sourceUpload.id || sourceUpload.filename) : draft.asset?.primaryEvidenceId });
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
    if (['.csv','.xlsx','.xls'].includes(ext) || mode.includes('Sheet')) {
      let table;
      const content = inlineText(body);
      if (!content && !await fileExists(fullPath)) { response.status = 'failed'; response.message = 'Uploaded sheet file is not available on disk.'; return res.json(response); }
      try {
        if (ext === '.csv' || content) table = parseCsv(content ?? await fs.readFile(fullPath, 'utf8'));
        else table = parseXlsx(fullPath);
      } catch (error) {
        response.status = 'failed'; response.message = error instanceof Error ? error.message : 'Failed to parse sheet file.'; return res.json(response);
      }
      const targetType = draftTargetType(body.targetType, targetTypeFromMode(mode));
      const guessedMapping = Object.fromEntries(table.headers.map((header) => [header, guessField(header, targetType)]));
      const mapping = body.mapping && Object.keys(body.mapping).length ? body.mapping : guessedMapping;
      response.preview = { kind: 'sheet', sheetName: table.sheetName, headers: table.headers, rows: table.previewRows, rowCount: table.rowCount, guessedMapping, mapping };
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
router.post('/drafts/:id/file', async (req, res, next) => { try { const drafts = await readDrafts(); const index = drafts.findIndex((draft) => draft.id === req.params.id); if (index === -1) return res.status(404).json({ error: `Draft not found: ${req.params.id}` }); const backup = await createBackup(); const asset = await fileDraft(drafts[index], req.body); drafts[index] = { ...drafts[index], status: req.body?.mergeIntoId ? 'merged' : 'filed', filedAssetId: asset.id, updatedAt: nowStamp() }; await writeDrafts(drafts); const history = await addImportHistory({ sourceFileId: drafts[index].sourceFileId, sourceFileName: drafts[index].sourceFileName, sourceFilePath: drafts[index].sourceFilePath, parserMode: drafts[index].parserMode, targetType: drafts[index].targetType, filedAssetIds: [asset.id], filedAssetNames: [asset.name], filedCount: 1, backupFileName: backup.filename, notes: req.body?.mergeIntoId ? 'Merged with existing dossier' : '' }); res.json({ draft: drafts[index], asset, backup, history }); } catch (error) { next(error); } });
router.post('/drafts/file-batch', async (req, res, next) => { try { const ids = Array.isArray(req.body?.ids) ? req.body.ids : []; const skipDuplicateIds = Array.isArray(req.body?.skipDuplicateIds) ? req.body.skipDuplicateIds : []; const finalIds = ids.filter((id) => !skipDuplicateIds.includes(id)); if (!finalIds.length) return res.status(400).json({ error: 'No draft ids supplied.' }); let backup; try { backup = await createBackup(); } catch (error) { return res.status(500).json({ error: 'Backup failed. Batch filing aborted.' }); } const drafts = await readDrafts(); const filed = []; const sourceNames = new Set(); for (const id of finalIds) { const draft = drafts.find((item) => item.id === id); if (!draft || draft.status === 'filed' || draft.status === 'rejected' || draft.status === 'merged') continue; const asset = await fileDraft(draft); draft.status = 'filed'; draft.filedAssetId = asset.id; draft.updatedAt = nowStamp(); filed.push(asset); sourceNames.add(draft.sourceFileName); } await writeDrafts(drafts); const filedDrafts = drafts.filter((d) => finalIds.includes(d.id) && d.filedAssetId); const history = await addImportHistory({ sourceFileId: unique(filedDrafts.map((d) => d.sourceFileId)).join(', '), sourceFileName: unique(filedDrafts.map((d) => d.sourceFileName)).join(', '), sourceFilePath: unique(filedDrafts.map((d) => d.sourceFilePath)).join(', '), parserMode: unique(filedDrafts.map((d) => d.parserMode)).join(', '), targetType: unique(filedDrafts.map((d) => d.targetType)).join(', '), filedAssetIds: filed.map((asset) => asset.id), filedAssetNames: filed.map((asset) => asset.name), filedCount: filed.length, backupFileName: backup.filename, status: filed.length === finalIds.length ? 'completed' : 'partially_completed' }); res.json({ backup, filed, history }); } catch (error) { next(error); } });

router.post('/preflight', async (req, res, next) => { try { const ids = Array.isArray(req.body?.ids) ? req.body.ids : []; const drafts = (await readDrafts()).filter((draft) => ids.includes(draft.id) && draft.status === 'needs_review'); const assetsByType = {}; for (const type of assetTypes) assetsByType[type] = await readJsonArray(path.join(dataDir, assetFiles[type])); const normalizeName = (asset = {}) => String(asset.name || asset.chineseName || asset.englishName || '').trim().toLowerCase(); const duplicateDraftIds = []; let missingNameCount = 0; let evidenceBindings = 0; const targets = Object.fromEntries(assetTypes.map((type) => [type, { fileName: assetFiles[type], existingCount: assetsByType[type].length, draftCount: 0 }])); for (const draft of drafts) { targets[draft.targetType].draftCount += 1; const name = normalizeName(draft.asset); if (!name) missingNameCount += 1; if (draft.sourceFileId) evidenceBindings += 1; if (assetsByType[draft.targetType].some((asset) => normalizeName(asset) && normalizeName(asset) === name)) duplicateDraftIds.push(draft.id); } const date = new Date(); const p = (n) => String(n).padStart(2, '0'); const backupPreview = `backup-before-import-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}.json`; res.json({ draftCount: drafts.length, targets, duplicateCount: duplicateDraftIds.length, duplicateDraftIds, missingNameCount, evidenceBindings, backupPreview, hasSourceFileName: drafts.some((draft) => Boolean(draft.sourceFileName)), noNameDraftIds: drafts.filter((draft) => !normalizeName(draft.asset)).map((draft) => draft.id), severe: missingNameCount > 0 }); } catch (error) { next(error); } });
router.post('/drafts/clean', async (req, res, next) => { try { const mode = req.body?.mode || 'rejected'; const sourceFileName = String(req.body?.sourceFileName || ''); const withBackup = req.body?.withBackup !== false; const backup = withBackup ? await createMaintenanceBackup('backup-before-draft-clean') : undefined; const drafts = await readDrafts(); const shouldClean = (draft) => mode === 'all' || (mode === 'rejected' && draft.status === 'rejected') || (mode === 'filed' && (draft.status === 'filed' || draft.status === 'merged')) || (mode === 'source' && draft.sourceFileName === sourceFileName) || (mode === 'projectx_test' && String(draft.sourceFileName || '').toLowerCase().includes('projectx_test')); const nextDrafts = drafts.filter((draft) => !shouldClean(draft)); await writeDrafts(nextDrafts); res.json({ backup, removed: drafts.length - nextDrafts.length, remaining: nextDrafts.length }); } catch (error) { next(error); } });

router.post('/backup', async (_req, res, next) => { try { res.json(await createBackup()); } catch (error) { next(error); } });

await ensureJsonArrayFile(draftsPath);
await fs.mkdir(backupsDir, { recursive: true });

export default router;
