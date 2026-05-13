import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { dataDir, intakeDraftsPath, ocrResultsPath, uploadFolders, uploadIndexPath } from '../utils/paths.js';
import { ensureJsonArrayFile, readJsonArray, writeJsonArray } from '../utils/jsonStore.js';

const router = Router();
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const maxOcrBytes = 10 * 1024 * 1024;
const now = () => new Date().toISOString();
const safeId = (value) => path.basename(String(value || ''));
const scalar = (value) => Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();
const splitList = (value) => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(/[;,，、|/\n\r]/).map((item) => item.trim()).filter(Boolean);
};

const designTypes = [
  { id: 'character', label: '角色', targetType: 'characters', defaults: { characterType: 'story_npc' } },
  { id: 'playable_hero', label: '可操控英雄', targetType: 'characters', defaults: { characterType: 'playable_hero' } },
  { id: 'protagonist', label: '主角', targetType: 'characters', defaults: { characterType: 'protagonist' } },
  { id: 'story_npc', label: '剧情人物', targetType: 'characters', defaults: { characterType: 'story_npc' } },
  { id: 'boss', label: 'Boss', targetType: 'characters', defaults: { characterType: 'boss' } },
  { id: 'faction', label: '帮派 / 组织', targetType: 'factions', defaults: {} },
  { id: 'storyline', label: '剧情线', targetType: 'storylines', defaults: { storylineType: 'main' } },
  { id: 'mission_script', label: '任务 / 剧本', targetType: 'storylines', defaults: { storylineType: 'side' } },
  { id: 'dialogue', label: '对话 / 台词', targetType: 'storylines', defaults: { storylineType: 'character' } },
  { id: 'event_case', label: '事件 / 案件', targetType: 'storylines', defaults: { storylineType: 'event' } },
  { id: 'district', label: '城市区域', targetType: 'districts', defaults: {} },
  { id: 'poi', label: 'POI / 地点', targetType: 'pois', defaults: { poiTier: 'landmark' } },
  { id: 'building', label: '建筑', targetType: 'pois', defaults: { poiTier: 'landmark' } },
  { id: 'interior_room', label: '室内空间 / 房间', targetType: 'pois', defaults: { poiTier: 'hideout' } },
  { id: 'level', label: '关卡', targetType: 'districts', defaults: { category: '关卡' } },
  { id: 'scene', label: '场景', targetType: 'districts', defaults: { category: '场景' } },
  { id: 'route_path', label: '路线 / 路径', targetType: 'design-assets', defaults: { designAssetType: 'mechanic' } },
  { id: 'safehouse', label: '安全屋', targetType: 'pois', defaults: { poiTier: 'safehouse' } },
  { id: 'shop', label: '商店 / 店铺', targetType: 'pois', defaults: { poiTier: 'business' } },
  { id: 'landmark', label: '地标', targetType: 'pois', defaults: { poiTier: 'landmark' } },
  { id: 'item', label: '道具 / 物件', targetType: 'design-assets', defaults: { designAssetType: 'item' } },
  { id: 'weapon', label: '武器', targetType: 'design-assets', defaults: { designAssetType: 'weapon' } },
  { id: 'vehicle', label: '载具', targetType: 'design-assets', defaults: { designAssetType: 'vehicle' } },
  { id: 'outfit', label: '服装 / 外观', targetType: 'design-assets', defaults: { designAssetType: 'outfit' } },
  { id: 'equipment', label: '装备', targetType: 'design-assets', defaults: { designAssetType: 'equipment' } },
  { id: 'consumable', label: '消耗品', targetType: 'design-assets', defaults: { designAssetType: 'item' } },
  { id: 'collectible', label: '收藏品', targetType: 'design-assets', defaults: { designAssetType: 'collectible' } },
  { id: 'clue_evidence', label: '线索 / 证据', targetType: 'design-assets', defaults: { designAssetType: 'clue' } },
  { id: 'currency_resource', label: '货币 / 资源', targetType: 'design-assets', defaults: { designAssetType: 'currency_resource' } },
  { id: 'skill', label: '技能 / 能力', targetType: 'design-assets', defaults: { designAssetType: 'skill' } },
  { id: 'company', label: '公司 / 企业', targetType: 'factions', defaults: { factionCategory: '公司 / 企业' } },
  { id: 'brand', label: '品牌', targetType: 'factions', defaults: { factionCategory: '品牌' } },
  { id: 'media', label: '媒体', targetType: 'factions', defaults: { factionCategory: '媒体' } },
  { id: 'law_agency', label: '政府 / 执法机构', targetType: 'factions', defaults: { factionCategory: '执法机构' } },
  { id: 'cult_secret', label: '宗教 / 邪教 / 秘密组织', targetType: 'factions', defaults: { factionCategory: '秘密组织' } },
  { id: 'family', label: '家族', targetType: 'factions', defaults: { factionCategory: '家族' } },
  { id: 'street_group', label: '街头团体', targetType: 'factions', defaults: { factionCategory: '街头团体' } },
  { id: 'crime_network', label: '犯罪网络', targetType: 'factions', defaults: { factionCategory: '犯罪网络' } },
  { id: 'underground_industry', label: '地下产业', targetType: 'factions', defaults: { factionCategory: '地下产业' } },
  { id: 'symbol', label: '文化符号 / 标志', targetType: 'design-assets', defaults: { designAssetType: 'art_reference' } },
  { id: 'art_reference', label: '美术风格参考', targetType: 'design-assets', defaults: { designAssetType: 'art_reference' } },
  { id: 'ui_setting', label: 'UI 设定', targetType: 'design-assets', defaults: { designAssetType: 'ui' } },
  { id: 'system_setting', label: '系统设定', targetType: 'design-assets', defaults: { designAssetType: 'mechanic' } },
  { id: 'gameplay_mechanic', label: '玩法机制', targetType: 'design-assets', defaults: { designAssetType: 'mechanic' } },
  { id: 'level_mechanic', label: '关卡机制', targetType: 'design-assets', defaults: { designAssetType: 'mechanic' } },
  { id: 'audio_music', label: '音频 / 音乐设定', targetType: 'design-assets', defaults: { designAssetType: 'audio' } },
  { id: 'animation_performance', label: '动画 / 表演设定', targetType: 'design-assets', defaults: { designAssetType: 'animation' } },
  { id: 'vfx', label: '视觉特效设定', targetType: 'design-assets', defaults: { designAssetType: 'vfx' } },
  { id: 'marketing', label: '营销 / 宣传文案', targetType: 'design-assets', defaults: { designAssetType: 'marketing' } },
  { id: 'other_design', label: '其他设计资料', targetType: 'design-assets', defaults: { designAssetType: 'other' } },
];

