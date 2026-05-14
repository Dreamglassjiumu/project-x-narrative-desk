import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Router } from 'express';
import { assetFiles, dataDir, intakeDraftsPath, ocrResultsPath, rootDir, uploadFolders, uploadIndexPath } from '../utils/paths.js';
import { ensureJsonArrayFile, readJsonArray, writeJsonArray } from '../utils/jsonStore.js';
import { getOcrProviderStatus, recognizeWithProviders } from '../utils/ocr/index.js';

const router = Router();
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const maxOcrBytes = 10 * 1024 * 1024;
const now = () => new Date().toISOString();
const execFileAsync = promisify(execFile);
const manualFallbackError = '未检测到本地 OCR 引擎，请手动粘贴识别文本。';
const missingLanguagePackError = '未检测到 OCR 语言包，请检查 tools/ocr/tesseract/tessdata。';
const missingChineseLanguagePackWarning = '未检测到简体中文语言包 chi_sim.traineddata，中文识别可能不可用。';
const missingChineseLanguagePackError = '缺少中文语言包，请改用英文识别或手动粘贴文本。';
const blockedError = 'OCR 程序无法运行，可能被系统权限或安全策略拦截。请手动粘贴识别文本。';
const timeoutError = 'OCR 识别超时，请尝试更小或更清晰的图片。';
const emptyTextError = '没有识别到文字，请尝试更清晰的图片，或手动粘贴文本。';
const chineseFallbackWarning = '中文语言包不可用，已尝试英文识别。';
const portableTesseractDir = path.join(rootDir, 'tools', 'ocr', 'tesseract');
const portableTesseractCmd = path.join(portableTesseractDir, 'tesseract.exe');
const portableTessdataDir = path.join(portableTesseractDir, 'tessdata');
const ocrTimeoutMs = 45_000;
const ocrTempDir = path.join(dataDir, 'tmp', 'ocr');
const preprocessModes = {
  original: { label: '使用原图' },
  grayscale: { label: '灰度识别', grayscale: true },
  contrast: { label: '提高对比度', contrast: true },
  scale2: { label: '放大 2 倍', scale: 2 },
  scale3: { label: '放大 3 倍', scale: 3 },
  gray_contrast_scale2: { label: '灰度 + 对比度 + 放大 2 倍', grayscale: true, contrast: true, scale: 2 },
  gray_contrast_scale3: { label: '灰度 + 对比度 + 放大 3 倍', grayscale: true, contrast: true, scale: 3 },
};
const psmModes = {
  auto: { label: '自动', value: 3 },
  block: { label: '单块文本', value: 6 },
  column: { label: '单列文本', value: 4 },
  line: { label: '单行文本', value: 7 },
  sparse: { label: '稀疏文本', value: 11 },
  card: { label: '表格/设定卡', value: 6 },
};
const ocrQualityHint = '识别结果可能不准确。建议尝试：放大 2 倍、提高对比度、选择中文模式，或手动粘贴文本。';
const ocrError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const safeId = (value) => path.basename(String(value || ''));
const scalar = (value) => Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();
const uniqueClean = (items) => [...new Set(items.map(String).map((item) => item.trim()).filter(Boolean))];
const splitList = (value) => {
  if (Array.isArray(value)) return uniqueClean(value);
  if (value === undefined || value === null || value === '') return [];
  return uniqueClean(String(value).split(/[;,，、；|/\n\r]/));
};

