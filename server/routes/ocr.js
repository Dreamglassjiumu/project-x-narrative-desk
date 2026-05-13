import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { assetFiles, dataDir, intakeDraftsPath, ocrResultsPath, uploadFolders, uploadIndexPath } from '../utils/paths.js';
import { ensureJsonArrayFile, readJsonArray, writeJsonArray } from '../utils/jsonStore.js';

const router = Router();
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const maxOcrBytes = 10 * 1024 * 1024;
const now = () => new Date().toISOString();
const manualFallbackError = '本地 OCR 引擎不可用，请手动粘贴识别文本。';
const ocrError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
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
  { id: 'consumable', label: '消耗品', targetType: 'design-assets', defaults: { designAssetType: 'consumable' } },
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
const fieldDefinitions = {
  name: ['姓名','名字','名称','角色名','地点名','区域名','帮派名','组织名','物件名','武器名','载具名','Name','title','标题'],
  chineseName: ['中文名','中文名称','Chinese Name'],
  englishName: ['英文名','英文名称','English Name'],
  aliases: ['别名','代号','外号','Alias','Aliases'],
  summary: ['简介','概述','摘要','一句话简介','Summary'],
  details: ['详情','设定','描述','背景','人物小传','说明','Details','Description','流程','任务流程','台词','对话'],
  tags: ['标签','关键词','Tags','Keywords'],
  status: ['状态','Status'],
  spoilerLevel: ['保密等级','剧透等级','机密等级','Spoiler','Spoiler Level'],
  sourceNotes: ['来源','备注','来源备注','Source','Source Notes'],
  gender: ['性别'], age: ['年龄'], nationality: ['国籍'], ethnicity: ['民族','族裔'], occupation: ['职业'], weapon: ['武器'], attribute: ['属性'],
  characterType: ['角色类型','人物类型'], characterArc: ['人物弧光','角色弧光'], currentTimelineStatus: ['当前状态','时间线状态'],
  relatedFactionIds: ['所属帮派','所属组织','阵营','关联帮派','相关势力','涉及帮派','涉及组织'],
  relatedDistrictIds: ['所属区域','活动区域','涉及区域'], relatedPoiIds: ['相关地点','常驻地点','涉及地点'], relatedStorylineIds: ['相关剧情','可用剧本','登场剧本'], relatedCharacterIds: ['关系人','相关角色','涉及角色','登场角色','关联角色'],
  factionCategory: ['帮派类型','组织类型','类型'], culturalRoot: ['文化根源','文化背景'], territoryDistrictIds: ['地盘','活动区域','势力范围'], headquartersPoiIds: ['总部','据点','总部地点'], coreBusiness: ['核心业务','业务','产业'], allies: ['盟友'], enemies: ['敌人','对手'], visualKeywords: ['视觉关键词','视觉风格','外观','视觉'], missionTypes: ['任务类型','任务方向'],
  districtType: ['区域类型'], atmosphere: ['氛围'], realWorldReference: ['现实参考','原型'], dominantFactions: ['主导势力'], keyPoiIds: ['重要地点'], storyUsage: ['叙事用途','剧情用途'],
  poiType: ['地点类型','类型'], districtId: ['所属区域'], location: ['地址','位置'], function: ['功能','用途'], owner: ['经营者','所有人','控制者'],
  storylineType: ['剧情类型','任务类型','类型'], background: ['背景','故事背景'], playerGoal: ['玩家目标','目标'], coreConflict: ['核心冲突','冲突'], endings: ['结局','分支','结果'], dialogueText: ['台词','对话'],
  designAssetType: ['物件类型','设计资料类型','类型'], category: ['类别','分类'], narrativeConstraints: ['叙事限制'], doNotRevealYet: ['暂不透露','不可提前透露'],
};
const arrayFieldSet = new Set(['aliases','tags','sourceNotes','culturalRoot','territoryDistrictIds','headquartersPoiIds','coreBusiness','allies','enemies','visualKeywords','missionTypes','atmosphere','dominantFactions','keyPoiIds','storyUsage','relatedFactionIds','relatedDistrictIds','relatedPoiIds','relatedCharacterIds','relatedStorylineIds','endings','narrativeConstraints','doNotRevealYet']);
const multiLineFields = new Set(['details','summary','sourceNotes','background','storyUsage','dialogueText']);
const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[\s:_：=\-\/]/g, '');
const keywordToField = (key) => Object.entries(fieldDefinitions).find(([, keys]) => keys.some((candidate) => normalizeKey(candidate) === normalizeKey(key)))?.[0] || '';
const isLikelyFieldKey = (value) => Boolean(keywordToField(value));
const mapEnum = (field, raw, designType) => {
  const value = scalar(raw);
  const compact = normalizeKey(value);
  if (field === 'characterType') {
    if (/可操控英雄/.test(value)) return 'playable_hero';
    if (/主角/.test(value)) return 'protagonist';
    if (/剧情人物/.test(value)) return 'story_npc';
    if (/boss/i.test(value)) return 'boss';
    if (/帮派成员/.test(value)) return 'faction_member';
    if (/执法人员/.test(value)) return 'law_enforcement';
    if (/平民/.test(value)) return 'civilian';
  }
  if (field === 'designAssetType') {
    if (/物件|道具/.test(value)) return 'item';
    if (/武器/.test(value)) return 'weapon';
    if (/载具/.test(value)) return 'vehicle';
    if (/服装|外观/.test(value)) return 'outfit';
    if (/装备/.test(value)) return 'equipment';
    if (/消耗品/.test(value)) return 'consumable';
    if (/收藏品/.test(value)) return 'collectible';
    if (/线索/.test(value)) return 'clue';
    if (/证据/.test(value)) return 'evidence';
    if (/货币|资源/.test(value)) return 'currency_resource';
    if (/技能|能力/.test(value)) return 'skill';
    if (/ui|系统/i.test(value)) return 'ui';
    if (/玩法机制|机制/.test(value)) return 'mechanic';
    if (/美术参考|风格参考/.test(value)) return 'art_reference';
    if (/音频|音乐/.test(value)) return 'audio';
    if (/特效|vfx/i.test(value)) return 'vfx';
    if (/动画|表演/.test(value)) return 'animation';
    if (/宣传|营销/.test(value)) return 'marketing';
    if (/其他/.test(value)) return 'other';
  }
  if (field === 'spoilerLevel') {
    if (/classified|绝密/i.test(value)) return 'classified';
    if (/secret|机密/i.test(value)) return 'secret';
    if (/公开|public/i.test(value)) return 'public';
    return value || (designType === 'boss' ? 'secret' : 'internal');
  }
  if (field === 'storylineType') {
    if (/主线/.test(value)) return 'main';
    if (/支线|任务/.test(value)) return 'side';
    if (/角色/.test(value)) return 'character';
    if (/区域/.test(value)) return 'district';
    if (/帮派|组织/.test(value)) return 'faction';
    if (/序章/.test(value)) return 'prologue';
    if (/事件|案件/.test(value)) return 'event';
  }
  return compact ? value : '';
};
const appendValue = (asset, field, raw, designType) => {
  const mapped = mapEnum(field, raw, designType);
  if (arrayFieldSet.has(field)) asset[field] = [...splitList(asset[field]), ...splitList(mapped)];
  else if (field === 'districtId' && asset.relatedDistrictIds && !asset.districtId) asset[field] = scalar(mapped);
  else if (field === 'details' && asset.details) asset.details = [asset.details, scalar(mapped)].filter(Boolean).join('\n');
  else asset[field] = scalar(mapped);
};
const extractPairs = (text) => {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const pairs = [];
  const consumed = new Set();
  let current;
  const commit = () => {
    if (!current) return;
    pairs.push({ key: current.key, value: current.values.join('\n').trim(), line: current.lines.join('\n') });
    current = undefined;
  };
  for (const line of lines) {
    const explicit = /^([^:：=]{1,32})\s*[:：=]\s*(.*)$/.exec(line);
    const spaced = explicit ? undefined : /^([^\s]{2,16}|[A-Za-z][A-Za-z\s]{1,24})\s{2,}(.+)$/.exec(line);
    const match = explicit || spaced;
    if (match && isLikelyFieldKey(match[1])) {
      commit();
      current = { key: match[1].trim(), values: [String(match[2] || '').trim()].filter(Boolean), lines: [line] };
      consumed.add(line);
      continue;
    }
    if (current && multiLineFields.has(keywordToField(current.key)) && !isLikelyFieldKey(line)) {
      current.values.push(line);
      current.lines.push(line);
      consumed.add(line);
      continue;
    }
    commit();
  }
  commit();
  return { lines, pairs, consumed };
};
const normalizeAsset = (targetType, value = {}) => {
  const base = { id: '', name: scalar(value.name) || scalar(value.chineseName) || scalar(value.englishName) || '未命名 OCR 草稿', chineseName: scalar(value.chineseName), englishName: scalar(value.englishName) || scalar(value.name), aliases: splitList(value.aliases), category: scalar(value.category) || 'OCR 设计资料', summary: scalar(value.summary), details: scalar(value.details), tags: splitList(value.tags), status: scalar(value.status) || 'draft', spoilerLevel: scalar(value.spoilerLevel) || 'internal', relatedFactionIds: splitList(value.relatedFactionIds), relatedDistrictIds: splitList(value.relatedDistrictIds), relatedPoiIds: splitList(value.relatedPoiIds), relatedCharacterIds: splitList(value.relatedCharacterIds), relatedStorylineIds: splitList(value.relatedStorylineIds), narrativeConstraints: splitList(value.narrativeConstraints), doNotRevealYet: splitList(value.doNotRevealYet), sourceNotes: splitList(value.sourceNotes), primaryEvidenceId: scalar(value.primaryEvidenceId) };
  if (targetType === 'characters') return { ...base, characterType: scalar(value.characterType) || 'story_npc', gender: scalar(value.gender), age: scalar(value.age), nationality: scalar(value.nationality), ethnicity: scalar(value.ethnicity), occupation: scalar(value.occupation), factionId: scalar(value.factionId), districtId: scalar(value.districtId), weapon: scalar(value.weapon), attribute: scalar(value.attribute), playableScripts: splitList(value.playableScripts || value.relatedStorylineIds), characterArc: scalar(value.characterArc), currentTimelineStatus: scalar(value.currentTimelineStatus) };
  if (targetType === 'factions') return { ...base, factionCategory: scalar(value.factionCategory), culturalRoot: splitList(value.culturalRoot), territoryDistrictIds: splitList(value.territoryDistrictIds), headquartersPoiIds: splitList(value.headquartersPoiIds), coreBusiness: splitList(value.coreBusiness), allies: splitList(value.allies), enemies: splitList(value.enemies), visualKeywords: splitList(value.visualKeywords), missionTypes: splitList(value.missionTypes) };
  if (targetType === 'districts') return { ...base, districtType: scalar(value.districtType), realWorldReference: scalar(value.realWorldReference), atmosphere: splitList(value.atmosphere), dominantFactions: splitList(value.dominantFactions), keyPoiIds: splitList(value.keyPoiIds), storyUsage: splitList(value.storyUsage), gameplayUsage: splitList(value.gameplayUsage), districtStatus: scalar(value.districtStatus) };
  if (targetType === 'pois') return { ...base, districtId: scalar(value.districtId), poiType: scalar(value.poiType), poiTier: scalar(value.poiTier) || 'landmark', realWorldReference: scalar(value.realWorldReference), addressReference: scalar(value.addressReference || value.location), location: scalar(value.location), function: scalar(value.function), owner: scalar(value.owner), gameplayUsage: splitList(value.gameplayUsage || value.function), storyUsage: splitList(value.storyUsage) };
  if (targetType === 'design-assets') return { ...base, designAssetType: scalar(value.designAssetType) || 'other', visualKeywords: splitList(value.visualKeywords) };
  return { ...base, storylineType: scalar(value.storylineType) || 'side', background: scalar(value.background), timeline: scalar(value.timeline), act: scalar(value.act), relatedPlayableCharacters: splitList(value.relatedPlayableCharacters), relatedBosses: splitList(value.relatedBosses), mainConflict: scalar(value.mainConflict || value.coreConflict), playerGoal: scalar(value.playerGoal), endingState: scalar(value.endingState || value.endings), endings: splitList(value.endings), dialogueText: scalar(value.dialogueText), timelinePlacement: scalar(value.timelinePlacement), pitchStatus: scalar(value.pitchStatus) || 'under_review' };
};
const parseOcrText = ({ text, designType, file }) => {
  const config = typeById.get(designType) || typeById.get('other_design');
  const { lines, pairs, consumed } = extractPairs(text);
  const asset = { ...(config.defaults || {}) };
  const recognized = [];
  for (const pair of pairs) {
    const field = keywordToField(pair.key);
    if (!field) continue;
    appendValue(asset, field, pair.value, designType);
    recognized.push({ field, label: pair.key, value: pair.value });
  }
  const unrecognized = lines.filter((line) => !consumed.has(line));
  if (designType === 'boss') { asset.characterType = 'boss'; asset.spoilerLevel = asset.spoilerLevel || 'secret'; }
  if (designType === 'playable_hero') asset.characterType = 'playable_hero';
  if (/classified|绝密/i.test(text)) asset.spoilerLevel = 'classified';
  else if (/机密|secret/i.test(text) || designType === 'boss') asset.spoilerLevel = 'secret';
  else asset.spoilerLevel = asset.spoilerLevel || 'internal';
  if (!asset.name) asset.name = asset.chineseName || asset.englishName || path.basename(file.name || file.filename || 'OCR 草稿').replace(/\.[^.]+$/, '');
  const leftovers = unrecognized.join('\n').trim();
  if (!asset.summary && leftovers) asset.summary = leftovers.split(/\n/).slice(0, 2).join('\n').slice(0, 240);
  if (!asset.details) asset.details = [asset.background, asset.dialogueText, leftovers || String(text || '').trim()].filter(Boolean).join('\n');
  else if (leftovers && !String(asset.details).includes(leftovers)) asset.details = [asset.details, leftovers].filter(Boolean).join('\n');
  asset.category = asset.category || config.label;
  asset.status = 'draft';
  asset.primaryEvidenceId = file.id || file.filename;
  asset.sourceNotes = [...splitList(asset.sourceNotes), `Created from image OCR: ${file.name}`, 'OCR text reviewed by user'];
  return { targetType: config.targetType, targetFile: assetFiles[config.targetType] || `${config.targetType}.json`, asset: normalizeAsset(config.targetType, asset), recognizedFields: recognized, unrecognizedText: leftovers, sourceWillBecomePrimaryEvidence: Boolean(file?.id), warnings: ['识别结果需要人工校对', 'OCR 结果不会直接入库，请在草稿区确认'] };
};
const readOcr = async () => { await ensureJsonArrayFile(ocrResultsPath); return readJsonArray(ocrResultsPath); };
const writeOcr = (records) => writeJsonArray(ocrResultsPath, records);
const findUpload = async (id) => (await readJsonArray(uploadIndexPath)).find((item) => item.id === id || item.filename === id);
const assertImage = async (file) => {
  if (!file) throw ocrError(404, 'Upload not found.');
  const ext = path.extname(file.name || file.filename || '').toLowerCase();
  if (!imageExtensions.has(ext) && !(file.type || '').startsWith('image/')) throw ocrError(400, '当前文件不是图片，无法 OCR。');
  if (!imageExtensions.has(ext)) throw ocrError(400, '当前文件不是图片，无法 OCR。');
  const filePath = path.join(uploadFolders[file.folder || 'images'], file.filename);
  const stat = await fs.stat(filePath).catch(() => undefined);
  if (!stat) throw ocrError(404, '图片文件不存在，无法 OCR。');
  if (stat.size > maxOcrBytes) throw ocrError(400, '图片过大，请压缩后再识别。');
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
router.put('/:fileId', async (req, res, next) => { try { const id = safeId(req.params.fileId); const file = await findUpload(id); const text = String(req.body?.text || ''); const record = await upsertOcr({ sourceFileId: id, sourceFileName: file?.name || req.body?.sourceFileName || id, status: text.trim() ? 'manual' : 'none', text, language: req.body?.language || 'chi_sim+eng', engine: 'manual', error: '' }); await syncUploadOcr(id, { status: record.status, text: record.text, language: record.language, engine: record.engine, error: record.error, updatedAt: record.updatedAt }); res.json(record); } catch (error) { next(error); } });
router.post('/run', async (req, res, next) => {
  try {
    const id = safeId(req.body?.fileId);
    const file = await findUpload(id);
    const { filePath } = await assertImage(file);
    const requestedLanguage = String(req.body?.language || 'chi_sim+eng');
    const language = requestedLanguage === 'eng' ? 'eng' : requestedLanguage === 'chi_sim' ? 'chi_sim' : requestedLanguage === 'auto' ? 'chi_sim+eng' : 'chi_sim+eng';
    const preprocess = ['original', 'contrast', 'grayscale'].includes(req.body?.preprocess) ? req.body.preprocess : 'original';
    await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status: 'processing', text: '', language, preprocess, engine: 'tesseract' });
    const tesseractModule = await import('tesseract.js').catch(() => undefined);
    const recognize = tesseractModule?.recognize;
    if (!recognize) { const failed = await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status: 'failed', text: '', language, engine: 'manual-fallback', error: manualFallbackError }); await syncUploadOcr(id, { status: failed.status, text: '', language, engine: failed.engine, error: failed.error, updatedAt: failed.updatedAt }); return res.status(503).json({ status: 'failed', engine: 'manual-fallback', error: manualFallbackError }); }
    try {
      const result = await recognize(filePath, language);
      const text = String(result?.data?.text || '').trim();
      const confidence = Number(result?.data?.confidence || 0);
      const record = await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status: text ? 'done' : 'failed', text, language, preprocess, confidence: Math.max(0, Math.min(1, confidence / 100)), engine: 'tesseract', error: text ? '' : '没有识别到文字。' });
      await syncUploadOcr(id, { status: record.status, text: record.text, language, preprocess, confidence: record.confidence, engine: record.engine, error: record.error, updatedAt: record.updatedAt });
      if (!text) return res.status(422).json(record);
      res.json(record);
    } catch {
      const failed = await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status: 'failed', text: '', language, engine: 'tesseract', error: 'OCR 识别失败，请尝试更清晰的图片。' });
      await syncUploadOcr(id, { status: failed.status, text: '', language, engine: failed.engine, error: failed.error, updatedAt: failed.updatedAt });
      res.status(500).json(failed);
    }
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode < 500) return res.status(statusCode).json({ status: 'failed', engine: 'manual-fallback', error: error.message || 'OCR 请求失败，请检查本地服务。' });
    next(error);
  }
});
const previewOcrDraft = async (req, res, next) => {
  try {
    const id = safeId(req.body?.fileId);
    const file = await findUpload(id);
    if (!file) return res.status(404).json({ error: 'Upload not found.' });
    await assertImage(file);
    const text = String(req.body?.text || (await readOcr()).find((item) => item.sourceFileId === id)?.text || '').trim();
    if (!text) return res.status(400).json({ error: '请先输入识别文本。' });
    const designType = String(req.body?.designType || 'other_design');
    if (!typeById.has(designType)) return res.status(400).json({ error: '请选择资料类型。' });
    res.json(parseOcrText({ text, designType, file }));
  } catch (error) { next(error); }
};

