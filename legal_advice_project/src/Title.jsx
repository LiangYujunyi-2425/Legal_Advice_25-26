import React, { useState, useRef, useEffect  } from 'react';
import './index.css';
import addPhotoIcon from './assets/addphoto.png';
import addPhotoIconpdf from './assets/pdffile.png';
import addPhotoIconscreen from './assets/diaphragm.png';

export default function CenterArea({ shrink }) {
  const [file, setFile ] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const videoRef = useRef(null);
  const [videoOpen, setVideoOpen] = useState(false);

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
  const handleCapture = async () => {
    if (!videoRef.current) return;

    // 1. 截取畫面
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    // 2. 上傳到後端
    const formData = new FormData();
    formData.append('image', blob);

    try {
      const response = await fetch('http://localhost:5000/api/generate-pdf', {
        method: 'POST',
        body: formData,
      });

      const fileBlob = await response.blob();
      const fileURL = URL.createObjectURL(fileBlob);

      // 3. 顯示 PDF
      window.open(fileURL, '_blank');
    } catch (err) {
      console.error('處理失敗：', err);
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
        }}/>
      <div className= {videoOpen ? 'visible' : 'hidden'} style={{ width: '100%', height: '100%'}}>
        <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' , borderRadius: '20px' }}/>
      </div>
      <button
  onClick={handleCapture}
  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
>
  <img
    className={videoOpen ? 'cutscreen' : 'cutscreenoff'}
    src={addPhotoIconscreen}
    style={{
      width: '40px',
      height: '40px',
      marginBottom: '10px',
    }}
    alt="截取畫面"
  />
</button>

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