const fileExists = async (filePath) => Boolean(await fs.stat(filePath).catch(() => undefined));
const readEnvFile = async () => {
  const text = await fs.readFile(path.join(rootDir, '.env'), 'utf8').catch(() => '');
  return Object.fromEntries(text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const index = trimmed.indexOf('=');
    if (index < 0) return [];
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    return key ? [key, value] : [];
  }).filter((pair) => pair.length === 2));
};
const languageForRequest = (value, languages = []) => {
  const available = new Set(languages);
  if (value === 'eng') return 'eng';
  if (value === 'chi_sim') return 'chi_sim';
  if (value === 'auto') {
    if (available.has('chi_sim') && available.has('eng')) return 'chi_sim+eng';
    if (available.has('chi_sim')) return 'chi_sim';
    if (available.has('eng')) return 'eng';
    return 'eng';
  }
  if (value === 'chi_sim+eng') {
    if (available.has('chi_sim') && available.has('eng')) return 'chi_sim+eng';
    if (available.has('chi_sim')) return 'chi_sim';
    return 'eng';
  }
  if (available.has('chi_sim') && available.has('eng')) return 'chi_sim+eng';
  return available.has('chi_sim') ? 'chi_sim' : 'eng';
};
const languageFiles = (language) => [...new Set(language.split('+').filter(Boolean).map((name) => `${name}.traineddata`))];
const classifyOcrError = (error) => {
  const code = String(error?.code || '');
  const signal = String(error?.signal || '');
  const output = `${error?.message || ''}\n${error?.stderr || ''}`.toLowerCase();
  if (code === 'ENOENT') return { category: 'missing-engine', message: manualFallbackError };
  if (code === 'EACCES' || code === 'EPERM' || code === 'ENOEXEC' || output.includes('permission denied') || output.includes('not permitted') || output.includes('operation not permitted') || output.includes('cannot execute') || output.includes('bad cpu type')) return { category: 'blocked', message: blockedError };
  if (code === 'ETIMEDOUT' || signal === 'SIGTERM' || output.includes('timed out')) return { category: 'timeout', message: timeoutError };
  if (output.includes('error opening data file') || output.includes('failed loading language') || output.includes('could not initialize tesseract') || output.includes('tessdata') || output.includes('traineddata')) return { category: 'missing-language', message: missingLanguagePackError };
  return { category: 'failed', message: 'OCR 识别失败，请尝试更清晰的图片，或手动粘贴文本。' };
};
const engineStatusLabel = (engine, failure) => {
  if (failure?.category === 'blocked') return 'OCR 被系统拦截，可手动粘贴';
  if (!engine) return 'OCR 不可用，可手动粘贴';
  return engine.source === 'portable' ? '已检测到项目内 OCR' : '已检测到系统 OCR';
};
const checkedOcrPaths = ['tools/ocr/tesseract/tesseract.exe', 'TESSERACT_CMD', 'system PATH'];
const modeLabel = (source) => source === 'portable' ? 'portable' : source === 'env' ? 'env' : source === 'system' ? 'system' : 'manual';
const engineMessage = (engine, failure) => {
  if (failure?.category === 'blocked') return 'OCR 被系统拦截，可手动粘贴';
  if (!engine) return manualFallbackError;
  return engine.source === 'portable' ? '已检测到项目内 OCR。' : '已检测到系统 OCR。';
};
const listTessdataLanguages = async (tessdataDir) => {
  if (!tessdataDir) return [];
  const entries = await fs.readdir(tessdataDir).catch(() => []);
  return entries.filter((name) => name.endsWith('.traineddata')).map((name) => name.replace(/\.traineddata$/, '')).sort();
};
const listEngineLanguages = async (engine) => {
  const fromTessdata = await listTessdataLanguages(engine?.tessdataDir);
  if (fromTessdata.length || !engine?.command) return fromTessdata;
  try {
    const { stdout } = await execFileAsync(engine.command, ['--list-langs'], { timeout: 5000, windowsHide: true, env: { ...process.env, ...(engine.tessdataDir ? { TESSDATA_PREFIX: engine.tessdataDir } : {}) } });
    return String(stdout || '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.toLowerCase().includes('list of available languages')).sort();
  } catch {
    return [];
  }
};
const resolveOcrEngine = async () => {
  const env = await readEnvFile();
  const tessdataDir = process.env.TESSDATA_PREFIX || env.TESSDATA_PREFIX || '';
  const candidates = [];
  if (await fileExists(portableTesseractCmd)) candidates.push({ source: 'portable', command: portableTesseractCmd, tessdataDir: portableTessdataDir, name: 'tesseract-cli' });
  const envCommand = process.env.TESSERACT_CMD || env.TESSERACT_CMD;
  if (envCommand) candidates.push({ source: 'env', command: envCommand, tessdataDir, name: 'tesseract-cli' });
  candidates.push({ source: 'system', command: 'tesseract', tessdataDir, name: 'tesseract-cli' });

  let lastFailure;
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.command, ['--version'], { timeout: 5000, windowsHide: true, env: { ...process.env, ...(candidate.tessdataDir ? { TESSDATA_PREFIX: candidate.tessdataDir } : {}) } });
      return { engine: candidate, failure: null, statusLabel: engineStatusLabel(candidate) };
    } catch (error) {
      const failure = classifyOcrError(error);
      lastFailure = failure;
      if (failure.category === 'blocked') return { engine: candidate, failure, statusLabel: engineStatusLabel(candidate, failure) };
      if (candidate.source === 'system' && failure.category === 'missing-engine') continue;
    }
  }
  return { engine: null, failure: lastFailure || { category: 'missing-engine', message: manualFallbackError }, statusLabel: engineStatusLabel(null) };
};
const getOcrEngineStatus = async () => {
  const { engine, failure, statusLabel } = await resolveOcrEngine();
  const languages = engine && !failure ? await listEngineLanguages(engine) : [];
  const hasEnglish = languages.includes('eng');
  const hasChineseSimplified = languages.includes('chi_sim');
  const languageWarnings = hasChineseSimplified || !engine || failure ? [] : [missingChineseLanguagePackWarning];
  return {
    available: Boolean(engine && !failure),
    engine: engine && !failure ? 'tesseract-cli' : 'manual-fallback',
    mode: engine && !failure ? modeLabel(engine.source) : 'manual',
    source: engine && !failure ? engine.source : 'none',
    message: engineMessage(engine && !failure ? engine : null, failure),
    statusLabel,
    checkedPaths: checkedOcrPaths,
    portablePath: engine?.source === 'portable' && !failure ? engine.command : null,
    tessdataPath: engine?.tessdataDir && !failure ? engine.tessdataDir : null,
    languages,
    languageStatus: { eng: hasEnglish, chi_sim: hasChineseSimplified },
    languageWarnings,
    error: failure?.message || (!hasChineseSimplified && engine && !failure ? missingChineseLanguagePackWarning : '')
  };
};
const verifyLanguagePacks = async (engine, language) => {
  if (!engine?.tessdataDir) return true;
  const hasDir = await fileExists(engine.tessdataDir);
  if (!hasDir) return false;
  const checks = await Promise.all(languageFiles(language).map((file) => fileExists(path.join(engine.tessdataDir, file))));
  return checks.every(Boolean);
};
const runTesseract = async (engine, filePath, language, psmMode = 'block') => {
  const psm = psmModes[psmMode] || psmModes.block;
  const args = [filePath, 'stdout', '-l', language, '--psm', String(psm.value)];
  if (engine.tessdataDir) args.push('--tessdata-dir', engine.tessdataDir);
  const { stdout, stderr } = await execFileAsync(engine.command, args, { timeout: ocrTimeoutMs, maxBuffer: 20 * 1024 * 1024, windowsHide: true, env: { ...process.env, ...(engine.tessdataDir ? { TESSDATA_PREFIX: engine.tessdataDir } : {}) } });
  return { text: String(stdout || '').trim(), stderr: String(stderr || '') };
};

