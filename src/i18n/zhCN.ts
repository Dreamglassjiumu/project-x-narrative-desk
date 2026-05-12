import type { AssetStatus, SpoilerLevel } from '../data';
import type { AssetType } from '../utils/assetHelpers';

export const zh = {
  disabledReadOnly: '本地接口离线，当前为只读模式。',
  none: '无',
  unknown: '未知',
  noTags: '无标签',
  buttons: {
    newRecord: '新建', closeFile: '关闭', close: '关闭', closeX: '关闭 ×', save: '保存', saveDossier: '保存', delete: '删除', edit: '编辑', cancel: '取消', createDossier: '建档', bindToDossier: '绑定', upload: '上传', uploadToIntake: '上传', addAllLockerFiles: '添加全部', readPreview: '读取预览', generateParsedDrafts: '生成草稿', batchApproveFile: '批量入库', approveFile: '确认入库', mergeExisting: '合并', reject: '驳回', previewJson: '预览 JSON', editDraft: '编辑草稿', clearFilters: '清空筛选', apply: '应用', selectVisible: '选择当前', selectNone: '取消选择', selectEvidence: '选择证物', selectDraft: '选择草稿', openDossier: '打开', openFolder: '打开', insertPitchOutline: '插入提纲', exportMarkdown: '导出 Markdown', loadPitch: '读取', duplicate: '复制', clearDraft: '清空', previous: '上一张', next: '下一张', zoomIn: '放大', zoomOut: '缩小', reset: '还原', fitToScreen: '适应屏幕', replaceImage: '替换图片', removePrimaryImage: '移除主图', setPrimaryEvidence: '设为主证物图', chooseEvidenceFiles: '选择证物文件', saveMetadata: '保存信息', saveBindings: '保存绑定', exportJson: '导出 JSON 包', previewImport: '预览导入', executeImport: '执行导入', convertStoryline: '转为剧情线草稿', clearRejected: '清除已驳回', approveSelected: '确认所选入库', showMapping: '显示字段映射', hideMapping: '隐藏字段映射'
  },
  nav: { dashboard: '案件总览', factions: '帮派档案', districts: '区域与地点', characters: '角色卷宗', storylines: '剧情线', pitch: 'Pitch 写作台', library: '本地资料库', intake: '证物接收台' },
  statusLine: { online: '本地数据已就绪 · 仅本地', offline: '本地接口离线 · 只读模式' },
  evidence: { document: '文档', image: '图片', photoBag: '图片', documentBag: '文档', unfiled: '未归档证物', linkedDossiers: '已绑定档案', primaryFor: '主图用于', fileUsage: '文件用途', keepUsage: '保持当前用途', addTags: '添加标签', tagPlaceholder: '输入后按 Enter', allFileUsage: '全部文件用途', all: '全部', linked: '已绑定', unlinked: '未绑定', uploadNewImage: '上传新图片', chooseExistingEvidence: '选择已有证物', clickBindUpload: '点击绑定或上传图片', dropPrimaryHere: '将主证物图放在这里', uploadedAt: '上传时间', fileType: '文件类型', size: '大小', path: '路径', copyPath: '复制本地证物路径', openLinkedDossier: '打开关联档案' },
  fileUsage: { character_reference: '角色参考', faction_reference: '帮派参考', district_reference: '区域参考', poi_reference: '地点参考', storyline_reference: '剧情线参考', raw_document: '原始文档', moodboard: '氛围参考', other: '其他', intake_queue: '接收队列', all_images: '全部图片', unlinked_images: '未绑定图片', linked_images: '已绑定图片' } as Record<string, string>,
  parserMode: { 'Auto Detect': '自动识别', 'Faction Sheet': '帮派表', 'Character Sheet': '角色表', 'District Sheet': '区域表', 'POI Sheet': '地点表', 'Storyline Sheet': '剧情线表', 'Raw Text': '原始文本', 'Image Evidence': '图片', 'Existing Archive JSON': '已有档案 JSON', Sheet: '工作表', raw_document: '原始文档' } as Record<string, string>,
  assetType: { characters: '角色', factions: '帮派', districts: '区域', pois: '地点', storylines: '剧情线' } as Record<AssetType, string>,
  assetCategory: { Character: '角色', Faction: '帮派', District: '区域', POI: '地点', Storyline: '剧情线' } as Record<string, string>,
  status: { draft: '草稿', under_review: '审核中', canon: '正式', archived: '已归档', deprecated: '已废弃', needs_review: '待确认', filed: '已入库', rejected: '已驳回' } as Record<AssetStatus | string, string>,
  spoiler: { public: '公开', internal: '内部', secret: '机密', classified: '绝密' } as Record<SpoilerLevel | string, string>,
  completeness: { complete: '完整', needs_review: '待补充', incomplete: '不完整', title: '完整度检查', checksCleared: '项检查通过', completeness: '完整度', missing: '缺失' },
  missing: { details: '详情', tags: '标签', 'at least one related dossier': '关联档案', occupation: '职业', 'characterArc / currentTimelineStatus': '角色弧光或当前时间线状态', sourceNotes: '来源备注', primaryEvidence: '主证物图' } as Record<string, string>,
  intake: { title: '证物接收台', queue: '待解析队列', bags: '待处理证物', controls: '解析控制台', sortingMachine: '资料解析器', previewPanel: '文件预览', underLamp: '文件预览', parsedDrafts: '解析草稿', reviewTray: '入库前审核', fieldMapping: '字段映射', sourceColumn: '来源列', targetField: '目标字段', autoGuess: '自动识别', headers: '表头预览', totalRows: '总行数', previewRows: '预览：前几行', sheet: '工作表', doNotImport: '不导入', ignoreColumn: '忽略此列', noDrafts: '暂无解析草稿', noDirectWrite: '暂无草稿。' },
  pitch: { writingDesk: 'Pitch 写作区', title: '标题', type: '类型', status: '状态', body: '正文', linkedDossiers: '关联档案', manualLinks: '手动关联', autoDetected: '自动识别', riskStrip: '风险提醒', saveStatus: '保存状态', unsaved: '有未保存修改', autosaved: '已自动保存到浏览器草稿', saved: '已保存到本地档案', offline: '本地接口离线 · 只读', linkedCharacters: '关联角色', linkedFactions: '关联帮派', linkedDistricts: '关联区域', linkedPois: '关联地点', linkedStorylines: '关联剧情线', addCharacter: '添加角色', addFaction: '添加帮派', addDistrict: '添加区域', addPoi: '添加地点', addStoryline: '添加剧情线' },
  characterType: { playable_hero: '可操控英雄', boss: 'Boss', story_npc: '剧情人物', protagonist: '主角', faction_member: '帮派成员', law_enforcement: '执法人员', civilian: '平民' } as Record<string, string>,
  pitchStatus: { draft: '草稿', under_review: '审核中', approved: '已通过', archived: '已归档' } as Record<string, string>,
  lightbox: { title: '暗房证物查看器', loadFailed: '证物图片加载失败。', exitHint: 'Esc / 点击黑色遮罩关闭' },
  errors: { unsupported: '不支持的文件类型。', noWorksheet: '这个 XLSX 文件中没有工作表。', worksheetEmpty: '工作表为空。', csvEmpty: 'CSV 文件为空。', noFile: '尚未选择文件。', parserMode: '请选择解析模式。', targetType: '请选择目标类型。', failedDrafts: '创建解析草稿失败。', failedApprove: '确认草稿入库失败。', backupAbort: '备份失败，批量入库已取消。', apiOfflineIntake: '本地接口离线，接收台为只读模式。', duplicate: '发现可能重复的档案。', duplicateWarning: '重复提醒', uploadFailed: '上传失败。', writeFailed: '写入失败。', localApiOffline: '本地接口离线。' }
};

