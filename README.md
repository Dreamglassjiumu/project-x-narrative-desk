# Project：X Narrative Desk

Project：X Narrative Desk 是一个面向游戏文案组的本地叙事情报系统原型。它服务于发生在虚构城市 San Libre 的 Project：X 世界观，用于整合帮派、区域、POI、角色、主线、支线和 pitch 草稿。

视觉方向不是普通后台，而是复古美国黑帮档案柜、洛杉矶犯罪档案室、旧警局案件墙和私家侦探办公室的混合体。

## 技术栈

- React
- TypeScript
- Vite
- Tailwind CSS
- 本地 TypeScript mock 数据
- Pitch 草稿使用 `localStorage`
- Local Library 预留 IndexedDB 接入口，本轮只做本地 UI 占位
- GitHub Pages workflow 部署

## 本地开发

```bash
npm install
npm run dev
```

开发服务器默认由 Vite 启动，终端会显示本地访问地址。

## 构建检查

```bash
npm run build
```

该命令会先运行 TypeScript build check，再执行 Vite production build。

## GitHub Pages 部署

- `vite.config.ts` 已配置：`base: "/project-x-narrative-desk/"`
- `.github/workflows/deploy.yml` 会在 `main` 分支 push 后构建并部署 `dist`
- 仓库需要在 GitHub Settings → Pages 中启用 GitHub Actions 部署来源

## 功能范围

- Dashboard 案件总览
- Factions 帮派档案
- Districts & POI 区域与地点
- Characters 角色卷宗
- Storylines 剧本线索
- Pitch Desk 三栏式结构化 pitch 编辑器
- Local Library 本地证物柜占位

## Pitch Desk

Pitch Desk 支持：

- 结构化字段填写
- 自动保存到 `localStorage`
- 一键导出 Markdown
- 简单字符串匹配识别资料名、中文名、英文名、别名
- 显示检测资料的 narrativeConstraints 与 doNotRevealYet 风险提醒
