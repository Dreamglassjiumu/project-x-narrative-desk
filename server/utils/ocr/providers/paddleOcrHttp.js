import fs from 'node:fs/promises';
import path from 'node:path';
import { rootDir } from '../../paths.js';

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
const endpoint = async () => process.env.PADDLEOCR_URL || (await readEnvFile()).PADDLEOCR_URL || '';
const paddleLanguage = (language) => language === 'eng' ? 'en' : language === 'chi_sim' ? 'zh' : 'mixed';
const withTimeout = (ms) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
};

export const provider = {
  id: 'paddleocr-http',
  label: 'PaddleOCR 本地服务',
  async available() { return (await this.status()).available; },
  async status() {
    const url = await endpoint();
    if (!url) return { id: this.id, label: this.label, available: false, message: '未配置 PADDLEOCR_URL，未检测到 PaddleOCR 本地服务' };
    const timeout = withTimeout(1200);
    try {
      const response = await fetch(url, { method: 'OPTIONS', signal: timeout.signal }).catch(async (error) => {
        if (error?.name === 'AbortError') throw error;
        return fetch(url, { method: 'GET', signal: timeout.signal });
      });
      timeout.cancel();
      return { id: this.id, label: this.label, available: response.status < 500, message: response.status < 500 ? `已配置 PaddleOCR 本地服务：${url}` : '未检测到 PaddleOCR 本地服务', url };
    } catch (error) {
      timeout.cancel();
      return { id: this.id, label: this.label, available: false, message: '未检测到 PaddleOCR 本地服务', url, error: error?.message || String(error) };
    }
  },
  async recognize(imagePath, options = {}) {
    const url = await endpoint();
    if (!url) throw Object.assign(new Error('未配置 PADDLEOCR_URL，未检测到 PaddleOCR 本地服务'), { providerId: this.id, category: 'missing-engine' });
    const data = await fs.readFile(imagePath);
    const form = new FormData();
    form.append('image', new Blob([data]), path.basename(imagePath));
    form.append('language', paddleLanguage(options.language || 'auto'));
    const timeout = withTimeout(45_000);
    try {
      const response = await fetch(url, { method: 'POST', body: form, signal: timeout.signal });
      const bodyText = await response.text();
      if (!response.ok) throw new Error(bodyText || `HTTP ${response.status}`);
      const body = bodyText ? JSON.parse(bodyText) : {};
      const text = String(body.text || (Array.isArray(body.lines) ? body.lines.map((line) => line?.text).filter(Boolean).join('\n') : '')).trim();
      return { providerId: this.id, engine: this.id, text, language: options.language || 'auto', confidence: undefined, lines: Array.isArray(body.lines) ? body.lines : [], warnings: [], error: text ? '' : '没有识别到文字，请尝试更清晰的图片，或手动粘贴文本。' };
    } catch (error) {
      throw Object.assign(new Error(`PaddleOCR 本地服务调用失败：${error?.message || String(error)}`), { providerId: this.id, category: error?.name === 'AbortError' ? 'timeout' : 'failed' });
    } finally { timeout.cancel(); }
  },
};
