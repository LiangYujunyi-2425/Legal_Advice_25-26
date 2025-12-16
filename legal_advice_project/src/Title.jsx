import React, { useRef, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
// 使用动态导入 Tesseract worker（在需要时创建/终止）
import addPhotoIcon from './assets/addphoto.png';
import addPhotoIconpdf from './assets/pdffile.png';
import addPhotoIconscreen from './assets/diaphragm.png';
import { extractPdfText } from './api/pdfExtractor';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// 调试：打印 API 配置
console.log('API_URL configured:', API_URL || 'NOT SET - using relative paths');

export default function Title({ shrink, videoOpen, setVideoOpen, onAnalysisResult, onRecognizedText }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [pdfProgress, setPdfProgress] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const leftContentRef = useRef(null);
  const fileInputRef = useRef(null);
  // 智能語音輸入開關，預設開啓（persist 到 localStorage）
  const [voiceAutoEnabled, setVoiceAutoEnabled] = useState(true);

  useEffect(() => {
    // 讀取語音自動開啓設定（預設 true）並廣播初始狀態
    try {
      const saved = localStorage.getItem('voiceAutoEnabled');
      const enabled = saved === null ? true : JSON.parse(saved);
      setVoiceAutoEnabled(enabled);
      // 廣播給其他組件（例如 chat）讓它們可以根據此設定決定是否自動啓動語音輸入
      window.dispatchEvent(new CustomEvent('voice:autoToggle', { detail: { enabled } }));
    } catch (err) {
      console.warn('讀取 voiceAutoEnabled 時發生錯誤，使用預設 true', err);
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('無法取得攝像頭串流：', err);
      }
    };

    if (videoOpen) startCamera();
  }, [videoOpen]);

  // 将识别的文本直接发送到聊天框
  const sendTextToChat = (text, source = '文档') => {
    if (!text) {
      console.warn('没有文本内容发送');
      return;
    }

    // 通过事件系统将文本发送到聊天框
    window.dispatchEvent(new CustomEvent('pdf:textExtracted', {
      detail: {
        text: text,
        source: source,
        timestamp: new Date().toISOString()
      }
    }));

    // 同时记录文本
    setRecognizedText(text);
    console.log(`✅ 已识别文本（来自 ${source}）:`, text.substring(0, 100) + '...');
  };

  // Helper: 使用 tesseract worker 识别图片或 canvas
  async function ocrWithWorker(imageOrCanvas, onProgress) {
    const { createWorker } = await import('tesseract.js');
    const worker = createWorker({ logger: onProgress });
    try {
      await worker.load();
      await worker.loadLanguage('chi_tra');
      await worker.loadLanguage('eng');
      await worker.initialize('eng+chi_tra');
      const { data: { text } } = await worker.recognize(imageOrCanvas);
      return text;
    } finally {
      await worker.terminate();
    }
  }

  // 通用的文件處理函數
  const handleFile = async (file) => {
    if (!file) return;

    setLoading(true);
    try {
      // 檢查是否是圖片，如果是則進行 OCR
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const imgData = event.target.result;
            const text = await ocrWithWorker(imgData, (m) => console.log('img OCR:', m));
            setRecognizedText(text || '');

            // 将 OCR 识别的文字直接发送到聊天框
            sendTextToChat(text, '图片');
          } catch (err) {
            console.error('圖片 OCR 失敗:', err);
          } finally {
            setLoading(false);
          }
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // PDF 文本提取
        try {
          console.log('正在提取 PDF 文本...');
          // 传入进度回调与最大页数
          const pdfText = await extractPdfText(file, {
            maxPages: 5,
            onProgress: (m) => {
              // m 可能是 tesseract 的 logger 或我们自定义的页面进度对象
              if (m.page) {
                const msg = `頁 ${m.page}: ${m.status || '完成'}`;
                setPdfProgress(msg);
                console.log(msg);
              } else if (m.status) {
                const pct = typeof m.progress === 'number' ? Math.round(m.progress * 100) : '';
                const msg = `${m.status} ${pct ? `(${pct}%)` : ''}`;
                setPdfProgress(msg);
                console.log('Tesseract:', msg);
              }
            }
          });

          // 清除进度显示
          setPdfProgress(null);

          // 将提取的文本直接发送到聊天框（AI 分析由 block.jsx 处理）
          sendTextToChat(pdfText, 'PDF');
        } catch (err) {
          console.error('PDF 提取失败:', err);
          alert('PDF 处理失败: ' + err.message);
        } finally {
          setLoading(false);
        }
      } else {
        console.error('不支援的檔案類型');
        setLoading(false);
      }
    } catch (err) {
      console.error('檔案處理失敗:', err);
      setLoading(false);
    }
  };

  const captureToPdf = async () => {
    if (!videoRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    setLoading(true);

    try {
      const text = await ocrWithWorker(canvas, (m) => console.log('camera OCR:', m));

      setRecognizedText(text || '');

      // 将识别的文本直接发送到聊天框
      sendTextToChat(text, '摄像头');

      // 同時也生成 PDF 以供下載參考
      const pdf = new jsPDF();
      pdf.setFont('Helvetica');
      pdf.setFontSize(12);
      const lines = pdf.splitTextToSize(text || '未識別到文字', 180);
      pdf.text(lines, 10, 10);

      const pdfBlob = pdf.output('blob', { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'scanned_text.pdf', { type: 'application/pdf' });

      // AI 分析通过 block.jsx 中的 streamPredict 处理
    } catch (err) {
      console.error('OCR 或分析失敗：', err);
    } finally {
      setLoading(false);
    }
  };

  // 拖拽事件處理
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    // 獲取拖拽的檔案
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // 檢查檔案類型
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        handleFile(file);
      } else {
        console.error('只支援 PDF 和圖片檔案');
      }
    }
  };

  // 為左側面板添加拖拽事件監聽
  useEffect(() => {
    const element = leftContentRef.current;
    if (!element) return;

    element.addEventListener('drag', handleDrag);
    element.addEventListener('dragenter', handleDragIn);
    element.addEventListener('dragleave', handleDragOut);
    element.addEventListener('dragover', handleDrag);
    element.addEventListener('drop', handleDrop);

    return () => {
      element.removeEventListener('drag', handleDrag);
      element.removeEventListener('dragenter', handleDragIn);
      element.removeEventListener('dragleave', handleDragOut);
      element.removeEventListener('dragover', handleDrag);
      element.removeEventListener('drop', handleDrop);
    };
  }, []);

  // 當 AI 回復完成時，如果開啓自動語音輸入則通知啓動語音輸入
  useEffect(() => {
    const onAIResponse = (e) => {
      if (voiceAutoEnabled) {
        // 發出一個全局事件，其他負責語音輸入的組件可以監聽並啓動語音輸入
        window.dispatchEvent(new CustomEvent('voice:shouldStart', { detail: { source: 'ai' } }));
      }
    };

    window.addEventListener('ai:responseComplete', onAIResponse);
    return () => {
      window.removeEventListener('ai:responseComplete', onAIResponse);
    };
  }, [voiceAutoEnabled]);

  // 為左側面板添加拖拽事件監聽
  useEffect(() => {
    const element = leftContentRef.current;
    if (!element) return;

    element.addEventListener('drag', handleDrag);
    element.addEventListener('dragenter', handleDragIn);
    element.addEventListener('dragleave', handleDragOut);
    element.addEventListener('dragover', handleDrag);
    element.addEventListener('drop', handleDrop);

    return () => {
      element.removeEventListener('drag', handleDrag);
      element.removeEventListener('dragenter', handleDragIn);
      element.removeEventListener('dragleave', handleDragOut);
      element.removeEventListener('dragover', handleDrag);
      element.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Provide a compact left panel UI for uploads/camera
  // only expand the left-panel for camera when videoOpen is true and the center bubble is not shrunk/open
  const leftPanelClass = `left-panel ${shrink ? 'collapsed' : ''} ${videoOpen && !shrink ? 'expanded' : ''}`;

  return (
    <aside className={leftPanelClass} aria-label="上傳與掃描面板">
      <div className="left-controls">
        <button className="icon-btn" aria-pressed={videoOpen} onClick={() => setVideoOpen(!videoOpen)} aria-label={videoOpen ? '隱藏攝像頭' : '顯示攝像頭'}>
          <img className="left-icon" src={videoOpen ? addPhotoIconpdf : addPhotoIcon} alt="" aria-hidden="true" />
        </button>

        {videoOpen && (
          <button className="icon-btn" onClick={captureToPdf} aria-label="拍照並上傳">
            <img className="left-icon capture" src={addPhotoIconscreen} alt="" aria-hidden="true" />
          </button>
        )}
        {/* 智能語音自動啟動開關按鈕 */}
        
        {/* Mobile-only upload button: triggers the hidden file input for mobile users */}
        <button
          className="icon-btn mobile-upload-btn"
          onClick={() => { try { fileInputRef.current?.click(); } catch (e) { console.warn('mobile upload click failed', e); } }}
          aria-label="手機上傳檔案"
          title="上傳檔案"
        >
          <img className="left-icon" src={addPhotoIconpdf} alt="上傳" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={leftContentRef}
        className={`left-content ${videoOpen ? 'video' : ''} ${dragActive ? 'drag-active' : ''}`}
        style={dragActive ? { backgroundColor: 'rgba(100, 150, 255, 0.1)', borderColor: '#4a90e2' } : {}}
      >
        {videoOpen ? (
          <video ref={videoRef} autoPlay muted playsInline className="left-video" />
        ) : (
          <div className="upload-hint">
            拖拽 PDF 或圖片到此處
            <br />
            或點擊相機拍照進行 OCR
          </div>
        )}

        <label className="file-label" tabIndex={0} aria-label="上傳檔案">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFile(file);
              }
            }}
          />
          <span className="sr-only">上傳檔案 (PDF 或 圖片)</span>
        </label>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {loading && <div className="loading" role="status">處理中...</div>}

        {pdfProgress && (
          <div className="pdf-progress" aria-live="polite">{pdfProgress}</div>
        )}

        {recognizedText && (
          <div className="ocr-result" style={{ color: 'rgba(248, 250, 255, 1)' }} >
            <h4>OCR 結果</h4>
            <pre>已經處理，請打開ai顯示</pre>
          </div>
        )}
      </div>
    </aside>
  );
}