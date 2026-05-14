import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { rootDir } from '../../paths.js';

const execFileAsync = promisify(execFile);
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
  return { cmd: process.env.PADDLEOCR_CMD || env.PADDLEOCR_CMD || '', script: process.env.PADDLEOCR_SCRIPT || env.PADDLEOCR_SCRIPT || '' };
};
const fileExists = async (filePath) => Boolean(await fs.stat(filePath).catch(() => undefined));
const paddleLanguage = (language) => language === 'eng' ? 'en' : 'ch';

export const provider = {
  id: 'paddleocr-cli',
  label: 'PaddleOCR 命令行',
  async available() { return (await this.status()).available; },
  async status() {
    const { cmd, script } = await config();
    if (!cmd || !script) return { id: this.id, label: this.label, available: false, message: '未配置 PADDLEOCR_CMD / PADDLEOCR_SCRIPT，未检测到 PaddleOCR 命令行' };
    if (!await fileExists(script)) return { id: this.id, label: this.label, available: false, message: '未检测到 PaddleOCR 命令行脚本', command: cmd, script };
    return { id: this.id, label: this.label, available: true, message: `已配置 PaddleOCR 命令行：${cmd} ${script}`, command: cmd, script };
  },
  async recognize(imagePath, options = {}) {
    const status = await this.status();
    if (!status.available) throw Object.assign(new Error(status.message), { providerId: this.id, category: 'missing-engine' });
    try {
      const { stdout } = await execFileAsync(status.command, [status.script, imagePath, '--lang', paddleLanguage(options.language || 'auto')], { timeout: 45_000, maxBuffer: 20 * 1024 * 1024, windowsHide: true });
      const body = JSON.parse(String(stdout || '{}'));
      const text = String(body.text || (Array.isArray(body.lines) ? body.lines.map((line) => line?.text).filter(Boolean).join('\n') : '')).trim();
      return { providerId: this.id, engine: this.id, text, language: options.language || 'auto', confidence: undefined, lines: Array.isArray(body.lines) ? body.lines : [], warnings: [], error: text ? '' : '没有识别到文字，请尝试更清晰的图片，或手动粘贴文本。' };
    } catch (error) {
      throw Object.assign(new Error(`PaddleOCR 命令行执行失败：${error?.message || String(error)}`), { providerId: this.id, category: error?.code === 'ENOENT' ? 'missing-engine' : 'failed' });
    }
  },
};
