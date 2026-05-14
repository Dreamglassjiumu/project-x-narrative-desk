import { provider as paddleOcrHttp } from './providers/paddleOcrHttp.js';
import { provider as paddleOcrCli } from './providers/paddleOcrCli.js';
import { provider as winOcrPowerShell } from './providers/winOcrPowerShell.js';
import { provider as tesseractCli } from './providers/tesseractCli.js';
import { provider as manualFallback } from './providers/manualFallback.js';

export const providers = [winOcrPowerShell, tesseractCli, manualFallback, paddleOcrHttp, paddleOcrCli];
export const providerIds = providers.map((provider) => provider.id);
const unavailableMessage = '该 OCR 引擎不可用，请检查配置或改用手动粘贴。';

export const getOcrProviderStatus = async () => {
  const statuses = await Promise.all(providers.map((provider) => provider.status().catch((error) => ({ id: provider.id, label: provider.label, available: false, message: error?.message || 'OCR 引擎状态检测失败' }))));
  const active = statuses.find((status) => status.available)?.id || 'manual-fallback';
  const tesseract = statuses.find((status) => status.id === 'tesseract-cli') || {};
  const winOcr = statuses.find((status) => status.id === 'winocr-powershell') || {};
  return {
    activeProvider: active,
    providers: statuses,
    available: active !== 'manual-fallback' || Boolean(statuses.find((status) => status.id === 'manual-fallback')?.available),
    engine: active,
    mode: active === 'tesseract-cli' ? (tesseract.mode || tesseract.source || 'portable') : active,
    source: active === 'tesseract-cli' ? (tesseract.source || 'none') : active === 'winocr-powershell' ? (winOcr.source || 'powershell') : active,
    message: statuses.find((status) => status.id === active)?.message || '可手动粘贴外部 OCR 文本',
    statusLabel: statuses.find((status) => status.id === active)?.message || 'OCR 可用',
    checkedPaths: tesseract.checkedPaths || [],
    portablePath: tesseract.portablePath || null,
    tessdataPath: tesseract.tessdataPath || null,
    languages: active === 'winocr-powershell' ? [winOcr.language || 'zh-Hans'] : (tesseract.languages || []),
    languageStatus: active === 'winocr-powershell' ? { eng: true, chi_sim: true } : (tesseract.languageStatus || { eng: false, chi_sim: false }),
    languageWarnings: tesseract.languageWarnings || [],
    error: tesseract.error || '',
  };
};

export const selectOcrProvider = async (requestedProvider = 'auto') => {
  const status = await getOcrProviderStatus();
  if (!requestedProvider || requestedProvider === 'auto') return { provider: providers.find((item) => item.id === status.activeProvider) || manualFallback, status, selectedStatus: status.providers.find((item) => item.id === status.activeProvider) };
  const provider = providers.find((item) => item.id === requestedProvider);
  const selectedStatus = status.providers.find((item) => item.id === requestedProvider);
  if (!provider || !selectedStatus?.available) throw Object.assign(new Error(unavailableMessage), { statusCode: 400, providerId: requestedProvider, providerStatus: selectedStatus });
  return { provider, status, selectedStatus };
};

export const recognizeWithProviders = async (imagePath, options = {}) => {
  const requestedProvider = options.provider || 'auto';
  if (requestedProvider && requestedProvider !== 'auto') {
    const { provider, status, selectedStatus } = await selectOcrProvider(requestedProvider);
    return { result: await provider.recognize(imagePath, options), provider, status, selectedStatus, attempts: [] };
  }
  const status = await getOcrProviderStatus();
  const attempts = [];
  for (const provider of providers) {
    const selectedStatus = status.providers.find((item) => item.id === provider.id);
    if (!selectedStatus?.available) { attempts.push({ providerId: provider.id, skipped: true, message: selectedStatus?.message || '不可用' }); continue; }
    try {
      const result = await provider.recognize(imagePath, options);
      return { result, provider, status, selectedStatus, attempts };
    } catch (error) {
      attempts.push({ providerId: provider.id, error: error?.message || String(error), category: error?.category || 'failed' });
    }
  }
  return { result: await manualFallback.recognize(imagePath, options), provider: manualFallback, status, selectedStatus: status.providers.find((item) => item.id === manualFallback.id), attempts };
};