const tryPreprocessImage = async (filePath, modeKey) => {
  const mode = preprocessModes[modeKey] || preprocessModes.original;
  if (modeKey === 'original') return { filePath, preprocess: 'original', preprocessLabel: mode.label, tempFilePath: null, warning: '' };
  try {
    const { default: sharp } = await import('sharp');
    await fs.mkdir(ocrTempDir, { recursive: true });
    let pipeline = sharp(filePath, { limitInputPixels: false }).rotate();
    const metadata = await pipeline.metadata();
    if (mode.grayscale) pipeline = pipeline.grayscale();
    if (mode.contrast) pipeline = pipeline.normalize().linear(1.28, -16).sharpen({ sigma: 0.8 });
    if (mode.scale && metadata.width && metadata.height) {
      pipeline = pipeline.resize({ width: Math.round(metadata.width * mode.scale), height: Math.round(metadata.height * mode.scale), fit: 'fill', kernel: 'lanczos3' });
    }
    const tempFilePath = path.join(ocrTempDir, `${Date.now()}-${crypto.randomUUID()}.png`);
    await pipeline.png().toFile(tempFilePath);
    return { filePath: tempFilePath, preprocess: modeKey, preprocessLabel: mode.label, tempFilePath, warning: '' };
  } catch (error) {
    return { filePath, preprocess: 'original', preprocessLabel: `${mode.label}（处理失败，已使用原图）`, tempFilePath: null, warning: '图片预处理失败，已自动改用原图。' };
  }
};
const cleanupTempFile = async (tempFilePath) => {
  if (!tempFilePath) return;
  await fs.unlink(tempFilePath).catch(() => undefined);
};
const hasOcrQualityWarning = (text, requestedLanguage) => {
  const compact = String(text || '').replace(/\s+/g, '');
  if (compact.length < 5) return true;
  const han = compact.match(/[\p{Script=Han}]/gu)?.length || 0;
  const latin = compact.match(/[A-Za-z]/g)?.length || 0;
  const isolatedLatinLines = String(text || '').split(/\r?\n/).filter((line) => /^[A-Za-z]$/.test(line.trim())).length;
  const mojibake = compact.match(/[�□■�]|[\u0080-\u009f]/g)?.length || 0;
  if (requestedLanguage === 'chi_sim' && (latin > Math.max(12, han * 1.4) || han < 3)) return true;
  if (isolatedLatinLines >= 4) return true;
  if (mojibake >= 2) return true;
  return false;
};

