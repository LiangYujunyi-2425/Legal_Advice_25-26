import os
import xml.etree.ElementTree as ET
import chromadb
from tqdm import tqdm
from sentence_transformers import SentenceTransformer
import pickle
from rank_bm25 import BM25Okapi
import jieba   # 中文斷詞

# ================== Embedding Function ==================
class BGEEmbeddingFunction:
    def __init__(self, model_name="thenlper/gte-large-zh"):   # 預設改成 gte-large-zh
        print(f"📥 載入本地模型 {model_name} ...")
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)

    def __call__(self, input: list[str]) -> list[list[float]]:
        return self.model.encode(input, show_progress_bar=False).tolist()

    def name(self) -> str:
        return f"sentence-transformers/{self.model_name}"


# ================== CleanCollection Wrapper ==================
class CleanCollection:
    def __init__(self, collection):
        self.collection = collection

    def add(self, documents, metadatas, ids):
        clean_metas = []
        for meta in metadatas:
            clean_metas.append({
                k: ("" if v is None else str(v)) for k, v in meta.items()
            })
        return self.collection.add(
            documents=documents,
            metadatas=clean_metas,
            ids=ids
        )


# ================== XML Parser ==================
def parse_xml(file_path):
    ns = {"hk": "http://www.xml.gov.hk/schemas/hklm/1.0"}
    tree = ET.parse(file_path)
    root = tree.getroot()

    cap_number = root.attrib.get("Cap", os.path.basename(file_path))
    law_name_elem = root.find(".//hk:docTitle", ns)
    law_name = law_name_elem.text if law_name_elem is not None else ""

    chunks = []

    for sec in root.findall(".//hk:section", ns):
        section_id = sec.attrib.get("id", "")
        heading_elem = sec.find("hk:heading", ns)
        heading = heading_elem.text if heading_elem is not None else ""

        text_parts = []
        for tag in ["text", "content", "paragraph"]:
            for elem in sec.findall(f".//hk:{tag}", ns):
                txt = "".join(elem.itertext()).strip()
                if txt:
                    text_parts.append(txt)

        text = "\n".join(text_parts).strip()
        if len(text) < 10:
            continue

        chunks.append({
            "cap_number": cap_number,
            "law_name": law_name,
            "section": section_id,
            "hierarchy": heading,
            "text": text
        })

    return chunks


# ================== Save to ChromaDB ==================
def save_to_chroma(chunks, model_name="thenlper/gte-large-zh"):
    client = chromadb.PersistentClient(path="./chroma_db")
    raw_collection = client.get_or_create_collection(
        name="hk_cap4_laws",
        embedding_function=BGEEmbeddingFunction(model_name)
    )
    collection = CleanCollection(raw_collection)

    print(f"📊 正在儲存 {len(chunks)} 個條文到 ChromaDB ...")

    for i, chunk in enumerate(tqdm(chunks, desc="寫入進度")):
        meta = {
            "cap_number": chunk.get("cap_number"),
            "law_name": chunk.get("law_name"),
            "section": chunk.get("section"),
            "hierarchy": chunk.get("hierarchy")
        }

        collection.add(
            documents=[chunk["text"]],
            metadatas=[meta],
            ids=[f"{meta['cap_number']}_{meta['section']}_{i}"]
        )

    print("✅ 儲存完成")

# ================== Save BM25 ==================
def save_bm25_index(chunks, save_path="bm25_index.pkl"):
    if not chunks:
        print("⚠️ 沒有條文，BM25 索引不會建立")
        return

    print("📦 正在建立 BM25 索引 ...")
    tokenized_corpus = [list(jieba.cut(chunk["text"])) for chunk in chunks]
    bm25 = BM25Okapi(tokenized_corpus)

    data = {
        "bm25": bm25,
        "chunks": chunks
    }

    with open(save_path, "wb") as f:
        pickle.dump(data, f)

    print(f"✅ BM25 索引已儲存到 {save_path}")


# ================== Main ==================
if __name__ == "__main__":
    laws_dir = "./laws"
    all_chunks = []

    for file_name in os.listdir(laws_dir):
        if not file_name.endswith(".xml"):
            continue

        file_path = os.path.join(laws_dir, file_name)
        print(f"\n📖 正在解析 {file_path} ...")
        chunks = parse_xml(file_path)
        print(f"  → 解析到 {len(chunks)} 個 chunks")

        # Debug: 顯示前 3 條
        for c in chunks[:3]:
            print("    --- 條文預覽 ---")
            print(f"    cap_number: {c['cap_number']}")
            print(f"    law_name: {c['law_name']}")
            print(f"    section: {c['section']}")
            print(f"    hierarchy: {c['hierarchy']}")
            print(f"    text: {c['text'][:80]}...")
            print("    ----------------")

        all_chunks.extend(chunks)

    if all_chunks:
        save_to_chroma(all_chunks, model_name="thenlper/gte-large-zh")  # 👈 改成 gte-large-zh
        save_bm25_index(all_chunks, "bm25_index.pkl")
    else:
        print("⚠️ 沒有解析到任何條文！")