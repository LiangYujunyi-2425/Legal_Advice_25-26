import React, { useState, useRef, useEffect } from 'react';
import './index.css';
import addPhotoIcon from './assets/addphoto.png';
import addPhotoIconpdf from './assets/pdffile.png';
import addPhotoIconscreen from './assets/diaphragm.png';
import jsPDF from 'jspdf';

export default function Title({ shrink }) {
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const videoRef = useRef(null);
  const [videoOpen, setVideoOpen] = useState(false);

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
    startCamera();
  }, []);

  // 📸 拍照並生成 PDF → 自動下載
  const captureToPdf = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);

    const pdfName = `capture_${new Date().getTime()}.pdf`;
    pdf.save(pdfName); // ⬅️ 直接下載
    console.log("📄 PDF 已生成並下載：", pdfName);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewURL(URL.createObjectURL(selectedFile));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setPreviewURL(URL.createObjectURL(droppedFile));
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (previewURL) {
      URL.revokeObjectURL(previewURL);
      setPreviewURL(null);
    }
  };

  return (
    <div
      className={`centerarea ${dragOver ? 'drag-over' : ''} ${shrink ? 'shrink' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* 開關相機按鈕 */}
      <img
        className='openbutt'
        src={videoOpen ? addPhotoIconpdf : addPhotoIcon}
        alt={videoOpen ? '隱藏攝像頭' : '顯示攝像頭'}
        onClick={() => setVideoOpen(!videoOpen)}
        style={{
          width: '40px',
          height: '40px',
          cursor: 'pointer',
          marginBottom: '10px',
        }}
      />
      {/* 拍照按鈕 */}
      {videoOpen && (
        <img
          className='cutscreen'
          src={addPhotoIconscreen}
          onClick={captureToPdf}
          style={{
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            marginBottom: '10px',
          }}
        />
      )}

      {/* 相機畫面 */}
      <div className={videoOpen ? 'visible' : 'hidden'} style={{ width: '100%', height: '100%'}}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px' }}
        />
      </div>

      {/* 上傳區域 */}
      <div className={videoOpen ? 'infooff' : 'upload-zone'}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <p>或將檔案拖曳到此區域</p>

        {file && (
          <div className="file-info">
            <p>已選擇檔案：{file.name}</p>
            <button className="remove-btn" onClick={handleRemoveFile}>
              移除檔案
            </button>
          </div>
        )}

        {previewURL && (
          <div className="preview-area">
            <img src={previewURL} alt="預覽圖片" className="preview-img" />
          </div>
        )}
      </div>
    </div>
  );
}
