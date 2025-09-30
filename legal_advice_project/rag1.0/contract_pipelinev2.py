import os
import json
import requests
import chromadb
from io import BytesIO
from datetime import datetime
from docx import Document
from dotenv import load_dotenv
from contract_ingest import load_contract, split_into_clauses, GTEEmbeddingFunction

# ==========================
# 環境變數
# ==========================
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("❌ 請先在 .env 設定 GEMINI_API_KEY")

GEMINI_MODEL = "models/gemini-2.5-flash"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/{GEMINI_MODEL}:generateContent"
HEADERS = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}

REPORTS_DIR = "./reports"
os.makedirs(REPORTS_DIR, exist_ok=True)  # 如果沒有資料夾就建立

# ==========================
# 初始化向量資料庫
# ==========================
client_chroma = chromadb.PersistentClient(path="./chroma_db")
laws_collection = client_chroma.get_collection(
    name="hk_cap4_laws", embedding_function=GTEEmbeddingFunction("thenlper/gte-large-zh")
)
contracts_collection = client_chroma.get_or_create_collection(
    name="contracts", embedding_function=GTEEmbeddingFunction("thenlper/gte-large-zh")
)

# ==========================
# Gemini API 呼叫
# ==========================
def call_gemini(prompt: str, temperature=0.6, max_tokens=2048):
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature, 
            "maxOutputTokens": max_tokens,
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
        if "finishReason" in candidate and candidate["finishReason"] not in ["STOP", "MAX_TOKENS"]:
            print(f"❌ 回答被阻擋: {candidate.get('finishReason')}")
            return f"⚠️ 回答被安全過濾器阻擋: {candidate.get('finishReason')}"
        
        # 提取文字內容 - 處理不同的回應格式
        if "content" in candidate:
            content = candidate["content"]
            if "parts" in content and content["parts"]:
                parts = content["parts"]
                if parts and "text" in parts[0]:
                    return parts[0]["text"]
            elif "text" in content:
                return content["text"]
        
        # 如果是 MAX_TOKENS 但沒有內容，可能是思考過程被截斷
        if candidate.get("finishReason") == "MAX_TOKENS":
            return "⚠️ 回答因 token 限制被截斷，請嘗試簡化問題"
        
        print(f"❌ 無法解析回答: {resp_data}")
        return "⚠️ 無法解析 Gemini 回答格式"
        
    except requests.exceptions.Timeout:
        return "⚠️ Gemini API 請求超時"
    except requests.exceptions.RequestException as e:
        return f"⚠️ 網路請求錯誤: {e}"
    except Exception as e:
        print(f"❌ 未預期錯誤: {e}")
        return f"⚠️ 處理 Gemini 回應時發生錯誤: {e}"

# ==========================
# 雙 Gemini 流程
# ==========================
def dual_gemini_answer(prompt: str):
    # 簡化為單次調用，避免 token 過多和複雜度
    enhanced_prompt = f"""
請使用繁體中文回答以下問題，要求：
1. 回答準確、簡潔
2. 重點突出
3. 避免冗長描述

{prompt}
"""
    return call_gemini(enhanced_prompt, temperature=0.5, max_tokens=1500)

# ==========================
# 條款分析
# ==========================
def analyze_clause(clause_text: str):
    try:
        law_results = laws_collection.query(query_texts=[clause_text], n_results=2)
        law_refs = law_results["documents"][0][:2]  # 限制參考數量
        
        # 嘗試查詢合約集合，如果失敗則跳過
        try:
            contract_results = contracts_collection.query(query_texts=[clause_text], n_results=1)
            contract_refs = contract_results["documents"][0][:1]
        except:
            contract_refs = []

        # 限制上下文長度
        context_parts = []
        for ref in (law_refs + contract_refs):
            if len("\n".join(context_parts)) < 2000:  # 限制上下文長度
                context_parts.append(ref[:500])  # 每個參考限制長度
        
        context = "\n".join(context_parts)

        prompt = f"""
分析以下合約條款：

條款內容：
{clause_text[:800]}

相關法律參考：
{context}

請提供：
1. 條款要點
2. 潛在風險
3. 法律依據
"""
        return dual_gemini_answer(prompt)
    
    except Exception as e:
        print(f"❌ 條款分析錯誤: {e}")
        return f"條款分析失敗: {str(e)}"

