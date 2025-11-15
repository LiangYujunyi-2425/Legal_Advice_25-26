# JSON 解析错误 - 调试指南

## 问题描述

错误信息：`SyntaxError: Failed to execute 'json' on 'Response': Unexpected end of JSON input`

这通常表示 API 响应为空或无效的 JSON 格式。

## 常见原因

### 1. API 未启动或连接失败
```
错误：API_URL 未设置或后端服务未运行
症状：前端收到空响应或网络错误
```

**解决方案**：
```bash
# 1. 确保设置了 .env 文件
cat .env
# 输出应该显示：VITE_API_URL=http://localhost:5000

# 2. 启动后端服务
cd rag1.0
python app.py
# 输出应该显示：Running on http://0.0.0.0:5000

# 3. 测试 API 连接
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "测试文本"}'
```

### 2. 后端返回错误响应
```
错误：后端处理失败，返回 500 或其他错误状态
症状：响应状态不是 200-299
```

**检查**：
- 查看浏览器控制台是否显示 "API error: 500"
- 查看后端服务的错误日志
- 确保所有依赖已安装：`pip install -r requirements.txt`

### 3. CORS 跨域问题
```
错误：浏览器阻止跨域请求
症状：网络标签显示请求被阻止
```

**解决方案**：
```bash
# 使用本地代理（仅限本地开发）
node dev-proxy.js
```

## 调试步骤

### 步骤 1：检查 API 配置
打开浏览器控制台（F12），查看是否输出：
```
API_URL configured: http://localhost:5000
```

如果没有输出或显示 "NOT SET"：
```bash
# 创建 .env 文件
echo "VITE_API_URL=http://localhost:5000" > .env

# 重新启动前端
npm run dev
```

### 步骤 2：测试后端连接
在控制台运行：
```javascript
// 测试后端是否响应
fetch('http://localhost:5000/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: '测试' })
})
.then(res => {
  console.log('Status:', res.status, res.statusText);
  return res.text(); // 先读取文本，不要直接用 json()
})
.then(text => {
  console.log('Response:', text);
  try {
    const data = JSON.parse(text);
    console.log('Parsed JSON:', data);
  } catch (e) {
    console.error('Invalid JSON:', e);
  }
})
.catch(err => console.error('Request failed:', err));
```

### 步骤 3：检查后端日志
```bash
# 观察后端服务输出
cd rag1.0
python app.py

# 应该输出类似：
# WARNING in app.run_simple: ...
# (Press CTRL+C to quit)
```

当前端发送请求时，应该看到：
```
127.0.0.1 - - [日期] "POST /analyze HTTP/1.1" 200 -
```

### 步骤 4：验证 JSON 响应格式
确保后端返回的 JSON 有效。查看 `rag1.0/app.py`：

```python
# 检查是否正确返回 JSON
return jsonify({
    "message": "分析完成",
    "summary": answer,
    "risks": [],
    "sources": sources,
    "ocr_text": ocr_summary
})
```

## 完整的本地测试流程

### 终端 1：启动后端
```bash
cd /workspaces/Legal_Advice_25-26/legal_advice_project/rag1.0
python app.py
```

期望输出：
```
WARNING in app.run_simple: This is a development server. Do not use it in production deployments.
 * Running on http://0.0.0.0:5000
 * Running on http://127.0.0.1:5000
```

### 终端 2：启动前端
```bash
cd /workspaces/Legal_Advice_25-26/legal_advice_project
npm run dev
```

期望输出：
```
  VITE v... ready in ... ms

  ➜  Local:   http://localhost:5173/
```

### 终端 3：测试 API（可选）
```bash
# 直接测试 API
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "测试文本"}'

# 应该返回类似：
# {"message":"分析完成","summary":"...","risks":[],...}
```

## 如果仍然出错

### 检查清单
- [ ] `.env` 文件存在且正确设置 `VITE_API_URL`
- [ ] 后端服务正在运行（检查输出 "Running on...")
- [ ] 前端能看到 "API_URL configured:" 消息
- [ ] 没有 CORS 跨域错误
- [ ] 后端没有 500 错误（查看后端日志）
- [ ] 网络连接正常（可以 ping 到服务器）

### 高级调试
在 `src/Title.jsx` 中添加详细日志：

```javascript
// 在 handleFile 函数中添加
console.log('发送请求到:', `${API_URL}/analyze`);
console.log('请求数据:', { text });

const res = await fetch(`${API_URL}/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});

console.log('响应状态:', res.status, res.statusText);
console.log('响应 headers:', res.headers);

const text = await res.text();
console.log('原始响应:', text);

const data = JSON.parse(text);
console.log('解析后数据:', data);
```

## 常见问题排查表

| 症状 | 原因 | 解决方案 |
|------|------|--------|
| 控制台无 API_URL 消息 | 环境变量未设置 | 创建 .env，设置 VITE_API_URL |
| "API error: 404" | 路由不存在 | 检查 app.py 是否有 /analyze 路由 |
| "API error: 500" | 服务器内部错误 | 查看后端日志，检查依赖安装 |
| "Unexpected end of JSON" | 响应为空或无效 | 检查后端是否返回 JSON，查看响应内容 |
| CORS 错误 | 跨域被阻止 | 使用 dev-proxy.js 或配置 CORS |
| 网络超时 | 后端无响应 | 检查后端是否启动，防火墙设置 |

## 使用代理解决 CORS 问题

如果遇到 CORS 错误，使用本地代理：

```bash
# 在项目根目录启动代理
node dev-proxy.js

# 在另一个终端启动前端
npm run dev

# 代理会将请求转发到 Cloud Run API
```

## 验证修复

修复后，尝试以下操作：
1. 上传一张图片或 PDF 文件
2. 检查浏览器控制台是否有完整的日志信息
3. 验证聊天窗口是否显示分析结果
4. 查看后端日志是否有成功的 POST 请求

## 相关文件

- 前端：`src/Title.jsx` - API 调用代码
- 后端：`rag1.0/app.py` - /analyze 路由
- 配置：`.env` - API URL 设置
- 代理：`dev-proxy.js` - CORS 解决方案
