import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import iconv from 'iconv-lite';
import { rootDir } from '../../paths.js';

const execFileAsync = promisify(execFile);
const defaultScriptPath = 'C:\\Users\\yinglong\\winocr_test.ps1';
const defaultLanguage = 'zh-Hans';
const timeoutMs = 30_000;
const maxOutputBytes = 1024 * 1024;

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
const config = async () => {
  const env = await readEnvFile();
  return {
    scriptPath: process.env.WINOCR_PS1 || env.WINOCR_PS1 || defaultScriptPath,
    language: process.env.WINOCR_LANG || env.WINOCR_LANG || defaultLanguage,
    command: process.env.WINOCR_COMMAND || env.WINOCR_COMMAND || 'powershell.exe',
  };
};
const normalizeText = (value = '') => String(value)
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map((line) => line.replace(/[ \t]+/g, ' ').replace(/\s*[:：=]\s*/g, '：').trim())
  .filter((line, index, lines) => line || (index > 0 && lines[index - 1].trim()))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
const replacementCharCount = (value) => (String(value).match(/�/g) || []).length;
const decodeOutputBuffer = (buffer) => {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  const utf8 = bytes.toString('utf8');
  const visibleLength = utf8.replace(/\s/g, '').length || 1;
  const replacementCount = replacementCharCount(utf8);
  if (replacementCount > 0 && (replacementCount >= 3 || replacementCount / visibleLength > 0.02)) {
    return iconv.decode(bytes, 'gbk');
  }
  return utf8;
};
const parseJsonOutput = (stdout) => {
  const output = String(stdout || '').replace(/^\uFEFF/, '').trim();
  if (!output) throw Object.assign(new Error('Windows OCR 未返回结果，请手动粘贴识别文本。'), { category: 'empty-output' });
  try { return JSON.parse(output); }
  catch (error) {
    const gbkOutput = iconv.decode(Buffer.from(stdout || ''), 'gbk').replace(/^\uFEFF/, '').trim();
    try { return JSON.parse(gbkOutput); }
    catch { throw Object.assign(new Error('Windows OCR 返回内容不是合法 JSON，请检查 PowerShell 脚本输出。'), { category: 'invalid-json', cause: error }); }
  }
};
const classifyPowerShellError = (error) => {
  if (error?.code === 'ENOENT') return '未检测到 powershell.exe，无法调用 Windows OCR，请手动粘贴识别文本。';
  if (error?.code === 'ETIMEDOUT' || error?.signal === 'SIGTERM') return 'Windows OCR 识别超时，请尝试更小或更清晰的图片，或手动粘贴识别文本。';
  const stderr = decodeOutputBuffer(error?.stderr).trim().slice(0, 500);
  return `Windows OCR 执行失败，请手动粘贴识别文本。${stderr ? ` PowerShell：${stderr}` : ''}`;
};

export const provider = {
  id: 'winocr-powershell',
  label: 'Windows OCR',
  async available() { return (await this.status()).available; },
  async status() {
    const { scriptPath, language, command } = await config();
    const exists = Boolean(scriptPath && await fileExists(scriptPath));
    return {
      id: this.id,
      label: this.label,
      available: exists,
      message: exists ? '已检测到 Windows OCR 脚本。' : '未配置 Windows OCR 脚本。',
      riskLevel: 'low',
      recommendedFor: ['中文', '截图', '设定图', '公司环境'],
      source: exists ? 'powershell' : 'none',
      mode: 'local',
      command,
      script: scriptPath,
      language,
    };
  },
  async recognize(imagePath) {
    const { scriptPath, language, command } = await config();
    if (!scriptPath || !await fileExists(scriptPath)) throw Object.assign(new Error('未配置 Windows OCR 脚本。请手动粘贴识别文本。'), { providerId: this.id, category: 'missing-script' });
    try {
      const { stdout } = await execFileAsync(command, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Path', imagePath, '-Lang', language], { encoding: 'buffer', timeout: timeoutMs, maxBuffer: maxOutputBytes, windowsHide: true });
      const body = parseJsonOutput(decodeOutputBuffer(stdout));
      const lines = Array.isArray(body?.lines) ? body.lines : [];
      const rawLineText = lines.map((line) => typeof line === 'string' ? line : line?.text).filter((line) => String(line || '').trim()).map(String).join('\n').trim();
      const providerRawText = String(body?.text || '').trim();
      const sourceOcrText = rawLineText || providerRawText;
      const cleanedText = normalizeText(sourceOcrText);
      const warnings = body?.error ? [`Windows OCR 返回错误：${String(body.error)}。请改用手动粘贴文本，当前截图证物已保留。`] : [];
      return { providerId: this.id, engine: 'Windows OCR', language, rawText: sourceOcrText, providerRawText, rawLineText, sourceOcrText, cleanedText, text: cleanedText || sourceOcrText, lines, warnings, error: body?.error ? String(body.error) : (cleanedText ? '' : '没有识别到文字，请手动粘贴识别文本。') };
    } catch (error) {
      if (error?.category) throw Object.assign(error, { providerId: this.id });
      throw Object.assign(new Error(classifyPowerShellError(error)), { providerId: this.id, category: error?.code === 'ENOENT' ? 'missing-engine' : error?.code === 'ETIMEDOUT' ? 'timeout' : 'failed' });
    }
  },
};
