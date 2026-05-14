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

- `GET /api/assets`：读取 `data/factions.json`、`data/districts.json`、`data/pois.json`、`data/characters.json`、`data/storylines.json`、`data/design-assets.json`、`data/pitches.json`
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
- `design-assets`
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

## 免安装 OCR 配置

如果公司内网或权限限制导致无法安装系统级 Tesseract，可以使用项目内置的 portable OCR 目录。该方式不需要管理员权限、不要求写入系统 `PATH`，也不会连接云 OCR 或外部 API。

1. 在项目根目录创建目录：

   ```text
   tools/ocr/tesseract/
   ```

2. 放入 OCR 可执行文件和语言包：

   ```text
   tools/
     ocr/
       tesseract/
         tesseract.exe
         tessdata/
           eng.traineddata
           chi_sim.traineddata
   ```

3. 重启本地 API 后端：

   ```bash
   npm run dev:server
   ```

4. 打开图片证物的 OCR 面板，点击“识别文字”。

`/api/ocr/run` 会通过多 OCR provider 自动推荐可用引擎：

1. PaddleOCR HTTP 本地服务（可选，配置 `PADDLEOCR_URL`）
2. PaddleOCR CLI 脚本（可选，配置 `PADDLEOCR_CMD` / `PADDLEOCR_SCRIPT`）
3. Tesseract CLI（项目内 portable OCR、`.env` 中的 `TESSERACT_CMD=...`、或系统 `PATH`）
4. 如果本地引擎都不可用，则回到手动粘贴 OCR 文本流程，并提示“未检测到本地 OCR 引擎，请手动粘贴识别文本。”

语言映射为：中英混合 `chi_sim+eng`、中文 `chi_sim`、英文 `eng`。如果中文语言包不可用，系统会尝试使用英文识别，并在 OCR 面板提示“中文语言包不可用，已尝试英文识别。”

如果公司安全策略不允许运行本地 `exe`，OCR 面板会显示中文提示，现有“手动粘贴识别文本 → 保存文本 → 用文本生成草稿”的流程仍可继续使用。

### Portable OCR 中文语言包说明

v0.5.4 起，项目内 portable OCR 会单独检测英文与简体中文语言包。推荐目录结构如下：

```text
tools/ocr/tesseract/
  tesseract.exe
  tessdata/
    eng.traineddata
    chi_sim.traineddata
```

说明：

- `eng.traineddata` 用于英文识别。
- `chi_sim.traineddata` 用于简体中文识别。
- 如果只放 `eng.traineddata`，英文 OCR 可用，中文 OCR 不可用；`/api/ocr/status` 会提示“未检测到简体中文语言包 chi_sim.traineddata，中文识别可能不可用。”
- 公司电脑无法安装 OCR 时，可以直接复制整个 `tools/ocr/tesseract` 文件夹到项目相同位置，然后重启 `npm run dev:server`。
- OCR 语言选择规则：自动会在 `chi_sim` 与 `eng` 都存在时使用 `chi_sim+eng`，只有英文包时使用 `eng`；中文会要求 `chi_sim`；中英混合优先 `chi_sim+eng`，中文包缺失时 fallback 到 `eng` 并提示用户。

### OCR 测试建议

先测英文：

```text
Name: OCR Test Character
Occupation: Driver
Summary: This is a test character.
```

再测中文：

```text
姓名：OCR测试角色
职业：出租车司机
简介：这是一个 OCR 测试角色。
```

最后测真实素材：

- 角色设定图
- POI 设定图
- 区域设定图
- 物件 / 武器 / 载具图
- 中英混排设定图

OCR 结果需要人工校对，不能直接入库；请在 OCR 文本编辑器中校对、可选“清洗文本”，再生成 Parsed Draft 并到解析草稿区确认。

## OCR Provider：Windows OCR、Tesseract 与可选 PaddleOCR

v0.5.8 起，OCR 后端接入 Windows OCR PowerShell provider。当前公司环境的自动推荐优先级为：

1. `winocr-powershell`：Windows OCR PowerShell 脚本，适合中文截图、设定图、公司电脑环境。
2. `tesseract-cli`：项目内 portable Tesseract / `.env` / system PATH，适合英文、简单截图、白底黑字等轻量场景。
3. `manual-fallback`：手动粘贴外部 OCR 文本。

PaddleOCR HTTP / CLI provider 仍保留为可选能力，但不作为当前公司环境默认优先。没有安装或没有配置任何本地 OCR 时，项目仍会 fallback 到手动粘贴流程，不影响基本运行。

### 方式 A：Windows OCR PowerShell

如果公司电脑已有可用脚本，可在 `.env` 中配置：

```env
WINOCR_PS1=C:\Users\yinglong\winocr_test.ps1
WINOCR_LANG=zh-Hans
```

未配置时，后端会默认尝试 `C:\Users\yinglong\winocr_test.ps1`。`/api/ocr/status` 只检测脚本是否存在，不会每次状态检测都实际 OCR。截图保存为 evidence 后，OCR 面板会在 Windows OCR 可用时显示“自动识别文字”；识别成功会填入“识别文本”文本框，失败不会清空已有文本，可继续手动粘贴。

PowerShell 脚本需要向标准输出打印 JSON：

```json
{
  "text": "...",
  "lines": [
    { "text": "..." }
  ],
  "error": ""
}
```

### 方式 B：PaddleOCR HTTP 本地服务

如果你已经在本机或内网工具目录中准备了 PaddleOCR 服务，可在 `.env` 中配置：

```env
PADDLEOCR_URL=http://127.0.0.1:8866/ocr
```

后端会向该地址发送：

```text
POST PADDLEOCR_URL
multipart/form-data:
- image: file
- language: zh/en/mixed
```

期望服务返回：

```json
{
  "text": "...",
  "lines": [
    { "text": "...", "confidence": 0.95, "bbox": [] }
  ]
}
```

如果服务没有启动或不可访问，`/api/ocr/status` 会显示“未检测到 PaddleOCR 本地服务”，OCR 页面仍可继续使用 Tesseract 或手动粘贴。

### 方式 C：PaddleOCR CLI 脚本

如果你准备的是本地脚本，可在 `.env` 中配置：

```env
PADDLEOCR_CMD=python
PADDLEOCR_SCRIPT=D:\ocr-tools\paddle_ocr_runner.py
```

后端会执行：

```text
python D:\ocr-tools\paddle_ocr_runner.py <imagePath> --lang ch
```

脚本需要向标准输出打印 JSON：

```json
{
  "text": "...",
  "lines": []
}
```

脚本不存在、执行失败或输出不是 JSON 时，自动推荐模式会 fallback 到下一可用 OCR 引擎；如果在前端强制选择了不可用的 PaddleOCR 引擎，会提示“该 OCR 引擎不可用，请检查配置或改用手动粘贴。”

### 公司电脑无法安装 PaddleOCR 时

如果公司电脑不能安装 PaddleOCR，可以：

- 在允许的环境中配置并打包 PaddleOCR 工具，再通过 HTTP 或 CLI 方式接入。
- 继续使用 Windows 截图、Office、企业微信、飞书或其他公司工具做 OCR，然后在面板中使用“粘贴外部 OCR 文本”。
- 粘贴后的流程与本地 OCR 完全一致：清洗文本 → 保存文本 → 选择资料类型 → 生成草稿预览 → 确认生成 Parsed Draft → 再执行 Approve & File。
