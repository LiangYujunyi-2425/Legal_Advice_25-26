# 快速启动指南

## 当前状态

✅ `.env` 文件已创建：`VITE_API_URL=http://localhost:5000`  
✅ Python 依赖已安装  
✅ 后端服务 Flask 正在运行  

## 接下来的步骤

### 1. 验证后端服务

```bash
# 测试后端是否响应
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "测试文本"}'
```

期望看到 JSON 响应（不是 404 或 500 错误）。

### 2. 启动前端开发服务器

```bash
cd /workspaces/Legal_Advice_25-26/legal_advice_project
npm install  # 如果还没有安装依赖
npm run dev
```

然后打开浏览器访问显示的本地地址（例如 `http://localhost:5173`）

### 3. 测试功能

**方式 1：上传图片文件**
1. 点击 "📁" 图标（添加照片）
2. 选择一张包含文字的图片
3. 等待 OCR 识别（2-5 秒）
4. 查看聊天窗口中的分析结果

**方式 2：使用摄像头拍照**
1. 点击 "📷" 图标（摄像头）
2. 允许浏览器访问摄像头
3. 拍照或按空格键
4. 等待 OCR 识别和分析

**方式 3：拖放文件**
1. 将图片或 PDF 文件拖放到左侧扫描面板
2. 自动进行 OCR 或上传
3. 查看分析结果

## 故障排查

### 问题：仍然显示 404 错误

**原因**：.env 文件未被正确加载到前端

**解决方案**：
1. 关闭前端开发服务器（Ctrl+C）
2. 删除 node_modules 中的构建缓存：`rm -rf node_modules/.vite`
3. 重新启动前端：`npm run dev`
4. 打开浏览器控制台 (F12)，查看是否显示：
   ```
   API_URL configured: http://localhost:5000
   ```

### 问题：后端返回 500 错误

**检查**：
```bash
# 查看后端日志
ps aux | grep "python app.py"  # 找到进程 ID

# 查看最新的错误信息
tail -50 /tmp/backend.log
```

### 问题：图片上传后没有反应

**检查**：
1. 打开浏览器控制台 (F12)
2. 查看 Network 标签
3. 找到 POST 请求到 `/analyze`
4. 检查：
   - 状态码是否为 200
   - Response 是否为有效 JSON
5. 查看 Console 标签是否有错误信息

## 配置文件位置

- ✅ `.env` - `/workspaces/Legal_Advice_25-26/legal_advice_project/.env`
- 📝 前端代码 - `/workspaces/Legal_Advice_25-26/legal_advice_project/src/`
- 🐍 后端代码 - `/workspaces/Legal_Advice_25-26/legal_advice_project/rag1.0/app.py`

## 核心 API 端点

### POST /analyze

**请求示例 1：文本分析（OCR 结果）**
```json
{
  "text": "识别出的文字内容"
}
```

**请求示例 2：文件分析（PDF）**
```
FormData:
  - file: (binary PDF file)
```

**响应示例**
```json
{
  "message": "分析完成",
  "summary": "合同分析摘要...",
  "risks": ["风险1", "风险2"],
  "sources": ["章节1", "章节2"],
  "ocr_text": "识别的文字"
}
```

## 完整的工作流程示意图

```
用户上传图片/拍照
    ↓
浏览器检测文件类型
    ↓
IF 图片 → Tesseract.js OCR 识别
IF PDF  → 直接上传
    ↓
POST /analyze (JSON 或 FormData)
    ↓
后端 Flask 服务处理
    ↓
返回 JSON 结果
    ↓
前端通过事件系统转发
    ↓
聊天窗口显示结果 ✨
```

## 性能指标

| 操作 | 耗时 |
|------|------|
| OCR 识别 | 2-5 秒 |
| API 请求 | 1-3 秒 |
| 显示结果 | <100ms |

## 下一步

如果一切正常工作，恭喜！🎉

如果遇到问题，请：
1. 查看本文件的"故障排查"部分
2. 查看 `DEBUG_JSON_ERROR.md` 获得更详细的调试指南
3. 检查浏览器控制台的具体错误信息

---

**最后更新**：2025-11-15  
**状态**：✅ 配置完成，可以开始测试
