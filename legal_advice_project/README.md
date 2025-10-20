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

記得要確保你開著VPN 在美國

**如果pip版本出现outdated情况，请运行以下指令：
python3 -m pip install --upgrade pip