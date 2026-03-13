/**
 * PDF 文本提取工具
 * 使用本地代理路由避免 CORS（同 predictClient.js 模式）
 * 支持国语、繁体中文、英文等多语言
 * 
 * 注意：后端 API 只有 /predict 端点，用于 OCR 文本分析
 * /analyze 和 /extract-pdf-text 端点不存在（404）
 */

// 使用相对路径（Vite 开发服务器会代理到 Cloud Run）
// 避免 CORS 问题，遵循 predictClient.js 的模式
const PREDICT_PROXY = '/predict';

/**
 * 从 PDF 文件中提取文本
 * @param {File} pdfFile - PDF 文件对象
 * @returns {Promise<string>} 提取的文本内容
 */
/**
 * 提取 PDF 文本（可选配置）
 * @param {File} pdfFile - PDF 文件对象
 * @param {Object} [options] - 可选项 { maxPages: number, onProgress: function }
 * @returns {Promise<string>} 提取的文本内容
 */
export async function extractPdfText(pdfFile, options = {}) {
  try {
    // 使用 PDF.js 或本地 OCR 提取
    const text = await extractPdfLocally(pdfFile, options);
    return text;
  } catch (err) {
    throw new Error(`无法提取 PDF 文本: ${err.message}`);
  }
}

/**
 * 本地提取 PDF 文本
 * 先尝试使用 pdf.js 解析 PDF 提取文本
 * 如果是扫描 PDF（无可提取文本），降级到 OCR
 * @param {File} pdfFile - PDF 文件对象
 * @returns {Promise<string>} 提取的文本内容
 */
async function extractPdfLocally(pdfFile, options = {}) {
  // 方案 1：尝试使用 PDF.js 提取文本（处理数字文本 PDF）
  try {
    const text = await extractTextViaPdfJs(pdfFile);
    if (text && text.trim().length > 50) {
      // 如果成功提取了足够的文本，返回它
      return text;
    }
  } catch (err) {
  }

  // 方案 2：转换 PDF 页面为图片，然后进行 OCR（处理扫描 PDF）
  const text = await extractTextFromPdfViaOCR(pdfFile, options);
  return text;
}

/**
 * 使用 pdf.js 库提取 PDF 文本
 * @param {File} pdfFile - PDF 文件对象
 * @returns {Promise<string>} 提取的文本内容
 */
async function extractTextViaPdfJs(pdfFile) {
  // 动态导入 pdfjs
  const pdfjsLib = await import('pdfjs-dist');
  
  // 设置 worker：使用 Vite 的 ?url 导入以便打包后能够正确加载 worker 文件
  try {
    const workerUrlModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    const workerUrl = workerUrlModule.default || workerUrlModule;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (e) {
    // 回退到 CDN（只在无法使用内置 worker 时）
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }
  
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  // 遍历所有页面提取文本
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      fullText += pageText + '\n';
    } catch (err) {
    }
  }
  
  return fullText;
}

/**
 * 通过 OCR 从 PDF 页面提取文本
 * 使用 pdf.js 将 PDF 转换为图片，然后用 Tesseract 进行 OCR
 * @param {File} pdfFile - PDF 文件对象
 * @returns {Promise<string>} 提取的文本内容
 */
async function extractTextFromPdfViaOCR(pdfFile, options = {}) {
  // options: { maxPages, onProgress }
  const { maxPages: optMaxPages, onProgress } = options;

  // 动态导入依赖
  const pdfjsLib = await import('pdfjs-dist');
  const { createWorker } = await import('tesseract.js');

  // 设置 pdf.js worker：优先使用本地打包的 worker URL（Vite ?url 导入）
  try {
    const workerUrlModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    const workerUrl = workerUrlModule.default || workerUrlModule;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch (e) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  const maxPages = Math.min(pdf.numPages, optMaxPages || 5);

  // 创建 Tesseract worker 一次复用
  const worker = createWorker({
    logger: (m) => {
      // m: { status, progress }
      if (onProgress) onProgress(m);
    }
  });

  try {
    await worker.load();
    await worker.loadLanguage('chi_tra');
    await worker.loadLanguage('eng');
    await worker.initialize('eng+chi_tra');

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        // 使用 worker 识别 canvas
        const { data: { text } } = await worker.recognize(canvas);
        fullText += (text || '') + '\n---\n';

        if (onProgress) onProgress({ page: pageNum, status: 'page_done' });
      } catch (err) {
        if (onProgress) onProgress({ page: pageNum, status: 'page_error', error: err.message });
      }
    }
  } finally {
    await worker.terminate();
  }

  return fullText || '（无法识别文字）';
}

/**
 * 从 PDF 文件获取基本信息（可选）
 * @param {File} pdfFile - PDF 文件对象
 * @returns {Promise<Object>} PDF 信息
 */
export async function getPdfInfo(pdfFile) {
  return {
    name: pdfFile.name,
    size: pdfFile.size,
    type: pdfFile.type,
    lastModified: new Date(pdfFile.lastModified),
  };
}

export default {
  extractPdfText,
  getPdfInfo,
};