const typeById = new Map(designTypes.map((item) => [item.id, item]));
const fields = [
  ['name', ['姓名','名称','Name','title','标题']], ['chineseName', ['中文名']], ['englishName', ['英文名','English Name']], ['aliases', ['别名','Alias','Aliases']], ['summary', ['简介','概述','Summary','用途','功能']], ['details', ['详情','设定','人物小传','描述','Details','背景']], ['tags', ['标签','关键词','Tags']], ['status', ['状态']], ['spoilerLevel', ['保密等级','剧透等级']], ['sourceNotes', ['来源','备注','Source Notes']], ['gender', ['性别']], ['age', ['年龄']], ['nationality', ['国籍']], ['ethnicity', ['民族','族裔']], ['occupation', ['职业']], ['weapon', ['武器']], ['attribute', ['属性']], ['characterType', ['角色类型']], ['characterArc', ['人物弧光','角色弧光']], ['currentTimelineStatus', ['当前状态','时间线状态']], ['playableScripts', ['可用剧本']], ['factionCategory', ['帮派类型','组织类型']], ['culturalRoot', ['文化根源']], ['territoryDistrictIds', ['地盘','活动区域']], ['headquartersPoiIds', ['总部','据点']], ['coreBusiness', ['核心业务']], ['allies', ['盟友']], ['enemies', ['敌人']], ['visualKeywords', ['视觉关键词','外观','视觉']], ['missionTypes', ['任务类型']], ['districtType', ['区域类型']], ['atmosphere', ['氛围']], ['realWorldReference', ['现实参考']], ['dominantFactions', ['主导势力']], ['keyPoiIds', ['重要地点']], ['storyUsage', ['叙事用途','剧情用途']], ['poiType', ['地点类型']], ['districtId', ['所属区域']], ['location', ['地址','位置']], ['function', ['功能']], ['owner', ['经营者','所有人']], ['storylineType', ['类型']], ['playerGoal', ['玩家目标']], ['coreConflict', ['核心冲突']], ['endings', ['结局','分支']], ['designAssetType', ['物件类型','类型']], ['category', ['类别']],
];
const arrayFieldSet = new Set(['aliases','tags','sourceNotes','playableScripts','culturalRoot','territoryDistrictIds','headquartersPoiIds','coreBusiness','allies','enemies','visualKeywords','missionTypes','atmosphere','dominantFactions','keyPoiIds','storyUsage','relatedFactionIds','relatedDistrictIds','relatedPoiIds','relatedCharacterIds','relatedStorylineIds','endings']);
const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[\s:_：-]/g, '');
const keywordToField = (key) => fields.find(([, keys]) => keys.some((candidate) => normalizeKey(candidate) === normalizeKey(key)))?.[0] || '';
const extractPairs = (text) => {
  const pairs = [];
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const match = /^([^:：=]{1,28})\s*[:：=]\s*(.+)$/.exec(line);
    if (match) pairs.push({ key: match[1].trim(), value: match[2].trim(), line });
  }
  return { lines, pairs };
};
const normalizeAsset = (targetType, value = {}) => {
  const base = { id: '', name: scalar(value.name) || scalar(value.chineseName) || scalar(value.englishName) || '未命名 OCR 草稿', chineseName: scalar(value.chineseName), englishName: scalar(value.englishName) || scalar(value.name), aliases: splitList(value.aliases), category: scalar(value.category) || 'OCR 设计资料', summary: scalar(value.summary), details: scalar(value.details), tags: splitList(value.tags), status: scalar(value.status) || 'draft', spoilerLevel: scalar(value.spoilerLevel) || 'internal', relatedFactionIds: splitList(value.relatedFactionIds), relatedDistrictIds: splitList(value.relatedDistrictIds), relatedPoiIds: splitList(value.relatedPoiIds), relatedCharacterIds: splitList(value.relatedCharacterIds), relatedStorylineIds: splitList(value.relatedStorylineIds), narrativeConstraints: splitList(value.narrativeConstraints), doNotRevealYet: splitList(value.doNotRevealYet), sourceNotes: splitList(value.sourceNotes), primaryEvidenceId: scalar(value.primaryEvidenceId) };
  if (targetType === 'characters') return { ...base, characterType: scalar(value.characterType) || 'story_npc', gender: scalar(value.gender), age: scalar(value.age), nationality: scalar(value.nationality), ethnicity: scalar(value.ethnicity), occupation: scalar(value.occupation), factionId: scalar(value.factionId), districtId: scalar(value.districtId), weapon: scalar(value.weapon), attribute: scalar(value.attribute), playableScripts: splitList(value.playableScripts), characterArc: scalar(value.characterArc), currentTimelineStatus: scalar(value.currentTimelineStatus) };
  if (targetType === 'factions') return { ...base, factionCategory: scalar(value.factionCategory), culturalRoot: splitList(value.culturalRoot), territoryDistrictIds: splitList(value.territoryDistrictIds), headquartersPoiIds: splitList(value.headquartersPoiIds), coreBusiness: splitList(value.coreBusiness), allies: splitList(value.allies), enemies: splitList(value.enemies), visualKeywords: splitList(value.visualKeywords), missionTypes: splitList(value.missionTypes) };
  if (targetType === 'districts') return { ...base, realWorldReference: scalar(value.realWorldReference), atmosphere: splitList(value.atmosphere), dominantFactions: splitList(value.dominantFactions), keyPoiIds: splitList(value.keyPoiIds), storyUsage: splitList(value.storyUsage), gameplayUsage: splitList(value.gameplayUsage), districtStatus: scalar(value.districtStatus) };
  if (targetType === 'pois') return { ...base, districtId: scalar(value.districtId), poiTier: scalar(value.poiTier) || 'landmark', realWorldReference: scalar(value.realWorldReference), addressReference: scalar(value.addressReference || value.location), gameplayUsage: splitList(value.gameplayUsage || value.function), storyUsage: splitList(value.storyUsage) };
  if (targetType === 'design-assets') return { ...base, designAssetType: scalar(value.designAssetType) || 'other' };
  return { ...base, storylineType: scalar(value.storylineType) || 'side', act: scalar(value.act), mainConflict: scalar(value.mainConflict || value.coreConflict), playerGoal: scalar(value.playerGoal), endingState: scalar(value.endingState || value.endings), timelinePlacement: scalar(value.timelinePlacement), pitchStatus: scalar(value.pitchStatus) || 'under_review' };
};
const parseOcrText = ({ text, designType, file }) => {
  const config = typeById.get(designType) || typeById.get('other_design');
  const { lines, pairs } = extractPairs(text);
  const asset = { ...(config.defaults || {}) };
  const recognized = [];
  const unrecognized = [];
  for (const pair of pairs) {
    const field = keywordToField(pair.key);
    if (!field) { unrecognized.push(pair.line); continue; }
    asset[field] = arrayFieldSet.has(field) ? splitList(pair.value) : pair.value;
    recognized.push({ field, label: pair.key, value: pair.value });
  }
  const pairedLines = new Set(pairs.map((p) => p.line));
  unrecognized.push(...lines.filter((line) => !pairedLines.has(line)));
  if (!asset.name) asset.name = asset.chineseName || asset.englishName || path.basename(file.name || file.filename || 'OCR 草稿').replace(/\.[^.]+$/, '');
  if (!asset.summary) asset.summary = unrecognized.slice(0, 3).join('\n').slice(0, 240);
  if (!asset.details) asset.details = unrecognized.join('\n') || String(text || '').trim();
  asset.category = asset.category || config.label;
  asset.status = 'draft';
  asset.spoilerLevel = /机密|secret|classified/i.test(text) ? 'secret' : 'internal';
  asset.primaryEvidenceId = file.id || file.filename;
  asset.sourceNotes = [...splitList(asset.sourceNotes), `OCR 原文（需人工校对）:\n${String(text || '').trim()}`];
  return { targetType: config.targetType, asset: normalizeAsset(config.targetType, asset), recognizedFields: recognized, unrecognizedText: unrecognized.join('\n'), warnings: ['识别结果需要人工校对', 'OCR 结果不会直接入库，请在草稿区确认'] };
};
const readOcr = async () => { await ensureJsonArrayFile(ocrResultsPath); return readJsonArray(ocrResultsPath); };
const writeOcr = (records) => writeJsonArray(ocrResultsPath, records);
const findUpload = async (id) => (await readJsonArray(uploadIndexPath)).find((item) => item.id === id || item.filename === id);
const assertImage = async (file) => {
  if (!file) throw new Error('Upload not found.');
  const ext = path.extname(file.name || file.filename || '').toLowerCase();
  if (!imageExtensions.has(ext) && !(file.type || '').startsWith('image/')) throw new Error('当前文件不是图片，无法 OCR。');
  if (!imageExtensions.has(ext)) throw new Error('当前文件不是图片，无法 OCR。');
  const filePath = path.join(uploadFolders[file.folder || 'images'], file.filename);
  const stat = await fs.stat(filePath).catch(() => undefined);
  if (!stat) throw new Error('图片文件不存在，无法 OCR。');
  if (stat.size > maxOcrBytes) throw new Error('图片过大，请压缩后再识别。');
  return { filePath, stat };
};
const upsertOcr = async (record) => {
  const records = await readOcr();
  const index = records.findIndex((item) => item.sourceFileId === record.sourceFileId);
  const next = index >= 0 ? { ...records[index], ...record, updatedAt: now() } : { ...record, createdAt: now(), updatedAt: now() };
  if (index >= 0) records[index] = next; else records.unshift(next);
  await writeOcr(records);
  return next;
};
const syncUploadOcr = async (fileId, ocr) => {
  const uploads = await readJsonArray(uploadIndexPath);
  await writeJsonArray(uploadIndexPath, uploads.map((item) => (item.id === fileId || item.filename === fileId) ? { ...item, ocr } : item));
};

