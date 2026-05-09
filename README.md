# Project：X Narrative Desk

Project：X Narrative Desk 是一个面向游戏文案组的 **local-first 本地叙事情报系统**。它服务于发生在虚构城市 San Libre 的 Project：X 世界观，用于整合帮派、区域、POI、角色、主线、支线、pitch 草稿和本地证物文件。

视觉方向不是普通后台，而是复古美国黑帮档案柜、洛杉矶犯罪档案室、旧警局案件墙和私家侦探办公室的混合体。

## 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS
- 本地后端：Node.js + Express
- 上传处理：Multer
- 数据保存：项目根目录 `data/*.json`
- 文件保存：项目根目录 `uploads/images/` 与 `uploads/documents/`
- Pitch 草稿：浏览器 `localStorage`

## 给非程序用户的本地启动方式

第一次使用先安装依赖：

```bash
npm install
```

推荐分两个终端启动，方便看到前端和后端各自的状态。

终端 1：启动本地 API 后端。

```bash
npm run dev:server
```

终端 2：启动前端页面。

```bash
npm run dev:client
```

也可以用一个命令同时启动两边：

```bash
npm run dev
```

默认地址：

- 本地 API：`http://localhost:4317`
- 前端 Vite：终端输出的 Local 地址，通常为 `http://127.0.0.1:5173`

## 如何判断启动成功

1. 浏览器打开 Vite 终端里显示的 Local 地址。
2. 页面顶部状态显示：`LOCAL JSON SYNC READY · SYSTEM: LOCAL ONLY`。
3. 这代表前端已经连上本机后端，新增资料、编辑资料、上传证物文件都会写入本机项目目录。

如果页面顶部显示 `LOCAL API OFFLINE · READ ONLY`，说明当前只能浏览演示资料 / mock 数据，不能真实写入本地 JSON 或 uploads 文件夹。请确认 `npm run dev:server` 正在运行。

## 资料和上传文件保存在哪里

- 帮派、区域、POI、角色、剧情、Pitch 等资料保存在：`data/*.json`
- 图片证物保存在：`uploads/images/`
- 文档证物保存在：`uploads/documents/`

Local Library 支持上传图片，以及 Markdown、JSON、TXT、PDF、Word、Excel、CSV 等资料文件。图片会进入 `uploads/images/`，其他文档会进入 `uploads/documents/`。

## GitHub Pages 演示版说明

GitHub Pages 仅作为 UI / mock 数据演示版：

- 没有本地 Node.js API。
- API offline 时，前端会 fallback 使用打包内置 mock 数据，保证演示页面仍可浏览。
- 不能进行真实新增、编辑、删除、上传、导入或保存 Pitch。
- 正式本地使用请运行 `npm run dev:server` 和 `npm run dev:client`。

## 数据目录与 Git 安全提醒

真实项目资料、涉密文档、未公开图片、扫描件和 `.env` 配置不要提交到公开仓库。

`.gitignore` 已忽略：

- `uploads/`
- `data/private/`
- `.env`
- `.env.*`

示例世界观资料放在 `data/*.json`，用于本地 API 启动后直接读取。如果需要保存真实资料，建议放在 `data/private/` 或其他不提交的本地目录，并定期做本机备份。

## 构建检查

```bash
npm run build
```

该命令会先运行 TypeScript build check，再执行 Vite production build。

## 本地 API

### Assets

- `GET /api/assets`：读取 `data/factions.json`、`data/districts.json`、`data/pois.json`、`data/characters.json`、`data/storylines.json`、`data/pitches.json`
- `GET /api/assets/:type`：读取指定类型资料
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

- `POST /api/uploads`：上传图片或文档到 `uploads/images/` 或 `uploads/documents/`，字段名为 `files`
- `GET /api/uploads`：列出已上传文件
- `PUT /api/uploads/:id`：更新 tags 与 linked dossiers
- `DELETE /api/uploads/:id`：删除本地上传文件

## Troubleshooting：4317 端口被占用

如果启动后端时看到：

```text
Error: listen EADDRINUSE: address already in use 127.0.0.1:4317
```

这表示本地后端端口 `4317` 已被占用，常见原因是之前打开的 `npm run dev:server` 没有关闭。

Windows 解决方法：

```bat
netstat -ano | findstr :4317
```

找到 `LISTENING` 行最后的 PID 后，执行：

```bat
taskkill /PID <PID> /F
```

然后重新运行：

```bash
npm run dev:server
```

推荐启动方式仍然是：

终端 1：

```bash
npm run dev:server
```

终端 2：

```bash
npm run dev:client
```

页面顶部出现 `LOCAL JSON SYNC READY · SYSTEM: LOCAL ONLY` 即代表前后端连接成功。

## 功能范围

- Dashboard 案件总览：从本地 API 读取 JSON 统计
- Factions 帮派档案
- Districts & POI 区域与地点
- Characters 角色卷宗
- Storylines 剧本线索
- Pitch Desk 三栏式结构化 pitch 编辑器
- Local Library 本地证物柜：上传、列出、绑定 tags / dossiers、二次确认后删除 `uploads` 文件夹中的文件