router.post('/draft/preview', previewOcrDraft);
router.post('/draft', async (req, res, next) => {
  try {
    const id = safeId(req.body?.fileId);
    const file = await findUpload(id);
    if (!file) return res.status(404).json({ error: 'Upload not found.' });
    await assertImage(file);
    const text = String(req.body?.text || (await readOcr()).find((item) => item.sourceFileId === id)?.text || '').trim();
    if (!text) return res.status(400).json({ error: '请先输入识别文本。' });
    const designType = String(req.body?.designType || 'other_design');
    if (!typeById.has(designType)) return res.status(400).json({ error: '请选择资料类型。' });
    const parsed = parseOcrText({ text, designType, file });
    const draft = { id: `draft-${crypto.randomUUID()}`, targetType: parsed.targetType, asset: parsed.asset, sourceFileId: file.id, sourceFileName: file.name, sourceFilePath: `uploads/${file.folder}/${file.filename}`, parserMode: 'Image OCR', status: 'needs_review', createdAt: now(), updatedAt: now(), ocrText: text, sourceOcrText: text, ocrPreview: { recognizedFields: parsed.recognizedFields, unrecognizedText: parsed.unrecognizedText, targetFile: parsed.targetFile, sourceWillBecomePrimaryEvidence: parsed.sourceWillBecomePrimaryEvidence, warnings: parsed.warnings } };
    await ensureJsonArrayFile(intakeDraftsPath);
    await writeJsonArray(intakeDraftsPath, [draft, ...(await readJsonArray(intakeDraftsPath))]);
    res.status(201).json({ draft, ...parsed });
  } catch (error) { next(error); }
});

await ensureJsonArrayFile(ocrResultsPath);
export default router;
