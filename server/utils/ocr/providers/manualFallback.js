export const provider = {
  id: 'manual-fallback',
  label: '手动粘贴',
  async available() { return true; },
  async status() { return { id: this.id, label: this.label, available: true, message: '可手动粘贴外部 OCR 文本' }; },
  async recognize() {
    return { providerId: this.id, engine: this.id, text: '', language: 'manual', warnings: ['请粘贴外部 OCR 文本后保存。'], error: '请粘贴外部 OCR 文本后保存。', manual: true };
  },
};
