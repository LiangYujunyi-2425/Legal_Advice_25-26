from flask import Flask, request, jsonify, send_from_directory
import os
from flask_cors import CORS

# 匯入你原本的程式邏輯
from rag_pipelinev2 import rag_search_with_rerank, generate_answer_with_review
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
        reranked = rag_search_with_rerank(query, n=10, top_k=3)
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
    # 支援兩種方式：上傳檔案或直接傳入 OCR 文本
    ocr_text = None
    
    # 嘗試從 JSON 請求體中獲取 text 參數
    if request.json:
        ocr_text = request.json.get("text")
    
    # 如果沒有，嘗試從 form 數據中獲取
    if not ocr_text:
        ocr_text = request.form.get("text")
    
    if ocr_text:
        # 直接使用 OCR 文本進行分析（不需要文件）
        try:
            # 使用 RAG 管道進行文本分析
            reranked = rag_search_with_rerank(ocr_text, n=10, top_k=3)
            context_texts = [doc for (doc, _, _, _), _ in reranked]
            sources = [f"- {meta.get('law_name','')} {meta.get('section','')}" for (_, meta, _, _), _ in reranked]
            answer = generate_answer_with_review(ocr_text, context_texts, sources)
            
            # 對文本進行截斷以避免響應過大
            ocr_summary = ocr_text[:500] + "..." if len(ocr_text) > 500 else ocr_text
            
            return jsonify({
                "message": "分析完成",
                "summary": answer,
                "risks": [],
                "clauses": [],
                "sources": sources,
                "ocr_text": ocr_summary
            })
        except Exception as e:
            return jsonify({"error": f"文本分析失敗: {str(e)}"}), 500
    
    # 原本的檔案上傳流程
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Missing file or text parameter"}), 400
    
    save_path = f"./contracts/{file.filename}"
    file.save(save_path)

    try:
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
    except Exception as e:
        return jsonify({"error": f"文件分析失敗: {str(e)}"}), 500



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
