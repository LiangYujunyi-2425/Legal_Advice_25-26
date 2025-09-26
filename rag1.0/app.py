from flask import Flask, request, jsonify
from flask_cors import CORS

# 匯入你原本的程式邏輯
from rag_pipelinev2 import hybrid_search, rerank, generate_answer_with_review

app = Flask(__name__)
CORS(app)  # 允許跨來源請求（給 React 用）

@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"error": "Missing query"}), 400

    try:
        candidates = hybrid_search(query, n=10)
        reranked = rerank(query, candidates, top_k=3)
        context_texts = [doc for (doc, _, _, _), _ in reranked]
        sources = [f"- {meta.get('law_name','')} {meta.get('section','')}" for (_, meta, _, _), _ in reranked]
        answer = generate_answer_with_review(query, context_texts, sources)
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)