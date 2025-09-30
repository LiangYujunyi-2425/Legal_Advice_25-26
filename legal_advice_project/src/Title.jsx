import React, { useRef, useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import Tesseract from "tesseract.js";
import addPhotoIcon from "./assets/addphoto.png";
import addPhotoIconpdf from "./assets/pdffile.png";
import addPhotoIconscreen from "./assets/diaphragm.png";
import "./index.css";

export default function Title({ shrink, onAnalysisResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [videoOpen, setVideoOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("無法取得攝像頭串流：", err);
      }
    };

    if (videoOpen) startCamera();
  }, [videoOpen]);

  const captureToPdf = async () => {
    if (!videoRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    setLoading(true);

    try {
      const { data: { text } } = await Tesseract.recognize(
        canvas,
        "eng+chi_sim",
        { logger: (m) => console.log(m) }
      );

      console.log("識別結果：", text);
      setRecognizedText(text);

      const pdf = new jsPDF();
      pdf.setFont("Helvetica");
      pdf.setFontSize(12);
      const lines = pdf.splitTextToSize(text || "未識別到文字", 180);
      pdf.text(lines, 10, 10);

      const pdfBlob = pdf.output("blob", { type: "application/pdf" });
      const pdfFile = new File([pdfBlob], "scanned_text.pdf", { type: "application/pdf" });

      const formData = new FormData();
      formData.append("file", pdfFile);

      // ✅ 呼叫後端 /analyze API
      const res = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      console.log("✅ 分析結果：", data);

      // ✅ 把結果傳給父層 (App → RightBlock)
      if (onAnalysisResult) {
        onAnalysisResult(data);
      }

    } catch (err) {
      console.error("OCR 或分析失敗：", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`centerarea ${shrink ? "shrink" : ""}`}>
      <img
        className="openbutt"
        src={videoOpen ? addPhotoIconpdf : addPhotoIcon}
        alt={videoOpen ? "隱藏攝像頭" : "顯示攝像頭"}
        onClick={() => setVideoOpen(!videoOpen)}
        style={{ width: "40px", height: "40px", cursor: "pointer", marginBottom: "10px" }}
      />

      {videoOpen && (
        <img
          className="cutscreen"
          src={addPhotoIconscreen}
          alt="拍照"
          onClick={captureToPdf}
          style={{ width: "40px", height: "40px", cursor: "pointer", marginBottom: "10px" }}
        />
      )}

      <div className={videoOpen ? "visible" : "hidden"} style={{ width: "100%", height: "100%" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "20px" }}
        />
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {recognizedText && (
        <div className="ocr-result">
          <h3>OCR 辨識結果：</h3>
          <pre>{recognizedText}</pre>
        </div>
      )}

      {loading && <p>文字識別中，請稍候...</p>}
    </div>
  );
}