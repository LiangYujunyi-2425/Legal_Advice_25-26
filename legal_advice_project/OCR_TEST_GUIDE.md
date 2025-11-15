# OCR 掃描和 AI 分析功能測試指南

## 功能概述

本項目實現了從 OCR 掃描文字到 AI 分析的完整工作流程：
1. 使用攝像頭或上傳圖片/PDF 掃描文件
2. 使用 Tesseract.js 進行光學字符識別（OCR）
3. 將識別的文本直接發送給 AI 進行法律分析
4. 在聊天窗口中顯示分析結果

## 技術架構

### 前端流程
```
[Title.jsx] --OCR text--> [App.jsx] --handleAnalysisResult--> [block.jsx]
   ↓                              ↓
 Tesseract.js              custom event dispatch
   ↓                              ↓
image/pdf input          ocr:analysisResult event
```

### 後端流程
```
[Title.jsx/block.jsx] --POST /analyze--> [app.py] 
                       JSON: {text: "..."} 
                              ↓
                      rag_search_with_rerank()
                              ↓
                      generate_answer_with_review()
                              ↓
                      JSON response with summary, risks, sources
```

## 測試步驟

### 前置準備
1. 確保安裝了所有依賴：
   ```bash
   cd legal_advice_project
   npm install
   pip install -r requirements.txt
   ```

2. 設置 .env 文件：
   ```bash
   VITE_API_URL=http://localhost:5000
   ```

3. 啟動後端服務（在 rag1.0 目錄）：
   ```bash
   python app.py
   ```

4. 啟動前端開發服務器：
   ```bash
   npm run dev
   ```

### 測試場景 1：使用攝像頭掃描

1. 打開網頁應用
2. 點擊左側面板的相機圖標（📷）
3. 允許攝像頭權限
4. 準備一份包含文字的文件（如法律合同、租賃協議等）
5. 點擊右側的掃描按鈕（⊙）拍照
6. 等待 OCR 處理完成
7. 檢查左側面板是否顯示識別文本
8. 檢查聊天窗口是否顯示 AI 分析結果

### 測試場景 2：上傳圖片文件

1. 打開網頁應用
2. 點擊左側面板的上傳圖標（📄）
3. 選擇一個 PNG/JPG 圖片文件
4. 系統將自動進行 OCR 識別
5. 等待分析完成
6. 檢查結果顯示

### 測試場景 3：上傳 PDF 文件

1. 打開網頁應用
2. 點擊左側面板的上傳圖標（📄）
3. 選擇一個 PDF 文件
4. 系統將直接上傳 PDF 進行分析
5. 檢查後端 /analyze 端點的返回結果

## 期望的輸出

### OCR 識別成功
```
🔍 識別的文本：
[OCR 掃描出的實際文字內容]
```

### AI 分析結果
```
📋 分析結果：
[AI 模型基於 RAG 管道的分析摘要]
```

### 風險提示
```
⚠️ 潛在風險：
[識別出的風險項目列表]
```

## 關鍵代碼位置

### 後端：增強的 /analyze 端點
**文件**: `rag1.0/app.py`
- 支持接收 `text` 參數進行直接分析
- 使用 RAG 管道處理文本
- 返回包含 summary、risks、sources 的 JSON

### 前端：OCR 和發送邏輯
**文件**: `src/Title.jsx`
- `captureToPdf()`: 從攝像頭捕捉、OCR 識別、發送分析
- 文件上傳處理：檢測圖片格式自動 OCR

### 前端：結果顯示
**文件**: `src/block.jsx`
- 監聽 `ocr:analysisResult` 事件
- 格式化並顯示識別文本、分析結果、風險提示

### 事件橋接
**文件**: `src/App.jsx`
- `handleAnalysisResult()`: 轉發 Title 的結果給 block
- `dispatchEvent('ocr:analysisResult', ...)`: 通過自定義事件通信

## 故障排查

### 問題 1：OCR 無法識別文字
- 檢查圖片質量和清晰度
- 確保 Tesseract.js 已正確加載
- 查看瀏覽器控制台是否有錯誤信息

### 問題 2：API 返回錯誤
- 確保後端服務運行在正確的端口（5000）
- 檢查 VITE_API_URL 環境變數設置
- 查看後端日誌了解具體錯誤

### 問題 3：分析結果未顯示
- 檢查聊天窗口是否打開
- 確保 `ocr:analysisResult` 事件監聽器正確掛載
- 查看瀏覽器控制台的網絡和事件日誌

## 測試檢查清單

- [ ] 攝像頭掃描能正常工作
- [ ] OCR 能正確識別中文和英文
- [ ] 識別文本能正確發送到後端
- [ ] 後端返回有效的分析結果
- [ ] 結果在聊天窗口中正確顯示
- [ ] 風險提示能清晰顯示
- [ ] UI 響應時間合理
- [ ] 錯誤處理適當（如網絡錯誤、無效文件等）

## 性能指標

理想情況下應該達到的性能指標：
- OCR 識別時間：2-5 秒（取決於圖片大小）
- API 分析時間：1-3 秒
- 聊天窗口響應時間：<100ms

## 下一步改進方向

1. 添加進度條顯示 OCR 和分析進度
2. 實現批量文件上傳
3. 添加結果下載/導出功能
4. 實現更細粒度的風險分類
5. 添加用戶反饋機制
6. 優化 OCR 語言選擇
7. 實現結果緩存機制
