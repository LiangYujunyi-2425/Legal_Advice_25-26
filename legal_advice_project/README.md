# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


=========================================================
啟動網頁
1. cd legal_advice_25-26/legal_advice_project 

2. npm install 

3. pip install -r requirements.txt

4. 建立一個.env並寫入 VITE_API_URL=你的API URL 比如 VITE_API_URL=http://localhost:5000

5. cd rag1.0  然後看rag1.0內的README.md來啟動AI和API

6. 開一個新的terminal並 cd legal_advice_25-26/legal_advice_project 

7. npm run dev

本地開發時若遇到瀏覽器 CORS 限制（curl 能通但瀏覽器報錯），可以使用內置的本地代理來繞過（只限本地開發）：

- 在專案根目錄執行：

```bash
# 啟動本地代理，會把 /predict 轉發到 Cloud Run
node dev-proxy.js
```

- 然後在另一個 terminal 啟動前端：

```bash
npm run dev
```
- 接著在另一個 terminal 啟動ai_data後端：

```bash
node dev-proxy.js
```

代理預設監聽 http://localhost:3000 並轉發到 https://api-452141441389.europe-west1.run.app（若需改目標，可修改 `DEV_PROXY_TARGET` 環境變數）。

記得要確保你開著VPN 在美國

**如果pip版本出现outdated情况，请运行以下指令：
python3 -m pip install --upgrade pip

## OCR 掃描與 AI 分析流程

本項目內置 OCR（光學字符識別）功能，可以掃描文件並將識別的文字傳給 AI 進行法律分析。

### 工作流程

1. **掃描文件**：
   - 點擊左側面板的相機圖標打開攝像頭
   - 或點擊 PDF 圖標上傳 PDF 或圖片文件

2. **OCR 識別**：
   - 使用 Tesseract.js 進行光學字符識別（支持中文和英文）
   - 識別結果顯示在左側面板的 OCR 結果區域

3. **AI 分析**：
   - 識別的文本自動發送給後端 `/analyze` 端點
   - 後端使用 RAG 管道進行法律文本分析
   - 分析結果返回並顯示在聊天窗口中

4. **顯示結果**：
   - **識別的文本**：顯示 OCR 掃描出的原始文字
   - **分析結果**：顯示 AI 的法律分析和建議
   - **潛在風險**：如有識別出的風險條款會單獨列出

### API 端點說明

#### POST `/analyze` - 接受文本或文件分析

**接受文本輸入**（用於 OCR 結果）：
```json
{
  "text": "OCR 掃描識別的文字內容..."
}
```

**返回結果**：
```json
{
  "message": "分析完成",
  "summary": "AI 分析的摘要和建議...",
  "risks": ["風險1", "風險2"],
  "sources": ["- 相關法律段落"],
  "ocr_text": "識別文本摘要..."
}
```

**接受文件上傳**（傳統方式）：
```
Content-Type: multipart/form-data
file: [PDF 或 圖片文件]
```

### 修改記錄

#### 後端改進（rag1.0/app.py）
- 增強 `/analyze` 端點支持直接接收 JSON 文本參數
- 若提供 `text` 參數，使用 RAG 管道進行分析而不創建文件
- 保留原有的文件上傳流程以確保向後兼容性

#### 前端改進（src/Title.jsx）
- `captureToPdf()` 現在將 OCR 文本直接發送給 `/analyze` 端點
- 文件上傳時自動檢測圖片格式，若是圖片則進行 OCR
- 支持一鍵掃描和分析流程

#### 聊天集成（src/block.jsx）
- 新增事件監聽器 `ocr:analysisResult`
- OCR 分析結果自動顯示在聊天窗口中
- 結果包括識別的文本、AI 分析和潛在風險提示

#### App 層面整合（src/App.jsx）
- 新增 `handleAnalysisResult` 回調函數
- 通過窗口事件系統傳遞 OCR 分析結果
- 確保 Title 和 RightBlock 組件的無縫通信

## 开发 / 运行 与 OCR 测试（更新）

下面是开发时建议的完整步骤与调试提示，包含 OCR（pdf.js + Tesseract.js）流程与自动发送行为说明：

1. 安装前端依赖（在 `legal_advice_project` 目录）

```bash
cd legal_advice_25-26/legal_advice_project
npm install
```

2. 安装后端 python 依赖（如果需要运行 rag1.0）

```bash
pip install -r requirements.txt
```

