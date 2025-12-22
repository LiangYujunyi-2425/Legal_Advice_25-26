# Chrome Extension for Legal Advice App

This folder contains a minimal Chrome extension scaffold that loads your app UI in the action popup.

Development mode:
- The popup iframe defaults to `http://localhost:5173` (Vite dev server). Start your app with:

```bash
cd legal_advice_project
npm run dev
```

- Then load the extension in Chrome:
  - Open `chrome://extensions/`
  - Enable "Developer mode"
  - Click "Load unpacked" and select this `chrome-extension` folder.

Production packaging:
1. Build the app in `legal_advice_project`:

```bash
cd legal_advice_project
npm run build
```

2. Copy the `dist` output into the extension folder (script added to `package.json` can do this):

```bash
# from legal_advice_project
npm run build:extension
```

3. Reload the extension in `chrome://extensions/` (or pack it and publish).
