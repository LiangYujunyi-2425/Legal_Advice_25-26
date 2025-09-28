import os
import re
import pdfplumber
import docx
import chromadb
from sentence_transformers import SentenceTransformer

# ================== Embedding Function ==================
class GTEEmbeddingFunction:
    def __init__(self, model_name="thenlper/gte-large-zh"):
        print(f"📥 載入本地模型 {model_name} ...")
        self.model = SentenceTransformer(model_name)

    def __call__(self, input: list[str]) -> list[list[float]]:
        return self.model.encode(input, show_progress_bar=False).tolist()

    def name(self) -> str:
        return "thenlper/gte-large-zh"


# ================== 文件解析 ==================
def load_contract(file_path):
    text = ""
    if file_path.endswith(".pdf"):
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    elif file_path.endswith(".docx"):
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    elif file_path.endswith(".txt"):
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        raise ValueError("❌ 不支援的檔案格式（僅支援 PDF / DOCX / TXT）")
    return re.sub(r"\s+", " ", text).strip()


# ================== Chunking ==================
def split_into_clauses(text, max_len=500):
    clauses = re.split(r"[。；\n]", text)
    chunks = []
    buffer = ""
    for clause in clauses:
        if len(buffer) + len(clause) > max_len:
            chunks.append(buffer.strip())
            buffer = clause
        else:
            buffer += " " + clause
    if buffer:
        chunks.append(buffer.strip())
    return chunks


# ================== 存入 ChromaDB ==================
def save_contract(file_path, contract_name="contract"):
    client = chromadb.PersistentClient(path="./chroma_db")
    collection = client.get_or_create_collection(
        name="contracts",
        embedding_function=GTEEmbeddingFunction("thenlper/gte-large-zh")
    )

    text = load_contract(file_path)
    chunks = split_into_clauses(text, max_len=500)

    for i, chunk in enumerate(chunks):
        meta = {"contract": contract_name, "clause_id": i}
        collection.add(
            documents=[chunk],
            metadatas=[meta],
            ids=[f"{contract_name}_{i}"]
        )

    print(f"✅ 已將 {len(chunks)} 個條款存入 contracts collection")


# ================== 主程式 ==================
if __name__ == "__main__":
    file_path = input("📂 請輸入合約檔案路徑 (PDF/DOCX/TXT): ").strip()

    if not os.path.exists(file_path):
        print("❌ 找不到檔案，請確認路徑是否正確")
    else:
        # 自動用檔名作為合約名稱
        contract_name = os.path.splitext(os.path.basename(file_path))[0]
        save_contract(file_path, contract_name=contract_name)
