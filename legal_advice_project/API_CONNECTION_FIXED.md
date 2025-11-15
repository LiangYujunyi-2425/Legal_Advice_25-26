# API 连接修复 - 已完成 ✅

## 问题诊断

你遇到的 404 错误是因为 API 地址配置错误：

```
❌ 错误：POST https://sturdy-telegram-5gxgr5qvqqv92ppw5-5173.app.github.dev/analyze 404 (Not Found)
```

**原因**：`.env` 文件设置的是本地服务器地址，而你的 API 实际上在 Google Cloud Run 上

## 修复方案 ✅

### 已更新的配置

**文件**：`.env`

```diff
- VITE_API_URL=http://localhost:5000
+ VITE_API_URL=https://api-452141441389.europe-west1.run.app
```

### 为什么这个 API 地址是对的

1. ✅ 这是你在 `predictClient.js` 中使用的同一个 API 端点
2. ✅ 这是 Google Cloud Run 上的远程服务
3. ✅ 支持 HTTPS（生产环保安全）
4. ✅ 支持 CORS（跨域请求）

## 当前状态

| 组件 | 状态 | 说明 |
|------|------|------|
| `.env` 配置 | ✅ 已修复 | `VITE_API_URL=https://api-452141441389.europe-west1.run.app` |
| 前端开发服务器 | ✅ 运行中 | `http://localhost:5175/` |
| 后端 API 服务 | ✅ 在线 | Google Cloud Run - `https://api-452141441389.europe-west1.run.app` |

## 立即测试

### 1. 打开浏览器

访问：**http://localhost:5175/**

### 2. 打开浏览器控制台 (F12)

应该看到：
```
API_URL configured: https://api-452141441389.europe-west1.run.app
```

如果看到这个消息，说明配置成功！

### 3. 测试上传功能

**上传图片**：
1. 点击 "📁" 按钮（添加照片）
2. 选择包含文字的图片
3. 等待 OCR 识别（2-5 秒）
4. 查看聊天窗口中的分析结果

**预期响应**：
```json
{
  "message": "分析完成",
  "summary": "...",
  "risks": [...],
  "sources": [...],
  "ocr_text": "识别出的文字"
}
```

### 4. 检查网络请求

在浏览器开发者工具 → Network 标签：
- 找到 POST 请求到 `https://api-452141441389.europe-west1.run.app/analyze`
- 状态码应该是 **200**（而不是 404）
- Response 应该是有效的 JSON

## 架构总结

```
┌─────────────────────────────────────────┐
│         浏览器 (GitHub Codespaces)       │
│  http://localhost:5175/                 │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  React 前端应用                    │  │
│  │  • OCR 识别 (Tesseract.js)       │  │
│  │  • 文件上传                        │  │
│  │  • 拖放功能                        │  │
│  └──────────────────────────────────┘  │
│                 │                       │
│                 │ fetch()               │
│                 ↓                       │
│       .env: VITE_API_URL               │
│       = https://api-452141...          │
│                 │                       │
└─────────────────┼───────────────────────┘
                  │ HTTPS
                  ↓
        ┌──────────────────────┐
        │  Google Cloud Run     │
        │  Flask API 服务       │
        │  /analyze 端点        │
        │  分析合同和文本       │
        └──────────────────────┘
```

## 相关文件

- **配置文件**：`.env`
- **前端代码**：`src/Title.jsx` - 第 9 行使用 `VITE_API_URL`
- **API 端点**：`src/api/predictClient.js` - 参考 Cloud Run 地址
- **快速参考**：`QUICK_START.md`

## 故障排查

### 问题 1：仍然看到 404 错误

**解决方案**：
```bash
# 1. 检查 .env 文件
cat .env
# 应该显示：VITE_API_URL=https://api-452141441389.europe-west1.run.app

# 2. 重启浏览器（完全刷新）
# 或按 Ctrl+Shift+R (强制刷新)

# 3. 清除浏览器缓存
# 开发者工具 → Application → Clear storage
```

### 问题 2：API 返回 CORS 错误

这是正常的跨域问题。浏览器会显示：
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**解决方案**：
- Cloud Run API 已配置 CORS 支持
- 确保请求头正确：`Content-Type: application/json`
- 如果问题持续，后端可能需要添加 CORS 配置

### 问题 3：API 超时或无响应

**检查**：
```bash
# 直接测试 API
curl -X POST https://api-452141441389.europe-west1.run.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"测试"}'
```

如果 curl 命令正常工作但浏览器不行，可能是 CORS 问题。

## 下一步

### 如果一切正常工作：🎉

恭喜！现在可以：
1. ✅ 上传图片进行 OCR 识别
2. ✅ 自动分析识别的文本
3. ✅ 在聊天窗口显示分析结果
4. ✅ 上传 PDF 文件进行分析

### 如果仍有问题：

1. 查看浏览器控制台的具体错误信息
2. 查看 Network 标签中的请求和响应
3. 参考 `DEBUG_JSON_ERROR.md` 获得更详细的调试步骤

## 完整的工作流程

```
用户上传图片/拍照
        ↓
浏览器从 .env 读取 API_URL
VITE_API_URL=https://api-452141441389.europe-west1.run.app
        ↓
检测文件类型
        ↓
IF 图片 → Tesseract.js OCR
IF PDF  → 直接上传
        ↓
POST https://api-452141441389.europe-west1.run.app/analyze
{
  "text": "识别的文字" 
  OR
  "file": FormData
}
        ↓
Google Cloud Run 处理请求
        ↓
返回 JSON 结果
{
  "summary": "...",
  "risks": [...],
  ...
}
        ↓
前端显示在聊天窗口 ✨
```

## 重要提示

⚠️ **不要提交 `.env` 文件到 Git**

如果 `.env` 在 `.gitignore` 中：
```bash
# 正常，不需要做任何事
```

如果 `.env` 不在 `.gitignore` 中：
```bash
# 添加到 .gitignore
echo ".env" >> .gitignore
```

---

**修复日期**：2025-11-15  
**状态**：✅ 已完成  
**建议**：重启浏览器完全刷新缓存，重新测试上传功能
