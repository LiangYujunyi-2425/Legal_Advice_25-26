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

GEMINI_MODEL = "models/gemini-2.5-flash"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/{GEMINI_MODEL}:generateContent"
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
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2, 
            "maxOutputTokens": 4096,
            "topP": 0.8,
            "topK": 10
        }
    }

    try:
        resp = requests.post(GEMINI_ENDPOINT, headers=HEADERS, json=body, timeout=30)
        
        if resp.status_code != 200:
            print(f"❌ HTTP 錯誤 {resp.status_code}: {resp.text}")
            return f"⚠️ Gemini API 請求失敗: {resp.status_code}"

        resp_data = resp.json()
        
        # 檢查是否有錯誤
        if "error" in resp_data:
            print(f"❌ API 錯誤: {resp_data['error']}")
            return f"⚠️ Gemini API 錯誤: {resp_data['error'].get('message', '未知錯誤')}"
        
        # 檢查候選回答
        if "candidates" not in resp_data or not resp_data["candidates"]:
            print(f"❌ 無候選回答: {resp_data}")
            return "⚠️ Gemini 未返回任何候選回答"
        
        candidate = resp_data["candidates"][0]
        
        # 檢查是否被安全過濾器阻擋
        if "finishReason" in candidate and candidate["finishReason"] != "STOP":
            print(f"❌ 回答被阻擋: {candidate.get('finishReason')}")
            return f"⚠️ 回答被安全過濾器阻擋: {candidate.get('finishReason')}"
        
        # 提取文字內容
        if "content" in candidate and "parts" in candidate["content"]:
            parts = candidate["content"]["parts"]
            if parts and "text" in parts[0]:
                return parts[0]["text"]
        
        print(f"❌ 無法解析回答: {resp_data}")
        return "⚠️ 無法解析 Gemini 回答格式"
        
    except requests.exceptions.Timeout:
        return "⚠️ Gemini API 請求超時"
    except requests.exceptions.RequestException as e:
        return f"⚠️ 網路請求錯誤: {e}"
    except Exception as e:
        print(f"❌ 未預期錯誤: {e}")
        return f"⚠️ 處理 Gemini 回應時發生錯誤: {e}"

def generate_answer_with_review(query, context_texts, sources):
    # 簡化為單次調用，避免 token 過多
    prompt = (
        "你是香港法律輔助助手。請根據以下法律條文回答問題。\n"
        "要求：\n"
        "1. 使用繁體中文回答\n"
        "2. 簡潔準確，重點突出\n"
        "3. 這不是法律意見，僅供參考\n\n"
        f"相關法律條文：\n{chr(10).join(context_texts[:3])}\n\n"  # 限制條文數量
        f"問題：{query}\n\n"
        "請回答："
    )
    
    answer = call_gemini(prompt)
    return f"{answer}\n\n📚 來源：\n" + "\n".join(sources)

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