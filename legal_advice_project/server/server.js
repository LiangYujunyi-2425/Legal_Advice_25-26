const express = require('express');
const multer = require('multer');
const cors = require('cors');
const tesseract = require('node-tesseract-ocr');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
const upload = multer({ dest: 'uploads/' });

app.post('/api/generate-pdf', upload.single('image'), async (req, res) => {
  const imagePath = req.file.path;

  try {
    const text = await tesseract.recognize(imagePath, { lang: 'chi_sim' });

    // 生成 PDF
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdfBuffer);
    });

    doc.fontSize(12).text(text);
    doc.end();
  } catch (err) {
    res.status(500).send('處理失敗');
  } finally {
    fs.unlinkSync(imagePath);
  }
});

app.listen(5000, () => console.log('後端啟動在 http://localhost:5000'));