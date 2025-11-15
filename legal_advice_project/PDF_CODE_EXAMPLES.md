# PDF 识别与 AI 对话 - 代码示例和集成细节

## 完整的工作流程代码

### 1. PDF 提取流程

```javascript
// src/api/pdfExtractor.js

export async function extractPdfText(pdfFile) {
  try {
    // 尝试方式 A：专用 extract-pdf-text 端点
    return await extractPdfViaBackend(pdfFile);
  } catch (err) {
    console.warn('方式 A 失败，尝试方式 B...');
    // 自动降级到方式 B：analyze 端点
    return await extractPdfViaAnalyze(pdfFile);
  }
}

async function extractPdfViaBackend(pdfFile) {
  const API_URL = import.meta.env.VITE_API_URL || '';
  
  const formData = new FormData();
  formData.append('file', pdfFile);
  formData.append('extract_text_only', 'true');

  const response = await fetch(`${API_URL}/extract-pdf-text`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const data = await response.json();
  return data.text || data.error ? data.error : '无法提取文本';
}

async function extractPdfViaAnalyze(pdfFile) {
  const API_URL = import.meta.env.VITE_API_URL || '';
  
  const formData = new FormData();
  formData.append('file', pdfFile);

  const response = await fetch(`${API_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const data = await response.json();
  return data.ocr_text || data.text || JSON.stringify(data);
}
```

### 2. 文本转发到聊天

```javascript
// src/Title.jsx - 新增函数

const sendTextToChat = (text, source = '文档') => {
  if (!text) {
    console.warn('没有文本内容发送');
    return;
  }

  // 触发自定义事件
  window.dispatchEvent(new CustomEvent('pdf:textExtracted', {
    detail: {
      text: text,
      source: source,  // 'PDF'、'图片'、'摄像头'
      timestamp: new Date().toISOString()
    }
  }));

  setRecognizedText(text);
  console.log(`✅ 已识别文本（来自 ${source}）`);
};
```

### 3. 聊天框集成

```javascript
// src/block.jsx - 新增事件监听

useEffect(() => {
  const handlePdfTextExtracted = (event) => {
    const { detail } = event;
    if (!detail || !detail.text) return;

    const { text, source } = detail;
    
    // 打开聊天窗口
    setVisible(true);

    console.log(`📄 从 ${source} 提取的文本`);
    
    // 自动发送给 AI（300ms 延迟以确保 UI 更新）
    setTimeout(() => {
      sendMessage(text);
    }, 300);
  };

  window.addEventListener('pdf:textExtracted', handlePdfTextExtracted);
  return () => window.removeEventListener('pdf:textExtracted', handlePdfTextExtracted);
}, [setVisible, sendMessage]);
```

## 完整的文件处理流程

### 图片文件处理

```javascript
// src/Title.jsx - handleFile 方法（图片部分）

