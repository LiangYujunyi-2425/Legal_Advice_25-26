import React, { useState, useRef, useEffect  } from 'react';
import './index.css';
import addPhotoIcon from './assets/addphoto.png';
import addPhotoIconpdf from './assets/pdffile.png';
import addPhotoIconscreen from './assets/diaphragm.png';
import { jsPDF } from 'jspdf';


export default function CenterArea({ shrink }) {
  const [file, setFile ] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const videoRef = useRef(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const canvasRef = useRef(null);


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
      URL.revokeObjectURL(previewURL); // 釋放記憶體
      setPreviewURL(null);
    }
  };

  useEffect(() => {
      const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
          videoRef.current.srcObject = stream;
          }} 
          catch (err) {
          console.error('無法取得攝像頭串流：', err);
          }
      };

        startCamera();
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageDataURL = canvas.toDataURL('image/png');
      setPreviewURL(imageDataURL);
      setFile(imageDataURL);

      // 直接轉成 PDF 並下載
      const pdf = new jsPDF();
      pdf.addImage(imageDataURL, 'PNG', 10, 10, 180, 160);
      pdf.save('captured-image.pdf');
    }
  };



  return (
  <div>
    <canvas ref={canvasRef} style={{ display: 'none' }} />
    <div
      className={`centerarea ${dragOver ? 'drag-over' : ''} ${shrink ? 'shrink' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* 圖片按鈕 */}
      <img className='openbutt'
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
      <img className= {videoOpen ? 'cutscreen' : 'cutscreenoff'}
        src={addPhotoIconscreen}
        onClick={handleCapture}
        style={{
          width: '40px',
          height: '40px',
          cursor: 'pointer',
          marginBottom: '10px',
        }}></img>
      <div className= {videoOpen ? 'visible' : 'hidden'} style={{ width: '100%', height: '100%'}}>
        <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' , borderRadius: '20px' }}/>
      </div>
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
  </div>
  );
}