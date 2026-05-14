import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { rootDir } from '../../paths.js';

const execFileAsync = promisify(execFile);
const portableTesseractDir = path.join(rootDir, 'tools', 'ocr', 'tesseract');
const portableTesseractCmd = path.join(portableTesseractDir, 'tesseract.exe');
const portableTessdataDir = path.join(portableTesseractDir, 'tessdata');
const ocrTimeoutMs = 45_000;
const missingLanguagePackError = '未检测到 OCR 语言包，请检查 tools/ocr/tesseract/tessdata。';
const missingChineseLanguagePackWarning = '未检测到简体中文语言包 chi_sim.traineddata，中文识别可能不可用。';
const chineseFallbackWarning = '中文语言包不可用，已尝试英文识别。';
const emptyTextError = '没有识别到文字，请尝试更清晰的图片，或手动粘贴文本。';
const blockedError = 'OCR 程序无法运行，可能被系统权限或安全策略拦截。请手动粘贴识别文本。';
const manualFallbackError = '未检测到本地 OCR 引擎，请手动粘贴识别文本。';

const fileExists = async (filePath) => Boolean(await fs.stat(filePath).catch(() => undefined));
const readEnvFile = async () => {
  const text = await fs.readFile(path.join(rootDir, '.env'), 'utf8').catch(() => '');
  return Object.fromEntries(text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const index = trimmed.indexOf('=');
    if (index < 0) return [];
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    return key ? [key, value] : [];
  }).filter((pair) => pair.length === 2));
};
const classifyOcrError = (error) => {
  const code = String(error?.code || '');
  const signal = String(error?.signal || '');
  const output = `${error?.message || ''}\n${error?.stderr || ''}`.toLowerCase();
  if (code === 'ENOENT') return { category: 'missing-engine', message: manualFallbackError };
  if (code === 'EACCES' || code === 'EPERM' || code === 'ENOEXEC' || output.includes('permission denied') || output.includes('not permitted') || output.includes('operation not permitted') || output.includes('cannot execute') || output.includes('bad cpu type')) return { category: 'blocked', message: blockedError };
  if (code === 'ETIMEDOUT' || signal === 'SIGTERM' || output.includes('timed out')) return { category: 'timeout', message: 'OCR 识别超时，请尝试更小或更清晰的图片。' };
  if (output.includes('error opening data file') || output.includes('failed loading language') || output.includes('could not initialize tesseract') || output.includes('tessdata') || output.includes('traineddata')) return { category: 'missing-language', message: missingLanguagePackError };
  return { category: 'failed', message: 'OCR 识别失败，请尝试更清晰的图片，或手动粘贴文本。' };
};
const listTessdataLanguages = async (tessdataDir) => {
  if (!tessdataDir) return [];
  const entries = await fs.readdir(tessdataDir).catch(() => []);
  return entries.filter((name) => name.endsWith('.traineddata')).map((name) => name.replace(/\.traineddata$/, '')).sort();
};
const languageFiles = (language) => [...new Set(language.split('+').filter(Boolean).map((name) => `${name}.traineddata`))];
const languageForRequest = (value, languages = []) => {
  const available = new Set(languages);
  if (value === 'eng') return 'eng';
  if (value === 'chi_sim') return 'chi_sim';
  if (value === 'auto' || value === 'chi_sim+eng') {
    if (available.has('chi_sim') && available.has('eng')) return 'chi_sim+eng';
    if (available.has('chi_sim')) return 'chi_sim';
    return 'eng';
  }
  if (available.has('chi_sim') && available.has('eng')) return 'chi_sim+eng';
  return available.has('chi_sim') ? 'chi_sim' : 'eng';
};
const psmValue = (psmMode) => ({ auto: 3, block: 6, column: 4, line: 7, sparse: 11, card: 6 }[psmMode] || 6);
const verifyLanguagePacks = async (engine, language) => {
  if (!engine?.tessdataDir) return true;
  if (!await fileExists(engine.tessdataDir)) return false;
  const checks = await Promise.all(languageFiles(language).map((file) => fileExists(path.join(engine.tessdataDir, file))));
  return checks.every(Boolean);
};
const runTesseract = async (engine, filePath, language, psmMode = 'block') => {
  const args = [filePath, 'stdout', '-l', language, '--psm', String(psmValue(psmMode))];
  if (engine.tessdataDir) args.push('--tessdata-dir', engine.tessdataDir);
  const { stdout, stderr } = await execFileAsync(engine.command, args, { timeout: ocrTimeoutMs, maxBuffer: 20 * 1024 * 1024, windowsHide: true, env: { ...process.env, ...(engine.tessdataDir ? { TESSDATA_PREFIX: engine.tessdataDir } : {}) } });
  return { text: String(stdout || '').trim(), stderr: String(stderr || '') };
};

