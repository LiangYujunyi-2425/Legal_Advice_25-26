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

代理預設監聽 http://localhost:3000 並轉發到 https://api-452141441389.europe-west1.run.app（若需改目標，可修改 `DEV_PROXY_TARGET` 環境變數）。

記得要確保你開著VPN 在美國

**如果pip版本出现outdated情况，请运行以下指令：
python3 -m pip install --upgrade pip

语音控制功能
---------------

项目内置一个可选的「語音指令控制」功能，支持在浏览器中通过说中文命令来触发页面动作。当前支持的命令示例：

- 「打开合同上传」「上传合同」「打开上传」 → 会打开聊天右下的附件上传对话并弹出文件选择。
- 「启动AI助手」「打开AI助手」 → 会展开 AI 聊天窗口（法律助理）。

使用方法：在页面右下角点击「語音：關」切换为「語音：開」后，浏览器会开始监听命令。

注意事项：
- 语音识别依赖浏览器的 Web Speech API（部分浏览器/平台不支援）。建议使用 Chrome / Edge 的最新版本以获得最佳体验。
- 该功能会要求麦克风权限，用户需允许浏览器访问麦克风。
- 当前默认识别语言设为粤语 (yue-HK)。如果你的浏览器不支持粤语识别，Hook 会使用所提供的语言设置；在不支持时可能需要切换为普通话 `zh-HK` / `zh-CN` 或英文 `en-US`。
- 若功能不工作，请确认浏览器支持 SpeechRecognition（可在 DevTools 控制台查看错误）。