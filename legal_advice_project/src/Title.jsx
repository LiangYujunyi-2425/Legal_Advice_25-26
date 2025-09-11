import React, { useState } from 'react';
import './index.css';

export default function CenterArea({ shrink }) {
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [dragOver, setDragOver] = useState(false);

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
      <div className="upload-zone">
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