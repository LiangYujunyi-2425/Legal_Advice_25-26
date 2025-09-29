// server.js
import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// 模拟 __dirname（ES模块中没有 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建 Express 应用
const app = express();
const PORT = 5000;

// ✅ 添加 CORS 支持，允许前端跨域访问
app.use(cors({
  origin: "*", // 或指定你的前端地址以增强安全性
}));

// ✅ 指定 PDF 保存路径
const targetFolder = path.join(__dirname, "rag1.0", "contracts");

// ✅ 确保文件夹存在
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

// ✅ 上传接口
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    console.log("❌ 没有收到文件");
    return res.status(400).json({ error: "No file received" });
  }

  console.log("✅ 收到文件：", req.file);
  res.status(200).json({
    message: "PDF uploaded successfully",
    filename: req.file.filename,
    path: req.file.path,
  });
});

// ✅ 可选：查看 contracts 文件夹中的文件
app.get("/contracts", (req, res) => {
  fs.readdir(targetFolder, (err, files) => {
    if (err) return res.status(500).send("讀取失敗");
    res.json({ files });
  });
});

// ✅ 启动服务
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