# ==========================
# 全局合約分析
# ==========================
def analyze_contract_global(contract_text: str):
    # 限制文本長度避免 token 超限
    text_limit = min(6000, len(contract_text))
    limited_text = contract_text[:text_limit]
    
    summary_prompt = f"""
請分析以下合約內容，提供簡潔的摘要：
1. 合約類型和目的
2. 主要當事人
3. 核心條款要點

合約內容：
{limited_text}
"""
    
    risk_prompt = f"""
請分析以下合約內容，識別潛在風險：
1. 法律風險
2. 商業風險
3. 執行風險

合約內容：
{limited_text}
"""

    print("🔍 生成合約摘要...")
    summary = dual_gemini_answer(summary_prompt)
    
    print("⚠️ 分析潛在風險...")
    risks = dual_gemini_answer(risk_prompt)
    
    return {"summary": summary, "risks": risks}

# ==========================
# 報告輸出
# ==========================
def generate_word_report(filename, summary, risks, clause_analyses):
    doc = Document()
    doc.add_heading("合約分析報告", level=1)

    doc.add_heading("📌 合約摘要", level=2)
    doc.add_paragraph(summary if summary else "無摘要")

    doc.add_heading("⚠️ 潛在風險", level=2)
    if risks:
        for r in risks.split("\n"):
            doc.add_paragraph(f"- {r.strip()}")
    else:
        doc.add_paragraph("未檢測到明顯風險。")

    doc.add_heading("📑 條款逐條分析", level=2)
    for i, (clause, analysis) in enumerate(clause_analyses, 1):
        doc.add_heading(f"條款 {i}", level=3)
        doc.add_paragraph(clause, style="Intense Quote")
        doc.add_paragraph(f"🔎 分析: {analysis}")

    base_name = os.path.basename(filename)
    out_name = base_name.rsplit(".", 1)[0] + "_分析.docx"
    out_path = os.path.join(REPORTS_DIR, out_name)
    doc.save(out_path)
    return out_path


def save_json_report(filename, summary, risks, clause_analyses):
    data = {
        "generated_at": datetime.now().isoformat(),
        "summary": summary,
        "risks": risks.split("\n") if isinstance(risks, str) else risks,
        "clauses": [{"clause": c, "analysis": a} for c, a in clause_analyses]
    }

    base_name = os.path.basename(filename)
    out_name = base_name.rsplit(".", 1)[0] + "_分析.json"
    out_path = os.path.join(REPORTS_DIR, out_name)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return out_path

# ==========================
# 主流程：掃描 contracts/
# ==========================
def analyze_contract_file(file_path):
    print(f"\n🚀 開始分析合約：{file_path}")
    text = load_contract(file_path)
    clauses = split_into_clauses(text, max_len=600)

    clause_analyses = []
    for i, clause in enumerate(clauses, 1):
        print(f"🔎 條款 {i} 分析中...")
        analysis = analyze_clause(clause)
        clause_analyses.append((clause, analysis))

    global_analysis = analyze_contract_global(text)
    summary, risks = global_analysis["summary"], global_analysis["risks"]

    word_file = generate_word_report(file_path, summary, risks, clause_analyses)
    json_file = save_json_report(file_path, summary, risks, clause_analyses)

    print(f"✅ 報告完成：{word_file}, {json_file}")
    return {
        "word": word_file,
        "json": json_file,
        "summary": summary,
        "risks": risks,
        "clauses": clause_analyses
    }

if __name__ == "__main__":
    contracts_dir = "./contracts"
    for filename in os.listdir(contracts_dir):
        file_path = os.path.join(contracts_dir, filename)
        if os.path.isfile(file_path) and filename.lower().endswith((".pdf", ".docx", ".txt")):
            analyze_contract_file(file_path)