export const fileUsageLabel = (value?: string) => zh.fileUsage[value || 'other'] || value || zh.fileUsage.other;
export const parserModeLabel = (value: string) => zh.parserMode[value] || value;
export const assetTypeLabel = (value: AssetType) => zh.assetType[value] || value;
export const statusLabel = (value?: string) => zh.status[value || ''] || value || '';
export const spoilerLabel = (value?: string) => zh.spoiler[value || ''] || value || '';
export const characterTypeLabel = (value?: string) => zh.characterType[value || ''] || value || '';
export const pitchStatusLabel = (value?: string) => zh.pitchStatus[value || ''] || statusLabel(value);
export const missingFieldLabel = (value: string) => zh.missing[value] || value;
export const categoryLabelZh = (value?: string) => zh.assetCategory[value || ''] || value || '';

export function translateArchiveMessage(message: string) {
  if (/unsupported file type/i.test(message)) return zh.errors.unsupported;
  if (/No worksheet found/i.test(message)) return zh.errors.noWorksheet;
  if (/Worksheet is empty/i.test(message)) return zh.errors.worksheetEmpty;
  if (/CSV file is empty/i.test(message)) return zh.errors.csvEmpty;
  if (/No file selected/i.test(message)) return zh.errors.noFile;
  if (/Parser mode is required/i.test(message)) return zh.errors.parserMode;
  if (/Target type is required/i.test(message)) return zh.errors.targetType;
  if (/Failed to create parsed drafts/i.test(message)) return zh.errors.failedDrafts;
  if (/Failed to approve draft/i.test(message)) return zh.errors.failedApprove;
  if (/Backup failed/i.test(message)) return zh.errors.backupAbort;
  if (/Local API offline/i.test(message)) return zh.errors.localApiOffline;
  if (/Upload failed/i.test(message)) return zh.errors.uploadFailed;
  if (/Write failed/i.test(message)) return zh.errors.writeFailed;
  return message;
}
