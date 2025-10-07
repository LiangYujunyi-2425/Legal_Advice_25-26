import os
from dotenv import load_dotenv
from sentence_transformers import CrossEncoder
import re
from vertexai import rag
from vertexai.generative_models import Tool, GenerativeModel

# ================== 環境變數 ==================
load_dotenv()
PROJECT_ID = os.getenv("GCP_PROJECT")
LOCATION = os.getenv("GCP_LOCATION", "us-central1")
RAG_CORPUS_NAME = os.getenv("RAG_CORPUS_NAME")

if not PROJECT_ID or not RAG_CORPUS_NAME:
    raise ValueError("❌ 請在 .env 設定 GCP_PROJECT 與 RAG_CORPUS_NAME")

def clean_output(text: str) -> str:
    if not text:
        return ""
    # 移除常見冗餘開頭
    text = re.sub(r"^以下是.*\n?", "", text)
    text = re.sub(r"^好的，我來.*\n?", "", text)
    # 移除「修正說明」、「修正後」等字眼
    text = re.sub(r"(修正說明及理由：|修正後的風險分析：|修正後的摘要：|修正後的分析：)", "", text)
    return text.strip()


# ================== 初始化 RAG + Gemini ==================
rag_retrieval_config = rag.RagRetrievalConfig(
    top_k=10,
    filter=rag.Filter(vector_distance_threshold=0.5)
)

rag_tool = Tool.from_retrieval(
    retrieval=rag.Retrieval(
        source=rag.VertexRagStore(
            rag_resources=[rag.RagResource(rag_corpus=RAG_CORPUS_NAME)],
            rag_retrieval_config=rag_retrieval_config
        )
    )
)

# 第一層 Gemini（生成初步答案）
gen_model_primary = GenerativeModel(
    model_name="gemini-2.0-flash-001",
    tools=[rag_tool]
)

# 第二層 Gemini（複核答案）
gen_model_reviewer = GenerativeModel(
    model_name="gemini-2.0-flash-001"
)

# ================== 初始化 reranker ==================
reranker = CrossEncoder("BAAI/bge-reranker-large")

# ================== RAG 檢索 + rerank ==================
def rag_search_with_rerank(query: str, n=10, top_k=3):
    rag_response = rag.retrieval_query(
        rag_resources=[rag.RagResource(rag_corpus=RAG_CORPUS_NAME)],
        text=query,
        rag_retrieval_config=rag_retrieval_config,
    )

    candidates = []
    if rag_response and getattr(rag_response, "contexts", None):
        for ctx in rag_response.contexts.contexts[:n]:
            candidates.append((ctx.text, {"law_name": "RAG"}, ctx.score, "VertexRAG"))

    if not candidates:
        return []

    # rerank
    pairs = [(query, doc) for doc, _, _, _ in candidates]
    scores = reranker.predict(pairs)
    ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)

    return ranked[:top_k]

# ================== Gemini 雙層回答 ==================
def generate_answer_with_review(query, context_texts, sources):
    # 第一層：生成初步答案
    prompt_primary = (
        "你是香港法律輔助助手。請根據以下法律條文回答問題。\n"
        "要求：\n"
        "1. 使用繁體中文回答\n"
        "2. 詳細分析，重點突出\n"
        "3. 這不是法律意見，僅供參考\n\n"
        f"相關法律條文：\n{chr(10).join(context_texts[:3])}\n\n"
        f"問題：{query}\n\n"
        "請回答："
    )
    response_primary = gen_model_primary.generate_content(prompt_primary)
    draft_answer = response_primary.text

    # 第二層：複核答案（要求乾淨輸出）
    prompt_review = (
        "你是一位嚴謹的法律審核助手。請直接輸出最終答案，不要包含「以下是」、「修正後」、「修正說明」等字眼，也不要描述審核過程。\n"
        "要求：\n"
        "1. 檢查回答是否準確、是否有遺漏或錯誤\n"
        "2. 若文本未涵蓋，請明確標註「不確定/資料不足」\n"
        "3. 保持繁體中文，條列式重點，避免冗長\n\n"
        f"問題：{query}\n\n"
        f"相關法律條文：\n{chr(10).join(context_texts[:3])}\n\n"
        f"初步回答：\n{draft_answer}\n\n"
        "請輸出乾淨、正式的最終答案："
    )
    response_review = gen_model_reviewer.generate_content(prompt_review)
    final_answer = clean_output(response_review.text)

    return f"{final_answer}\n\n📚 來源：\n" + "\n".join(sources)


# ================== 主程式 ==================
if __name__ == "__main__":
    print("✅ RAG Pipeline (Vertex AI + rerank + Gemini 複核) 已啟動（輸入 exit 離開）")

    while True:
        query = input("\n❓ 請輸入問題: ").strip()
        if query.lower() in ["exit", "quit", "q"]:
            print("👋 再見！")
            break

        ranked = rag_search_with_rerank(query, n=10, top_k=3)

        if not ranked:
            print("⚠️ 沒有檢索到相關內容")
            continue

        context_texts = [doc for (doc, _, _, _), _ in ranked]
        sources = [f"- {meta.get('law_name','')}" for (_, meta, _, _), _ in ranked]

        answer = generate_answer_with_review(query, context_texts, sources)
        print("\n🧠 Gemini 最終回答（複核後）：")
        print(answer)