3. (可选) 本地代理：如果浏览器出现 CORS 错误，可以用本地代理把 `/predict` 转发到 Cloud Run

```bash
# 在專案根目錄啟動本地代理（轉發 /predict 到 Cloud Run）
node dev-proxy.js
```

代理預設監聽 `http://localhost:3000` 並轉發到 `https://api-452141441389.europe-west1.run.app`，可透過 `DEV_PROXY_TARGET` 修改目標。

4. 启动前端开发服务器

```bash
npm run dev
```

5. PDF → OCR → AI 流程测试

- 在浏览器打开 `http://localhost:5175`（Vite 提示的本地地址）。
- 在左侧面板点击相机或拖放 PDF / 图片文件：
   - 如果 PDF 为可选文本（非扫描件），前端先使用 `pdf.js` 尝试直接提取文本；
   - 如果为扫描件或 `pdf.js` 提取失败，前端会把前 N 页（默认 5 页）渲染为图片并交给 `Tesseract.js` 的 worker 识别；
   - 识别完成后，系统会自动将识别出的文本发送到 AI（自动调用 `sendMessage`），AI 会开始返回流式回答；

6. 调试与常见问题

- 若看到 `Setting up fake worker failed` 或 `Failed to fetch pdf.worker`，请先清除浏览器缓存并重载页面。我们已使用 Vite 的 `?url` 导入本地 worker，如仍失败会回退到 CDN。 
- 初次运行 `tesseract.js` worker 会下载语言模型（`chi_tra` / `eng`），网络慢时会花一些时间，请耐心等待并观察左侧进度提示。
- 若识别质量不佳，可以：
   - 增加 `extractPdfText` 的 `maxPages` 或提高渲染 `scale`（在 `src/api/pdfExtractor.js` 可调整）；
   - 在 OCR 前对 canvas 做灰度/二值化预处理（我可以按需帮你添加）；

7. 可选：关闭自动发送

当前实现默认**会在 OCR 完成后自动把识别文本发送到 AI**。
如果你想临时关闭自动发送，可以在 `src/block.jsx` 中把处理 `pendingPdfText` 的 effect 修改为只把文本填入输入框（我也可以把这个开关做成 UI 控件，需我实现吗？）。

8. 快速验证命令（在项目根目录）

```bash
# 启动本地代理（可选）
node dev-proxy.js &

# 启动前端
cd legal_advice_25-26/legal_advice_project
npm run dev
```

如果你想我把「关闭自动发送」做成一个 UI 开关，我可以接着实现并把控制位置加到左侧面板或设置菜单。

## 端口说明与如何打开（简短直接）

- **前端 (Vite dev server)**: `5173`（默认）。启动命令：

```bash
cd legal_advice_25-26/legal_advice_project
npm run dev
```

 说明：Vite 若端口被占用会自动回退（例如 `5174` / `5175`），终端会显示实际使用的端口。

- **本地代理 (dev-proxy.js)**: `3000`（默认）。启动命令：

```bash
node dev-proxy.js
```

 说明：代理会把 `/predict`（或其它已配置路径）转发到远端 Cloud Run，以解决浏览器 CORS 问题。若需修改目标，请设置 `DEV_PROXY_TARGET` 或直接编辑 `dev-proxy.js`。

- **rag1.0 后端 (Flask API)**: `5000`（默认）。启动命令：

```bash
cd legal_advice_25-26/legal_advice_project/rag1.0
python app.py
```

 说明：`app.py` 使用 `app.run(host="0.0.0.0", port=5000)`，启动后主要端点示例：`/analyze`、`/ask`。如需变更端口，可修改 `app.run(...)` 中的 `port` 或用运行时参数/脚本包装器。

- **Streamlit Web UI (可选)**: `8501`（默认）。启动命令：

```bash
cd legal_advice_25-26/legal_advice_project/rag1.0
streamlit run launcher.py
```

- **Cloud Run / 远程 API**: 无需在本地打开端口，访问地址为 `https://api-452141441389.europe-west1.run.app`。如果前端直接与该远程 API 通信，可能遇到浏览器 CORS，建议在本地开发时使用 `dev-proxy.js` 转发。

小结：要打开对应端口，直接运行上面对应的启动命令即可（`npm run dev` / `node dev-proxy.js` / `python app.py` / `streamlit run`）。如需我把这些说明移到 README 顶部或生成一个单独的 `GETTING_STARTED.md`，我可以继续调整。