export const provider = {
  id: 'tesseract-cli',
  label: 'Tesseract 便携版',
  async resolve() {
    const env = await readEnvFile();
    const tessdataDir = process.env.TESSDATA_PREFIX || env.TESSDATA_PREFIX || '';
    const candidates = [];
    if (await fileExists(portableTesseractCmd)) candidates.push({ source: 'portable', command: portableTesseractCmd, tessdataDir: portableTessdataDir });
    const envCommand = process.env.TESSERACT_CMD || env.TESSERACT_CMD;
    if (envCommand) candidates.push({ source: 'env', command: envCommand, tessdataDir });
    candidates.push({ source: 'system', command: 'tesseract', tessdataDir });
    let lastFailure;
    for (const candidate of candidates) {
      try {
        await execFileAsync(candidate.command, ['--version'], { timeout: 5000, windowsHide: true, env: { ...process.env, ...(candidate.tessdataDir ? { TESSDATA_PREFIX: candidate.tessdataDir } : {}) } });
        return { engine: { ...candidate, name: this.id }, failure: null };
      } catch (error) {
        const failure = classifyOcrError(error);
        lastFailure = failure;
        if (failure.category === 'blocked') return { engine: { ...candidate, name: this.id }, failure };
      }
    }
    return { engine: null, failure: lastFailure || { category: 'missing-engine', message: manualFallbackError } };
  },
  async languages(engine) {
    const fromTessdata = await listTessdataLanguages(engine?.tessdataDir);
    if (fromTessdata.length || !engine?.command) return fromTessdata;
    try {
      const { stdout } = await execFileAsync(engine.command, ['--list-langs'], { timeout: 5000, windowsHide: true, env: { ...process.env, ...(engine.tessdataDir ? { TESSDATA_PREFIX: engine.tessdataDir } : {}) } });
      return String(stdout || '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.toLowerCase().includes('list of available languages')).sort();
    } catch { return []; }
  },
  async available() { return (await this.status()).available; },
  async status() {
    const { engine, failure } = await this.resolve();
    const available = Boolean(engine && !failure);
    const languages = available ? await this.languages(engine) : [];
    const languageWarnings = available && !languages.includes('chi_sim') ? [missingChineseLanguagePackWarning] : [];
    return {
      id: this.id,
      label: this.label,
      available,
      message: available ? (engine.source === 'portable' ? '已检测到项目内 Tesseract。' : '已检测到系统 Tesseract。') : (failure?.message || manualFallbackError),
      source: available ? engine.source : 'none',
      mode: available ? engine.source : 'manual',
      checkedPaths: ['tools/ocr/tesseract/tesseract.exe', 'TESSERACT_CMD', 'system PATH'],
      portablePath: available && engine.source === 'portable' ? engine.command : null,
      tessdataPath: available && engine.tessdataDir ? engine.tessdataDir : null,
      languages,
      languageStatus: { eng: languages.includes('eng'), chi_sim: languages.includes('chi_sim') },
      languageWarnings,
      error: failure?.message || languageWarnings.join(' '),
    };
  },
  async recognize(imagePath, options = {}) {
    const { engine, failure } = await this.resolve();
    if (!engine || failure) throw Object.assign(new Error(failure?.message || manualFallbackError), { providerId: this.id, category: failure?.category || 'missing-engine' });
    const availableLanguages = await this.languages(engine);
    const language = languageForRequest(options.language || 'auto', availableLanguages);
    if (options.language === 'chi_sim' && !availableLanguages.includes('chi_sim')) throw Object.assign(new Error('缺少中文语言包，请改用英文识别或手动粘贴文本。'), { providerId: this.id, category: 'missing-language' });
    const run = async (lang) => {
      if (!await verifyLanguagePacks(engine, lang)) throw Object.assign(new Error(missingLanguagePackError), { providerId: this.id, category: 'missing-language' });
      return runTesseract(engine, imagePath, lang, options.psmMode);
    };
    try {
      const result = await run(language);
      return { providerId: this.id, engine: this.id, text: result.text, language, confidence: undefined, warnings: [], error: result.text ? '' : emptyTextError };
    } catch (error) {
      const classified = error.category ? error : classifyOcrError(error);
      if (language.includes('chi_sim') && !['blocked', 'timeout', 'missing-engine'].includes(classified.category) && await verifyLanguagePacks(engine, 'eng')) {
        const fallback = await runTesseract(engine, imagePath, 'eng', options.psmMode);
        return { providerId: this.id, engine: this.id, text: fallback.text, language: 'eng', confidence: undefined, warnings: [chineseFallbackWarning], error: fallback.text ? chineseFallbackWarning : emptyTextError };
      }
      throw Object.assign(new Error(classified.message || error.message), { providerId: this.id, category: classified.category || 'failed' });
    }
  },
};
