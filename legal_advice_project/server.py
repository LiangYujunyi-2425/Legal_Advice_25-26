from flask import Flask, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'rag1.0', 'contracts')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/upload', methods=['POST'])
def upload_pdf():
    print("📡 收到 /upload 請求")
    print("🔍 request.files:", request.files)

    if 'file' not in request.files:
        print("❌ 沒有 'file' 字段")
        return 'No file field in request', 400

    file = request.files['file']
    if file.filename == '':
        print("❌ 收到空文件名")
        return 'Empty filename', 400

    save_path = os.path.join(UPLOAD_FOLDER, file.filename)
    try:
        file.save(save_path)
        print(f"✅ 文件已保存到：{save_path}")
        return 'PDF uploaded successfully', 200
    except Exception as e:
        print(f"❌ 保存文件失敗：{e}")
        return 'Failed to save file', 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)

