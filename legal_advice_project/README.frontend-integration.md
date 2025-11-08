# 前端連接遠端 AI (Cloud Run) - 快速整合說明

本文件說明如何將前端聊天框連接到已部署在 Google Cloud Run 的 AI endpoint（例：https://api-452141441389.europe-west1.run.app）。

1) 設定環境變數

在 `legal_advice_project` 根目錄建立或更新 `.env`：

```
VITE_API_URL=https://api-452141441389.europe-west1.run.app
```

2) 已經新增的檔案

- `src/api/predictClient.js`：fetch `/predict` 並解析 SSE (`text/event-stream`)；回傳 async generator，呼叫方可以 iterate 並即時更新畫面。
- 已修改 `src/block.jsx` 的 `sendMessage`，改為使用 `streamPredict` 流式取得模型回覆並即時在聊天視窗更新。

3) 若 endpoint 需要 API Key

在 `streamPredict` 的 fetch 加上 `Authorization` header：

```js
headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_API_KEY}` }
```

並在 `.env` 中新增 `VITE_API_KEY=你的金鑰`。

4) CORS

若遇到跨域問題，請確認 Cloud Run 的服務允許來自前端網域的 CORS 或在後端回應中正確設定 `Access-Control-Allow-Origin`。

5) 本地啟動

```
cd legal_advice_project
npm install
npm run dev

# 在瀏覽器開啟 http://localhost:5173
```

6) 測試

在前端輸入問題，應該會看到 Assistant 內容以流式方式逐步更新；若出現錯誤，請查看瀏覽器 console 與 devtools network 的 `/predict` 回應內容。
