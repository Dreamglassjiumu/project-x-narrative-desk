# Project：X Narrative Desk

Project：X Narrative Desk 是一个面向游戏文案组的 **local-first 本地叙事情报系统**。它服务于发生在虚构城市 San Libre 的 Project：X 世界观，用于整合帮派、区域、POI、角色、主线、支线、pitch 草稿和本地证物文件。

视觉方向不是普通后台，而是复古美国黑帮档案柜、洛杉矶犯罪档案室、旧警局案件墙和私家侦探办公室的混合体。

## 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS
- 本地后端：Node.js + Express
- 上传处理：Multer
- 数据保存：项目根目录 `data/*.json`
- 文件保存：项目根目录 `uploads/`
- Pitch 草稿：浏览器 `localStorage`

## Local-first 工作方式

本项目当前定位为本机工具：

1. 用户在自己的电脑上启动本地 API 和前端开发服务器。
2. 浏览器访问 `localhost` / `127.0.0.1` 使用工具。
3. 资料 JSON 保存在 `data` 目录。
4. 图片、PDF、文本等证物文件上传到 `uploads` 目录。
5. 暂不做公网部署、云同步、登录、多用户权限或远程数据库。

> 安全提醒：本地 API 只监听 `127.0.0.1`，不要改成默认监听 `0.0.0.0`，除非你非常清楚局域网暴露风险。

## 本地开发

安装依赖：

```bash
npm install
```

同时启动本地 API 与前端：

```bash
npm run dev
```

或者分两个终端分别启动：

```bash
npm run dev:server
npm run dev:client
```

默认地址：

- 本地 API：`http://localhost:4317`
- 前端 Vite：终端输出的本地地址，通常为 `http://127.0.0.1:5173`

## 构建检查

```bash
npm run build
```

该命令会先运行 TypeScript build check，再执行 Vite production build。

## 本地 API

### Assets

- `GET /api/assets`：读取 `data/factions.json`、`data/districts.json`、`data/pois.json`、`data/characters.json`、`data/storylines.json`、`data/pitches.json`
- `POST /api/assets/:type`：新增资料，写入对应 JSON 文件
- `PUT /api/assets/:type/:id`：更新资料，写回对应 JSON 文件
- `DELETE /api/assets/:type/:id`：删除资料，写回对应 JSON 文件

支持的 `:type`：

- `factions`
- `districts`
- `pois`
- `characters`
- `storylines`
- `pitches`

### Uploads

- `POST /api/uploads`：上传图片或文档到 `uploads` 文件夹，字段名为 `files`
- `GET /api/uploads`：列出已上传文件
- `DELETE /api/uploads/:id`：删除本地上传文件

## 数据目录与 Git 注意事项

- 示例世界观资料放在 `data/*.json`，用于本地 API 启动后直接读取。
- 真实项目资料、涉密文档、未公开图片、扫描件等不要提交到 public repo。
- `.gitignore` 已加入：
  - `uploads/`
  - `data/private/`
- 如果需要保存真实资料，建议放在 `data/private/` 或其他不提交的本地目录，并定期做本机备份。

## 功能范围

- Dashboard 案件总览：从本地 API 读取 JSON 统计
- Factions 帮派档案
- Districts & POI 区域与地点
- Characters 角色卷宗
- Storylines 剧本线索
- Pitch Desk 三栏式结构化 pitch 编辑器
- Local Library 本地证物柜：上传、列出、删除 `uploads` 文件夹中的文件
