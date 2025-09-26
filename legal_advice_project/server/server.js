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
    console.log('PDF 正在生成到：', outputPath);
    // 生成 PDF
    const timestamp = Date.now();
    const outputPath = path.join(__dirname, `output_${timestamp}.pdf`);
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(outputPath));
    doc.fontSize(12).text(text);
    doc.end();
  } catch (err) {
    res.status(500).send('處理失敗');
  } finally {
    fs.unlinkSync(imagePath);
  }
});

app.listen(5000, () => console.log('後端啟動在 http://localhost:5000'));