const syncOcrFailure = async ({ id, file, language, preprocess, preprocessLabel, psmMode, psmLabel, engine, error, status = 'failed' }) => {
  const record = await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status, text: '', language, preprocess, preprocessLabel, psmMode, psmLabel, engine, error });
  await syncUploadOcr(id, { status: record.status, text: '', language, preprocess, preprocessLabel, psmMode, psmLabel, engine: record.engine, error: record.error, updatedAt: record.updatedAt });
  return record;
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
  details: ['详情','设定','描述','背景','人物小传','说明','获得方式','使用场景','Details','Description','流程','任务流程','台词','对话'],
  tags: ['标签','关键词','Tags','Keywords'],
  status: ['状态','Status'],
  spoilerLevel: ['保密等级','剧透等级','机密等级','Spoiler','Spoiler Level'],
  sourceNotes: ['来源','备注','来源备注','Source','Source Notes'],
  gender: ['性别'], age: ['年龄'], nationality: ['国籍'], ethnicity: ['民族','族裔'], occupation: ['职业'], weapon: ['武器'], attribute: ['属性'],
  characterType: ['角色类型','人物类型'], characterArc: ['人物弧光','角色弧光'], currentTimelineStatus: ['当前状态','时间线状态'],
  relatedFactionIds: ['所属帮派','所属组织','阵营','关联帮派','相关势力','关联势力','涉及帮派','涉及组织'],
  relatedDistrictIds: ['所属区域','活动区域','涉及区域'], relatedPoiIds: ['相关地点','常驻地点','涉及地点','关联地点'], relatedStorylineIds: ['相关剧情','可用剧本','登场剧本','关联剧情'], relatedCharacterIds: ['关系人','相关角色','涉及角色','登场角色','关联角色'],
  factionCategory: ['帮派类型','组织类型','类型'], culturalRoot: ['文化根源','文化背景'], territoryDistrictIds: ['地盘','活动区域','势力范围'], headquartersPoiIds: ['总部','据点','总部地点'], coreBusiness: ['核心业务','业务','产业'], allies: ['盟友'], enemies: ['敌人','对手'], visualKeywords: ['视觉关键词','视觉风格','外观','视觉'], missionTypes: ['任务类型','任务方向'],
  districtType: ['区域类型'], atmosphere: ['氛围'], realWorldReference: ['现实参考','原型'], dominantFactions: ['主导势力'], keyPoiIds: ['重要地点'], storyUsage: ['叙事用途','剧情用途'],
  poiType: ['地点类型','类型'], districtId: ['所属区域'], location: ['地址','位置'], function: ['功能','用途'], owner: ['经营者','所有人','控制者'],
  storylineType: ['剧情类型','任务类型','类型'], background: ['背景','故事背景'], playerGoal: ['玩家目标','目标'], coreConflict: ['核心冲突','冲突'], endings: ['结局','分支','结果'], dialogueText: ['台词','对话'],
  designAssetType: ['类型','物件类型','道具类型','武器类型','载具类型','设计资料类型'], category: ['类别','分类'], narrativeConstraints: ['叙事限制'], doNotRevealYet: ['暂不透露','不可提前透露'],
};
const arrayFieldSet = new Set(['aliases','tags','sourceNotes','culturalRoot','territoryDistrictIds','headquartersPoiIds','coreBusiness','allies','enemies','visualKeywords','missionTypes','atmosphere','dominantFactions','keyPoiIds','storyUsage','relatedFactionIds','relatedDistrictIds','relatedPoiIds','relatedCharacterIds','relatedStorylineIds','endings','narrativeConstraints','doNotRevealYet']);
const multiLineFields = new Set(['details','summary','sourceNotes','background','storyUsage','dialogueText']);
const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[\s:_：=\-\/]/g, '');
const keywordToField = (key, targetType = '') => {
  const normalized = normalizeKey(key);
  if (normalized === '类型') {
    if (targetType === 'pois') return 'poiType';
    if (targetType === 'design-assets') return 'designAssetType';
    if (targetType === 'storylines') return 'storylineType';
    if (targetType === 'districts') return 'districtType';
  }
  if ((normalized === '用途' || normalized === '功能') && targetType === 'design-assets') return 'summary';
  return Object.entries(fieldDefinitions).find(([, keys]) => keys.some((candidate) => normalizeKey(candidate) === normalized))?.[0] || '';
};
const isLikelyFieldKey = (value, targetType = '') => Boolean(keywordToField(value, targetType));
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
const extractPairs = (text, targetType = '') => {
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
    if (match && isLikelyFieldKey(match[1], targetType)) {
      commit();
      current = { key: match[1].trim(), values: [String(match[2] || '').trim()].filter(Boolean), lines: [line] };
      consumed.add(line);
      continue;
    }
    if (current && multiLineFields.has(keywordToField(current.key, targetType)) && !isLikelyFieldKey(line, targetType)) {
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
  const { lines, pairs, consumed } = extractPairs(text, config.targetType);
  const asset = { ...(config.defaults || {}) };
  const recognized = [];
  for (const pair of pairs) {
    const field = keywordToField(pair.key, config.targetType);
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
  const nameWasInferred = !asset.name && !asset.chineseName && !asset.englishName;
  if (!asset.name) asset.name = asset.chineseName || asset.englishName || path.basename(file.name || file.filename || 'OCR 草稿').replace(/\.[^.]+$/, '');
  const leftovers = unrecognized.join('\n').trim();
  if (!asset.summary && leftovers) asset.summary = leftovers.split(/\n/).slice(0, 2).join('\n').slice(0, 240);
  if (!asset.details) asset.details = [asset.background, asset.dialogueText, leftovers || String(text || '').trim()].filter(Boolean).join('\n');
  else if (leftovers && !String(asset.details).includes(leftovers)) asset.details = [asset.details, leftovers].filter(Boolean).join('\n');
  asset.category = asset.category || config.label;
  asset.status = 'draft';
  asset.primaryEvidenceId = file.id || file.filename;
  asset.sourceNotes = [...splitList(asset.sourceNotes), `Created from image OCR: ${file.name}`, 'OCR text reviewed by user'];
  const warnings = ['识别结果需要人工校对', 'OCR 结果不会直接入库，请在草稿区确认'];
  if (nameWasInferred) warnings.push('未识别到明确名称，已用文件名作为草稿名称，请确认。');
  return { targetType: config.targetType, targetFile: assetFiles[config.targetType] || `${config.targetType}.json`, asset: normalizeAsset(config.targetType, asset), recognizedFields: recognized, unrecognizedText: leftovers, sourceWillBecomePrimaryEvidence: Boolean(file?.id), sourceFileName: file.name, parserMode: 'Image OCR', warnings };
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

const buildRunFailure = (error) => ({ status: 'failed', engine: 'manual-fallback', error });

router.get('/status', async (_req, res, next) => {
  try { res.json(await getOcrProviderStatus()); }
  catch (error) { next(error); }
});
router.get('/types', (_req, res) => res.json(designTypes));
router.post('/run', async (req, res, next) => {
  let prepared;
  try {
    const id = safeId(req.body?.fileId);
    const file = await findUpload(id);
    const { filePath } = await assertImage(file);
    const requestedLanguage = String(req.body?.language || 'auto');
    const requestedPreprocess = preprocessModes[req.body?.preprocess] ? req.body.preprocess : 'original';
    const psmMode = psmModes[req.body?.psmMode] ? req.body.psmMode : 'block';
    const psmLabel = psmModes[psmMode].label;
    prepared = await tryPreprocessImage(filePath, requestedPreprocess);
    const preprocess = prepared.preprocess;
    const preprocessLabel = prepared.preprocessLabel;
    const requestedProvider = String(req.body?.provider || 'auto');
    const providerRun = await recognizeWithProviders(prepared.filePath, { language: requestedLanguage, psmMode, provider: requestedProvider });
    const { result, provider, selectedStatus, attempts } = providerRun;
    const language = result.language || requestedLanguage;
    const statusLabel = selectedStatus?.message || provider.label;
    const text = String(result.text || '').trim();

    if (provider.id === 'manual-fallback') {
      const failed = await syncOcrFailure({ id, file, language: requestedLanguage, preprocess, preprocessLabel, psmMode, psmLabel, engine: provider.id, error: result.error || manualFallbackError, status: 'manual_fallback' });
      return res.status(503).json({ ...buildRunFailure(failed.error), activeProvider: provider.id, providers: providerRun.status.providers, attempts });
    }

    const warnings = [
      prepared.warning,
      ...(result.warnings || []),
      provider.id === 'tesseract-cli' && language.includes('chi_sim') ? 'Tesseract 中文识别可能不稳定。复杂设定图建议使用 PaddleOCR 或粘贴外部 OCR 文本。' : '',
      text && hasOcrQualityWarning(text, requestedLanguage) ? ocrQualityHint : '',
    ].filter(Boolean);
    const record = await upsertOcr({ sourceFileId: id, sourceFileName: file.name, status: text ? 'done' : 'failed', text, language, requestedLanguage, preprocess, preprocessLabel, psmMode, psmLabel, confidence: result.confidence, engine: provider.id, activeProvider: provider.id, error: text ? (result.error || '') : (result.error || emptyTextError), engineStatus: statusLabel, qualityWarnings: warnings, lines: result.lines || [], providerAttempts: attempts });
    await syncUploadOcr(id, { status: record.status, text: record.text, language, preprocess, preprocessLabel, psmMode, psmLabel, confidence: record.confidence, engine: record.engine, activeProvider: provider.id, error: record.error, qualityWarnings: warnings, updatedAt: record.updatedAt });
    return res.json({ ...record, engineStatus: statusLabel, activeProvider: provider.id, providers: providerRun.status.providers });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode < 500) return res.status(statusCode).json({ status: 'failed', engine: error.providerId || 'manual-fallback', error: error.message || 'OCR 请求失败，请检查本地服务。' });
    next(error);
  } finally {
    await cleanupTempFile(prepared?.tempFilePath);
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


router.get('/', async (_req, res, next) => {
  try { res.json(await readOcr()); }
  catch (error) { next(error); }
});

router.put('/:fileId', async (req, res, next) => {
  try {
    const id = safeId(req.params.fileId);
    const file = await findUpload(id);
    const text = String(req.body?.text || '');
    const record = await upsertOcr({ sourceFileId: id, sourceFileName: file?.name || req.body?.sourceFileName || id, status: text.trim() ? 'manual' : 'none', text, language: req.body?.language || 'chi_sim+eng', engine: 'manual-fallback', activeProvider: 'manual-fallback', error: '' });
    await syncUploadOcr(id, { status: record.status, text: record.text, language: record.language, engine: record.engine, error: record.error, updatedAt: record.updatedAt });
    res.json(record);
  } catch (error) { next(error); }
});
router.get('/:fileId', async (req, res, next) => {
  try {
    const id = safeId(req.params.fileId);
    const records = await readOcr();
    res.json(records.find((item) => item.sourceFileId === id) || { sourceFileId: id, status: 'none', text: '' });
  } catch (error) { next(error); }
});
await ensureJsonArrayFile(ocrResultsPath);
export default router;
