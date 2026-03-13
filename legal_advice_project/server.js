// server.js
import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bodyParser from 'body-parser';
import { pushMessage, getRecent, clearSession, setMax, composePrompt } from './memoryCache.js';

// 模拟 __dirname（ES模块中没有 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT;

// ✅ 添加 CORS 支持
app.use(cors());
app.use(bodyParser.json());

// ✅ 指定 PDF 保存路径
const targetFolder = path.join(__dirname, "rag1.0", "contracts");
if (!fs.existsSync(targetFolder)) {
  fs.mkdirSync(targetFolder, { recursive: true });
}

// ✅ 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, targetFolder),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\.pdf$/, "");
    cb(null, `${originalName}_${timestamp}.pdf`);
  },
});

const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file received" });
  }

  res.status(200).json({
    message: "PDF uploaded successfully",
    filename: req.file.filename,
    path: req.file.path,
  });
});

// Cache API: push a message to session
app.post('/cache/:sessionId/message', (req, res) => {
  const { sessionId } = req.params;
  const msg = req.body;
  if (!msg || !msg.role) return res.status(400).json({ error: 'Invalid message payload' });
  const pushed = pushMessage(sessionId, msg, req.query.max ? Number(req.query.max) : undefined);
  return res.json({ ok: true, pushed });
});

// Get recent messages
app.get('/cache/:sessionId/recent', (req, res) => {
  const { sessionId } = req.params;
  const n = req.query.n ? Number(req.query.n) : undefined;
  const recent = getRecent(sessionId, n);
  return res.json({ ok: true, recent });
});

// Clear session cache
app.delete('/cache/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  clearSession(sessionId);
  return res.json({ ok: true });
});

// Compose prompt (recent messages + incoming) — useful for testing integration
app.post('/cache/:sessionId/compose', (req, res) => {
  const { sessionId } = req.params;
  const incoming = req.body.incoming || null;
  const n = req.query.n ? Number(req.query.n) : undefined;
  const composed = composePrompt(sessionId, incoming, { n });
  return res.json({ ok: true, composed });
});

// ✅ 启动服务
app.listen(PORT, () => {
});

const frontendFolder = path.join(__dirname, "dist"); // 或 dist
app.use(express.static(frontendFolder));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendFolder, "index.html"));
});
