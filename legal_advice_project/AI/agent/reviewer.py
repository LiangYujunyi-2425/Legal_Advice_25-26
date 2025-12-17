# agent/reviewer.py
from fastapi import APIRouter, Request
from agent.db import db
from agent.runtime import get_model
from google.cloud import firestore
import datetime

router = APIRouter()

SYSTEM_PROMPT = """
你是一名資深法律審查員，負責審查其他律師的回答。你的任務是：

1. 檢查回答是否準確、完整
2. 檢查是否有法律錯誤或遺漏
3. 檢查是否符合香港法例
4. 檢查語言是否清晰、專業

審查規則：
• 如果回答正確且完整，直接輸出原回答，並在開頭加上「✅ 審查通過」
• 如果發現錯誤或不完整，輸出修正後的回答，並在開頭說明「⚠️ 已修正」
• 必須使用繁體中文
• 保持專業且客觀的態度
• 不要假設不存在的事實

輸出格式：
[審查狀態] (✅ 審查通過 或 ⚠️ 已修正)
[修正說明] (如果有修正，簡要說明修正了什麼)
[最終回答] (原回答或修正後的回答)
""".strip()

@router.post("/")
async def reviewer(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    original_answer = body.get("original_answer")  # 需要審查的原始回答
    original_question = body.get("original_question")  # 原始問題
    agent_type = body.get("agent_type", "unknown")  # 原始 agent 類型

    if not session_id or not original_answer:
        return {"ok": False, "agent": "reviewer", "error": "Missing session_id or original_answer"}

    model = get_model()
    if model is None:
        return {"ok": False, "agent": "reviewer", "error": "GenerativeModel not initialized"}
    
    # Firestore logging
    doc_ref = db.collection("conversations").document(session_id)
    doc = doc_ref.get()
    history = doc.to_dict().get("messages", []) if doc.exists else []

    # 構建審查提示
    review_prompt = f"""
請審查以下回答：

原始問題：{original_question}
原始 Agent：{agent_type}
原始回答：
{original_answer}

請根據審查規則進行審查並輸出結果。
"""

    try:
        resp = model.generate_content(f"{SYSTEM_PROMPT}\n\n{review_prompt}")
        if not getattr(resp, "candidates", None):
            return {"ok": False, "agent": "reviewer", "error": "No candidates returned"}

        reviewed_answer = resp.candidates[0].content.parts[0].text.strip()
        
        # 判斷是否有修正
        is_modified = "⚠️ 已修正" in reviewed_answer or "已修正" in reviewed_answer
        is_approved = "✅ 審查通過" in reviewed_answer or "審查通過" in reviewed_answer
        
    except Exception as e:
        return {"ok": False, "agent": "reviewer", "error": str(e)}

    # Firestore logging
    agent_msg = {
        "role": "reviewer",
        "content": reviewed_answer,
        "is_modified": is_modified,
        "is_approved": is_approved,
        "original_agent": agent_type,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

    doc_ref.set({
        "expireAt": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, merge=True)

    doc_ref.update({
        "messages": firestore.ArrayUnion([agent_msg])
    })

    return {
        "ok": True, 
        "agent": "reviewer", 
        "answer": reviewed_answer,
        "is_modified": is_modified,
        "is_approved": is_approved,
        "original_agent": agent_type
    }
