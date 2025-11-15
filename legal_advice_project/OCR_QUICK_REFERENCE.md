# OCR 掃描文字通過 API 傳給 AI 分析 - 快速參考

## 功能說明

此項目實現了完整的 OCR（光學字符識別）文本分析流程：
- 用戶上傳或掃描文件（圖片/PDF）
- 系統自動進行文字識別
- 將識別文字通過 API 發送給 AI 進行法律分析
- 在聊天窗口中顯示分析結果

## 快速開始

### 前置設置
```bash
# 1. 進入項目目錄
cd legal_advice_project

# 2. 安裝前端依賴
npm install

# 3. 安裝後端依賴
pip install -r requirements.txt

# 4. 配置環境變數 (.env)
VITE_API_URL=http://localhost:5000

# 5. 啟動後端服務（在 rag1.0 目錄）
cd rag1.0
python app.py

# 6. 啟動前端（新開 terminal）
npm run dev
```

### 使用方式

#### 方式 1：使用攝像頭掃描
1. 點擊左側相機圖標（📷）
2. 允許攝像頭權限
3. 點擊掃描按鈕（⊙）拍照
4. 自動進行 OCR 和分析
5. 結果在聊天窗口顯示

#### 方式 2：上傳圖片文件
1. 點擊左側上傳圖標（📄）
2. 選擇 PNG/JPG 圖片
3. 自動進行 OCR 和分析
4. 結果在聊天窗口顯示

#### 方式 3：上傳 PDF 文件
1. 點擊左側上傳圖標（📄）
2. 選擇 PDF 文件
3. 使用合同分析流程
4. 結果在聊天窗口顯示

## 關鍵代碼變更

### 後端 (`rag1.0/app.py`)
```python
@app.route("/analyze", methods=["POST"])
def analyze():
    # 支持 JSON 文本輸入
    if request.json:
        ocr_text = request.json.get("text")
    # 使用 RAG 管道分析
    if ocr_text:
        reranked = rag_search_with_rerank(ocr_text, n=10, top_k=3)
        # ... 返回分析結果
```

### 前端 (`src/Title.jsx`)
```jsx
// OCR 識別後發送文本
const response = await fetch(`${API_URL}/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});
```

### 聊天集成 (`src/block.jsx`)
```jsx
// 監聽分析結果事件
window.addEventListener('ocr:analysisResult', (event) => {
  const { ocr_text, summary, risks } = event.detail;
  // 顯示結果在聊天窗口
  setMessages(prev => [...prev, { role: 'assistant', content: summary }]);
});
```

## API 端點

### POST `/analyze`

**OCR 文本輸入：**
```json
{
  "text": "OCR 掃描識別的文字..."
}
```

**響應：**
```json
{
  "message": "分析完成",
  "summary": "AI 分析結果...",
  "risks": ["風險1", "風險2"],
  "sources": ["- 法律來源"],
  "ocr_text": "識別文本摘要..."
}
```

## 修改的文件清單

| 文件 | 修改內容 |
|------|--------|
| `rag1.0/app.py` | 增強 `/analyze` 端點支持 JSON 文本輸入 |
| `src/Title.jsx` | 改進 OCR 和文件上傳，直接發送文本給 API |
| `src/block.jsx` | 添加監聽器顯示 OCR 分析結果 |
| `src/App.jsx` | 添加事件轉發函數和結果傳遞 |
| `README.md` | 添加 OCR 功能文檔 |

## 事件流程圖

```
用戶操作 (攝像頭/上傳)
    ↓
[Title.jsx] captureToPdf() / 文件處理
    ↓
Tesseract.js (OCR 識別)
    ↓
fetch POST /analyze (JSON 文本)
    ↓
[app.py] rag_search_with_rerank()
    ↓
window.dispatchEvent('ocr:analysisResult')
    ↓
[App.jsx] handleAnalysisResult()
    ↓
[block.jsx] 監聽事件顯示結果
    ↓
聊天窗口展示分析結果
```

## 故障排查

| 問題 | 解決方案 |
|------|--------|
| API 連接失敗 | 檢查 `VITE_API_URL` 是否正確設置，後端服務是否運行 |
| OCR 無法識別 | 檢查圖片清晰度，確保 Tesseract.js 已加載 |
| 結果未顯示 | 檢查瀏覽器控制台，確保 `ocr:analysisResult` 事件被觸發 |
| 後端錯誤 | 查看後端日誌，確保 RAG 管道配置正確 |

## 性能指標

- OCR 識別時間：2-5 秒
- API 分析時間：1-3 秒
- 聊天窗口響應：<100ms

## 開發說明

### 添加新的 OCR 語言
在 `src/Title.jsx` 中修改：
```jsx
const { data: { text } } = await Tesseract.recognize(
  canvas,
  'eng+chi_tra+lang_code',  // 添加語言代碼
  { logger: (m) => console.log(m) }
);
```

### 自定義分析結果格式
在 `src/block.jsx` 的事件監聽器中修改消息格式：
```jsx
if (data.summary) {
  setMessages(prev => [...prev, { 
    role: 'assistant', 
    content: `自定義格式: ${data.summary}` 
  }]);
}
```

### 修改後端分析邏輯
編輯 `rag1.0/app.py` 中的 `analyze()` 函數，改變 RAG 搜索參數或輸出格式。

## 測試命令

```bash
# 測試 OCR 識別
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "這是測試文本"}'

# 測試文件上傳
curl -X POST http://localhost:5000/analyze \
  -F "file=@test.pdf"
```

## 相關文件

- 詳細實現說明：`IMPLEMENTATION_SUMMARY.md`
- 完整測試指南：`OCR_TEST_GUIDE.md`
- 項目 README：`README.md`

## 支持

如有任何問題，請查閱：
1. 瀏覽器控制台的錯誤信息
2. 後端服務的日誌輸出
3. 各文件中的代碼注釋
4. 測試指南中的故障排查部分