if (file.type.startsWith('image/')) {
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      // 1. OCR 识别
      const { data: { text } } = await Tesseract.recognize(
        event.target.result,
        'eng+chi_tra',
        { logger: (m) => console.log('OCR进度:', m) }
      );
      
      setRecognizedText(text || '');

      // 2. 发送到聊天框
      sendTextToChat(text, '图片');
      
      // 3. 同时发送给后端分析
      if (text) {
        const res = await fetch(`${API_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        
        const data = await res.json();
        if (onAnalysisResult) onAnalysisResult(data);
      }
    } catch (err) {
      console.error('图片处理失败:', err);
    } finally {
      setLoading(false);
    }
  };
  
  reader.readAsDataURL(file);
}
```

### PDF 文件处理

```javascript
// src/Title.jsx - handleFile 方法（PDF 部分）

else if (file.type === 'application/pdf') {
  try {
    console.log('正在提取 PDF 文本...');
    
    // 1. 使用 pdfExtractor 提取文本
    const pdfText = await extractPdfText(file);
    
    // 2. 发送到聊天框（自动打开聊天并发送给 AI）
    sendTextToChat(pdfText, 'PDF');
    
    // 3. 同时发送给后端分析
    if (pdfText) {
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pdfText }),
      });
      
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      
      const data = await res.json();
      if (onAnalysisResult) onAnalysisResult(data);
    }
  } catch (err) {
    console.error('PDF 提取失败:', err);
    
    // 备选方案：直接上传 PDF 给后端
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      
      const data = await res.json();
      if (data.ocr_text) {
        sendTextToChat(data.ocr_text, 'PDF');
      }
      if (onAnalysisResult) onAnalysisResult(data);
    } catch (fallbackErr) {
      console.error('PDF 处理完全失败:', fallbackErr);
      alert('PDF 处理失败，请检查文件格式');
    }
  } finally {
    setLoading(false);
  }
}
```

### 摄像头处理

```javascript
// src/Title.jsx - captureToPdf 方法

const captureToPdf = async () => {
  if (!videoRef.current) return;

  const canvas = canvasRef.current;
  const context = canvas.getContext('2d');
  canvas.width = videoRef.current.videoWidth;
  canvas.height = videoRef.current.videoHeight;
  context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

  setLoading(true);

  try {
    // 1. OCR 识别
    const { data: { text } } = await Tesseract.recognize(
      canvas,
      'eng+chi_tra',
      { logger: (m) => console.log('OCR进度:', m) }
    );

    setRecognizedText(text || '');

    // 2. 发送到聊天框
    sendTextToChat(text, '摄像头');

    // 3. 后端分析
    if (text) {
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      if (onAnalysisResult) onAnalysisResult(data);
    }

    // 可选：生成 PDF 供下载
    const pdf = new jsPDF();
    pdf.setFont('Helvetica');
    const lines = pdf.splitTextToSize(text || '未识别到文字', 180);
    pdf.text(lines, 10, 10);
    // 用户可点击下载
    
  } catch (err) {
    console.error('摄像头处理失败:', err);
  } finally {
    setLoading(false);
  }
};
```

## 拖放文件处理

```javascript
// src/Title.jsx - 拖放事件处理

const handleDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();
  setDragActive(false);

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    
    // 验证文件类型
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      handleFile(file);  // 使用统一的处理函数
    } else {
      console.error('只支持 PDF 和图片文件');
    }
  }
};

// 添加拖放事件监听
useEffect(() => {
  const element = leftContentRef.current;
  if (!element) return;

  element.addEventListener('dragenter', handleDragIn);
  element.addEventListener('dragleave', handleDragOut);
  element.addEventListener('dragover', handleDrag);
  element.addEventListener('drop', handleDrop);

  return () => {
    element.removeEventListener('dragenter', handleDragIn);
    element.removeEventListener('dragleave', handleDragOut);
    element.removeEventListener('dragover', handleDrag);
    element.removeEventListener('drop', handleDrop);
  };
}, []);
```

## AI 对话集成

```javascript
// src/block.jsx - sendMessage 方法

const sendMessage = async (textArg) => {
  const text = (typeof textArg === 'string' ? textArg : input).trim();
  if (!text) return;

  // 1. 添加用户消息
  const userMessage = { role: 'user', content: text };
  setMessages(prev => [...prev, 
    userMessage, 
    { role: 'assistant', content: 'AI 团队正在分析您的问题…' }
  ]);
  setInput('');
  setAiMood('thinking');

  // 2. 流式获取 AI 响应
  (async () => {
    try {
      let accumulated = '';
      
      // 使用 streamPredict 获取流式响应
      for await (const chunk of streamPredict(text, false)) {
        let piece = '';
        
        // 处理不同类型的响应
        if (typeof chunk === 'string') {
          piece = chunk;
        } else if (chunk && chunk.output) {
          piece = chunk.output;
        } else if (chunk && chunk.agent) {
          // 多智能体响应（律师、法官等）
          // 显示为圆桌讨论
          setVisible(false);  // 隐藏中央气泡
          // 处理多智能体消息...
          continue;
        }
        
        accumulated += piece;

        // 3. 实时更新聊天窗口
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { 
            role: 'assistant', 
            content: accumulated 
          };
          return copy;
        });
      }

      // 4. 完成响应
      setAiMood('happy');
      setTimeout(() => setAiMood('neutral'), 900);

    } catch (err) {
      console.error('AI 分析失败:', err);
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { 
          role: 'assistant', 
          content: `❌ 错误：${String(err)}` 
        };
        return copy;
      });
      setAiMood('sad');
    }
  })();
};
```

## 自定义事件数据结构

```javascript
// PDF 提取完成事件

interface PdfTextExtractedEvent {
  detail: {
    text: string;           // 提取的文本内容
    source: string;         // 来源：'PDF'、'图片'、'摄像头'
    timestamp: string;      // ISO 格式时间戳
  }
}

// 使用示例
window.dispatchEvent(new CustomEvent('pdf:textExtracted', {
  detail: {
    text: "识别出来的文本内容...",
    source: 'PDF',
    timestamp: '2025-11-15T10:30:00Z'
  }
}));
```

## 错误处理示例

```javascript
// 完整的错误处理流程

const handleFile = async (file) => {
  setLoading(true);
  try {
    // 1. 文件验证
    if (!file) {
      throw new Error('未选择文件');
    }

    // 2. 类型检查
    if (file.type === 'application/pdf') {
      // 3. PDF 处理
      try {
        const pdfText = await extractPdfText(file);
        if (!pdfText) {
          throw new Error('PDF 为空或无法读取');
        }
        
        sendTextToChat(pdfText, 'PDF');
        
      } catch (pdfErr) {
        // 详细的错误信息
        console.error('PDF 错误详情:', {
          message: pdfErr.message,
          file: file.name,
          size: file.size,
          type: file.type
        });
        
        // 用户友好的提示
        alert(`无法处理 PDF 文件:\n${pdfErr.message}`);
        throw pdfErr;
      }
      
    } else if (file.type.startsWith('image/')) {
      // 4. 图片处理
      try {
        const { data: { text } } = await Tesseract.recognize(
          /* ... */
        );
        sendTextToChat(text, '图片');
        
      } catch (ocrErr) {
        console.error('OCR 错误:', ocrErr);
        alert('图片识别失败，请尝试其他图片');
        throw ocrErr;
      }
      
    } else {
      throw new Error(`不支持的文件类型: ${file.type}`);
    }

  } catch (err) {
    // 统一错误处理
    console.error('文件处理失败:', err);
    setAiMood('sad');
    
  } finally {
    // 清理状态
    setLoading(false);
    setAiMood('neutral');
  }
};
```

## 调试和日志

```javascript
// 完整的调试日志系统

// 1. API 配置日志
console.log('API_URL configured:', API_URL || 'NOT SET');

// 2. 文件处理日志
console.log('处理文件:', {
  name: file.name,
  type: file.type,
  size: file.size,
  timestamp: new Date().toISOString()
});

// 3. 文本提取日志
console.log('✅ 已识别文本（来自 ' + source + '）:', 
  text.substring(0, 100) + '...');

// 4. 事件触发日志
console.log('📄 从 ' + source + ' 提取的文本，自动发送到聊天:', 
  text.substring(0, 100) + '...');

// 5. API 请求日志
console.log('API 请求:', {
  url: `${API_URL}/analyze`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  bodySize: JSON.stringify({ text }).length
});

// 6. AI 响应日志
console.log('AI 响应:', {
  type: 'streaming',
  chunks: chunkCount,
  totalLength: accumulated.length
});
```

## 性能优化建议

```javascript
// 1. 文本去重
const textCache = new Set();
const sendTextToChat = (text, source) => {
  const hash = text.substring(0, 50);  // 简单哈希
  if (textCache.has(hash)) {
    console.warn('文本已处理过，跳过');
    return;
  }
  textCache.add(hash);
  // ... 发送逻辑
};

// 2. 延迟加载
const sendMessage = async (textArg) => {
  // 使用 requestIdleCallback 进行后台处理
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => processMessage(textArg));
  } else {
    setTimeout(() => processMessage(textArg), 0);
  }
};

// 3. 内存管理
useEffect(() => {
  return () => {
    // 清理事件监听
    window.removeEventListener('pdf:textExtracted', handler);
    // 清理定时器
    playTimersRef.current.forEach(t => clearTimeout(t));
    // 清理引用
    textCache.clear();
  };
}, []);
```

---

**代码示例版本**：1.0  
**最后更新**：2025-11-15  
**使用场景**：开发、调试、集成参考