router.get('/types', (_req, res) => res.json(designTypes));
router.get('/', async (_req, res, next) => { try { res.json(await readOcr()); } catch (error) { next(error); } });
router.get('/:fileId', async (req, res, next) => { try { const id = safeId(req.params.fileId); const records = await readOcr(); res.json(records.find((item) => item.sourceFileId === id) || { sourceFileId: id, status: 'none', text: '' }); } catch (error) { next(error); } });
router.put('/:fileId', async (req, res, next) => { try { const id = safeId(req.params.fileId); const file = await findUpload(id); const record = await upsertOcr({ sourceFileId: id, sourceFileName: file?.name || req.body?.sourceFileName || id, status: req.body?.status || 'manual', text: String(req.body?.text || ''), language: req.body?.language || 'chi_sim+eng', engine: req.body?.engine || 'manual', error: '' }); await syncUploadOcr(id, { status: record.status, text: record.text, language: record.language, engine: record.engine, updatedAt: record.updatedAt }); res.json(record); } catch (error) { next(error); } });
router.post('/run', async (req, res, next) => {
  try {
    const id = safeId(req.body?.fileId);
    const file = await findUpload(id);
    const { filePath } = await assertImage(file);
    const language = req.body?.language === 'eng' ? 'eng' : req.body?.language === 'chi_sim' ? 'chi_sim' : 'chi_sim+eng';
    await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status: 'processing', text: '', language, engine: 'tesseract.js' });
    let recognize;
    try { ({ recognize } = await import('tesseract.js')); }
    catch { const failed = await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status: 'failed', text: '', language, engine: 'unavailable', error: '本地 OCR 引擎不可用，请手动粘贴识别文本。' }); await syncUploadOcr(id, { status: failed.status, text: '', language, engine: 'unavailable', error: failed.error, updatedAt: failed.updatedAt }); return res.status(503).json(failed); }
    try {
      const result = await recognize(filePath, language);
      const text = String(result?.data?.text || '').trim();
      const confidence = Number(result?.data?.confidence || 0);
      const record = await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status: text ? 'done' : 'failed', text, language, confidence, engine: 'tesseract.js', error: text ? '' : '没有识别到文字。' });
      await syncUploadOcr(id, { status: record.status, text: record.text, language, confidence, engine: record.engine, error: record.error, updatedAt: record.updatedAt });
      if (!text) return res.status(422).json(record);
      res.json(record);
    } catch {
      const failed = await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status: 'failed', text: '', language, engine: 'tesseract.js', error: 'OCR 识别失败，请尝试更清晰的图片。' });
      await syncUploadOcr(id, { status: failed.status, text: '', language, engine: failed.engine, error: failed.error, updatedAt: failed.updatedAt });
      res.status(500).json(failed);
    }
  } catch (error) { next(error); }
});
router.post('/draft', async (req, res, next) => {
  try {
    const id = safeId(req.body?.fileId);
    const file = await findUpload(id);
    if (!file) return res.status(404).json({ error: 'Upload not found.' });
    await assertImage(file);
    const text = String(req.body?.text || (await readOcr()).find((item) => item.sourceFileId === id)?.text || '').trim();
    if (!text) return res.status(400).json({ error: '请先保存识别文本。' });
    const designType = String(req.body?.designType || 'other_design');
    if (!typeById.has(designType)) return res.status(400).json({ error: '请选择资料类型。' });
    const parsed = parseOcrText({ text, designType, file });
    const draft = { id: `draft-${crypto.randomUUID()}`, targetType: parsed.targetType, asset: parsed.asset, sourceFileId: file.id, sourceFileName: file.name, sourceFilePath: `uploads/${file.folder}/${file.filename}`, parserMode: 'Image OCR', status: 'needs_review', createdAt: now(), updatedAt: now(), ocrText: text, ocrPreview: { recognizedFields: parsed.recognizedFields, unrecognizedText: parsed.unrecognizedText, warnings: parsed.warnings } };
    await ensureJsonArrayFile(intakeDraftsPath);
    await writeJsonArray(intakeDraftsPath, [draft, ...(await readJsonArray(intakeDraftsPath))]);
    res.status(201).json({ draft, ...parsed });
  } catch (error) { next(error); }
});

await ensureJsonArrayFile(ocrResultsPath);
export default router;
