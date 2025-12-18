from fastapi import APIRouter, Request
from agent.db import db
from agent.runtime import get_model
from google.cloud import firestore
import datetime

router = APIRouter()

SYSTEM_PROMPT = """
你是一名律師，正在進行法律諮詢。請根據香港法例從專業角度回答用戶的問題並解釋你的推理。
用繁體中文回答，如有英文單詞請翻譯成繁體中文。如有實際案例請指出，不需要假設不存在的事實。
請給我乾淨的回答，並使用點列方式輸出回覆。
""".strip()

@router.post("/")
async def lawyer(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    user_question = body.get("user_question")

    if not session_id or not user_question:
        return {"ok": False, "agent": "lawyer", "error": "Missing session_id or user_question"}

    model = get_model()
    if model is None:
        return {"ok": False, "agent": "lawyer", "error": "GenerativeModel not initialized"}
    
    # Firestore logging
    doc_ref = db.collection("conversations").document(session_id)
    doc = doc_ref.get()
    data = doc.to_dict() or {}
    summaries = data.get("summaries", []) if doc.exists else []

    history_text = ""
    if isinstance(summaries, list):
        history_text = "\n".join([s.get("content", "") for s in summaries if isinstance(s, dict)])

    try:
        resp = model.generate_content(f"{SYSTEM_PROMPT}\n{history_text}\nuser: {user_question}")
        if not getattr(resp, "candidates", None):
            return {"ok": False, "agent": "lawyer", "error": "No candidates returned"}

        answer = resp.candidates[0].content.parts[0].text.strip()
    except Exception as e:
        return {"ok": False, "agent": "lawyer", "error": str(e)}

    # Firestore logging
    agent_msg = {
        "lawyer": answer,
    }

    doc_ref.set({
        "expireAt": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, merge=True)

    doc_ref.update({
        "messages": firestore.ArrayUnion([agent_msg])
    })
    
    return {"ok": True, "agent": "lawyer", "answer": answer}