from flask import Flask, request, jsonify, send_from_directory
import os
from flask_cors import CORS

# 匯入你原本的程式邏輯
from rag_pipelinev2 import hybrid_search, rerank, generate_answer_with_review
from contract_pipelinev2 import analyze_contract_file

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
    
@app.route("/reports/<path:filename>")
def download_report(filename):
    return send_from_directory("./reports", filename, as_attachment=True)


@app.route("/analyze", methods=["POST"])
def analyze():
    file = request.files["file"]  # 前端上傳的檔案
    save_path = f"./contracts/{file.filename}"
    file.save(save_path)

    # 呼叫你原本的流程
    result = analyze_contract_file(save_path)  # 這裡要回傳 dict
    word_name = os.path.basename(result["word"])
    json_name = os.path.basename(result["json"])

    return jsonify({
        "message": "分析完成",
        "word_report": f"/reports/{word_name}",
        "json_report": f"/reports/{json_name}",
        "summary": result.get("summary", ""),
        "risks": result.get("risks", "").split("\n") if isinstance(result.get("risks"), str) else result.get("risks", []),
        "clauses": [{"clause": c, "analysis": a} for c, a in result.get("clauses", [])]
    })



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)