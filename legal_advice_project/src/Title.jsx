import React, { useRef, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import Tesseract from 'tesseract.js';
import addPhotoIcon from './assets/addphoto.png';
import addPhotoIconpdf from './assets/pdffile.png';
import addPhotoIconscreen from './assets/diaphragm.png';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function Title({ shrink, videoOpen, setVideoOpen, onAnalysisResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');

  useEffect(() => {
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

  const captureToPdf = async () => {
    if (!videoRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    setLoading(true);

    try {
      const { data: { text } } = await Tesseract.recognize(
        canvas,
        'eng+chi_tra',
        { logger: (m) => console.log(m) }
      );

      setRecognizedText(text || '');

      const pdf = new jsPDF();
      pdf.setFont('Helvetica');
      pdf.setFontSize(12);
      const lines = pdf.splitTextToSize(text || '未識別到文字', 180);
      pdf.text(lines, 10, 10);

      const pdfBlob = pdf.output('blob', { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], 'scanned_text.pdf', { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', pdfFile);

      // call backend analyze
      const res = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (onAnalysisResult) onAnalysisResult(data);
    } catch (err) {
      console.error('OCR 或分析失敗：', err);
    } finally {
      setLoading(false);
    }
  };

  // Provide a compact left panel UI for uploads/camera
  return (
    <aside className={`left-panel ${shrink ? 'collapsed' : ''} ${videoOpen ? 'expanded' : ''}`} aria-label="上傳與掃描面板">
      <div className="left-controls">
        <button className="icon-btn" aria-pressed={videoOpen} onClick={() => setVideoOpen(!videoOpen)} aria-label={videoOpen ? '隱藏攝像頭' : '顯示攝像頭'}>
          <img className="left-icon" src={videoOpen ? addPhotoIconpdf : addPhotoIcon} alt="" aria-hidden="true" />
        </button>

        {videoOpen && (
          <button className="icon-btn" onClick={captureToPdf} aria-label="拍照並上傳">
            <img className="left-icon capture" src={addPhotoIconscreen} alt="" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={`left-content ${videoOpen ? 'video' : ''}`}>
        {videoOpen ? (
          <video ref={videoRef} autoPlay muted playsInline className="left-video" />
        ) : (
          <div className="upload-hint">上傳 PDF 或點擊相機拍照進行 OCR</div>
        )}

        <label className="file-label" tabIndex={0} aria-label="上傳檔案">
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const formData = new FormData();
              formData.append('file', file);
              setLoading(true);
              try {
                const res = await fetch(`${API_URL}/analyze`, { method: 'POST', body: formData });
                const data = await res.json();
                if (onAnalysisResult) onAnalysisResult(data);
              } catch (err) {
                console.error(err);
              } finally {
                setLoading(false);
              }
            }}
          />
          <span className="sr-only">上傳檔案 (PDF 或 圖片)</span>
        </label>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {loading && <div className="loading" role="status">處理中...</div>}

        {recognizedText && (
          <div className="ocr-result">
            <h4>OCR 結果</h4>
            <pre>{recognizedText}</pre>
          </div>
        )}
      </div>
    </aside>
  );
}