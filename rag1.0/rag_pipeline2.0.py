import os
import pickle
import requests
import chromadb
from sentence_transformers import SentenceTransformer, CrossEncoder
from rank_bm25 import BM25Okapi
import jieba
from dotenv import load_dotenv

# ================== 環境變數 ==================
load_dotenv()

# ================== Embedding Function ==================
class GTEEmbeddingFunction:
    def __init__(self, model_name="thenlper/gte-large-zh"):
        print(f"📥 載入本地模型 {model_name} ...")
        self.model = SentenceTransformer(model_name)
        self.model_name = model_name

    def __call__(self, input: list[str]) -> list[list[float]]:
        return self.model.encode(input, show_progress_bar=False).tolist()

    def name(self) -> str:
        return f"sentence-transformers/{self.model_name}"

# 初始化模型
embedder = SentenceTransformer("thenlper/gte-large-zh")
reranker = CrossEncoder("BAAI/bge-reranker-large")

# ================== Chroma 初始化 ==================
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(
    name="hk_cap4_laws",
    embedding_function=GTEEmbeddingFunction("thenlper/gte-large-zh")
)

# ================== BM25 (載入索引) ==================
if not os.path.exists("bm25_index.pkl"):
    raise FileNotFoundError("❌ 找不到 bm25_index.pkl，請先執行 batch_cap4.py")

with open("bm25_index.pkl", "rb") as f:
    bm25_data = pickle.load(f)
bm25 = bm25_data["bm25"]
bm25_chunks = bm25_data["chunks"]

# ================== Gemini API ==================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("❌ 請先在 .env 設定 GEMINI_API_KEY")

GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
HEADERS = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}

# ================== 檢索 ==================
def hybrid_search(query: str, n=10):
    # 1. 向量檢索
    vector_results = collection.query(
        query_texts=[query],
        n_results=n,
        include=["documents", "metadatas", "distances"]
    )
    vector_docs = vector_results["documents"][0]
    vector_metas = vector_results["metadatas"][0]
    vector_scores = vector_results["distances"][0]

    vector_candidates = [
        (doc, meta, 1 - score, "Chroma")
        for doc, meta, score in zip(vector_docs, vector_metas, vector_scores)
    ]

    # 2. BM25 檢索
    tokenized_query = list(jieba.cut(query))
    bm25_scores = bm25.get_scores(tokenized_query)
    top_idx = sorted(range(len(bm25_scores)), key=lambda i: bm25_scores[i], reverse=True)[:n]

    bm25_candidates = [
        (bm25_chunks[i]["text"], bm25_chunks[i], bm25_scores[i], "BM25") for i in top_idx
    ]

    # 3. 合併
    merged = {}
    for doc, meta, score, source in vector_candidates + bm25_candidates:
        if doc not in merged or score > merged[doc][1]:
            merged[doc] = (meta, score, source)

    return [(doc, meta, score, source) for doc, (meta, score, source) in merged.items()]

# ================== Rerank ==================
def rerank(query, candidates, top_k=3, debug=False):
    pairs = [(query, doc) for doc, _, _, _ in candidates]
    scores = reranker.predict(pairs)

    ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)

    if debug:
        print("\n📊 Debug - 候選檢索分數對比：")
        for (doc, meta, base_score, source), rerank_score in ranked[:10]:
            print("────────────────────────────")
            print(f"來源: {source}")
            print(f"法例: {meta.get('law_name','')} {meta.get('section','')}")
            print(f"初始分數: {base_score:.4f}")
            print(f"Reranker 分數: {rerank_score:.4f}")
            print(f"條文內容: {doc[:80]}...")
        print("────────────────────────────")

    return ranked[:top_k]

# ================== Gemini 回答 ==================
def call_gemini(prompt):
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 512}
    }

    resp = requests.post(GEMINI_ENDPOINT, headers=HEADERS, json=body)
    if resp.status_code != 200:
        return f"⚠️ Gemini 請求失敗: {resp.status_code} {resp.text}"

    resp_data = resp.json()
    try:
        return resp_data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return str(resp_data)

def generate_answer_with_review(query, context_texts, sources):
    # Step 1: 初稿回答
    draft_prompt = (
        "你是一位香港法律輔助助手。根據以下法律條文輔助回答問題。"
        "⚠️ 請務必使用繁體中文回答。"
        "請簡潔清楚解釋。這不是法律意見。\n\n"
        f"法律條文：\n{chr(10).join(context_texts)}\n\n問題：{query}"
    )
    draft_answer = call_gemini(draft_prompt)

    # Step 2: 複核與修正
    review_prompt = (
        "以下是另一個模型給出的法律回答草稿。"
        "請幫我檢查："
        "1. 是否完整涵蓋法律條文重點？"
        "2. 是否存在錯誤或幻覺？"
        "3. 在保持準確性的前提下，請務必以繁體中文輸出最終回答。\n\n"
        f"問題：{query}\n\n草稿回答：{draft_answer}"
    )
    final_answer = call_gemini(review_prompt)

    return f"{final_answer}\n\n📚 來源：\n" + "\n".join(sources)

# ================== 主程式 ==================
if __name__ == "__main__":
    print("✅ Hybrid RAG Pipeline 2.1 已啟動（輸入 exit 離開）")

    while True:
        query = input("\n❓ 請輸入問題: ").strip()
        if query.lower() in ["exit", "quit", "q"]:
            print("👋 再見！")
            break

        candidates = hybrid_search(query, n=10)
        reranked = rerank(query, candidates, top_k=3, debug=True)

        context_texts = [doc for (doc, _, _, _), _ in reranked]
        sources = [f"- {meta.get('law_name','')} {meta.get('section','')}" for (_, meta, _, _), _ in reranked]

        answer = generate_answer_with_review(query, context_texts, sources)
        print("\n🧠 Gemini 最終回答：")
        print(answer)
